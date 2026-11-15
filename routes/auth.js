const express = require("express");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");
const { sql, pool } = require("../db");

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many registration attempts. Please try again later.",
  },
});

router.post("/register", registerLimiter, async function (req, res) {
  const body = req.body || {};

  if (
    typeof body.fullName !== "string" ||
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    typeof body.userRole !== "string"
  ) {
    return res.status(400).json({
      message: "Please complete all required fields.",
    });
  }

  const fullName = body.fullName.trim();
  const email = body.email.trim().toLowerCase();
  const password = body.password;
  const userRole = body.userRole;
  const phoneNumber =
    typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";

  if (fullName.length < 2 || fullName.length > 100) {
    return res.status(400).json({
      message: "Name must contain between 2 and 100 characters.",
    });
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      message: "Please enter a valid email address.",
    });
  }

  if (password.length < 12) {
    return res.status(400).json({
      message: "Password must contain at least 12 characters.",
    });
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({
      message: "Password is too long. Please use fewer characters.",
    });
  }

  if (!["Client", "Freelancer"].includes(userRole)) {
    return res.status(400).json({
      message: "Please select Client or Freelancer.",
    });
  }

  if (phoneNumber.length > 25) {
    return res.status(400).json({
      message: "Phone number is too long.",
    });
  }

  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;
  let rolledBack = false;

  transaction.on("rollback", function () {
    rolledBack = true;
  });

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    await transaction.begin();
    transactionStarted = true;

    const result = await new sql.Request(transaction)
      .input("FullName", sql.NVarChar(100), fullName)
      .input("Email", sql.NVarChar(254), email)
      .input("PasswordHash", sql.VarChar(255), passwordHash)
      .input("PhoneNumber", sql.NVarChar(25), phoneNumber || null)
      .input("UserRole", sql.VarChar(20), userRole).query(`
                INSERT INTO dbo.UserAccount (
                    FullName,
                    Email,
                    PasswordHash,
                    PhoneNumber,
                    UserRole
                )
                OUTPUT INSERTED.UserID
                VALUES (
                    @FullName,
                    @Email,
                    @PasswordHash,
                    @PhoneNumber,
                    @UserRole
                );
            `);

    const userID = result.recordset[0].UserID;

    const profileQuery =
      userRole === "Client"
        ? "INSERT INTO dbo.Client (ClientID) VALUES (@UserID);"
        : "INSERT INTO dbo.Freelancer (FreelancerID) VALUES (@UserID);";

    await new sql.Request(transaction)
      .input("UserID", sql.Int, userID)
      .query(profileQuery);

    await transaction.commit();
    transactionStarted = false;

    return res.status(201).json({
      message: "Account created successfully.",
      userID: userID,
      userRole: userRole,
    });
  } catch (error) {
    if (transactionStarted && !rolledBack) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Registration rollback:", rollbackError.message);
      }
    }

    const errorNumbers = [
      error.number,
      error.code,
      error.originalError?.number,
      error.originalError?.code,
      error.originalError?.info?.number,
      ...(error.precedingErrors || []).map(function (item) {
        return item.number ?? item.code;
      }),
    ].map(Number);

    if (errorNumbers.includes(2627) || errorNumbers.includes(2601)) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration failed:", error.message);

    return res.status(500).json({
      message: "Registration failed. Please try again.",
    });
  }
});

const dummyLoginHash = bcrypt.hashSync(
  require("crypto").randomBytes(32).toString("hex"),
  12,
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again later.",
  },
});

router.post("/login", loginLimiter, async function (req, res) {
  const body = req.body || {};

  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return res.status(400).json({
      message: "Please enter your email and password.",
    });
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password;

  if (
    !email ||
    email.length > 254 ||
    !password ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  try {
    const result = await pool.request().input("Email", sql.NVarChar(254), email)
      .query(`
                SELECT UserID, PasswordHash, IsActive
                FROM dbo.UserAccount
                WHERE Email = @Email;
            `);

    const user = result.recordset[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user ? user.PasswordHash : dummyLoginHash,
    );

    if (!user || !user.IsActive || !passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    await new Promise(function (resolve, reject) {
      req.session.regenerate(function (error) {
        if (error) reject(error);
        else resolve();
      });
    });

    req.session.userID = user.UserID;

    await new Promise(function (resolve, reject) {
      req.session.save(function (error) {
        if (error) reject(error);
        else resolve();
      });
    });

    return res.json({
      message: "Logged in successfully.",
    });
  } catch (error) {
    console.error("Login failed:", error.message);

    return res.status(500).json({
      message: "Unable to log in. Please try again.",
    });
  }
});

router.get("/me", async function (req, res) {
  if (!req.session.userID) {
    return res.status(401).json({
      message: "Please log in.",
    });
  }

  try {
    const result = await pool
      .request()
      .input("UserID", sql.Int, req.session.userID).query(`
                SELECT
                    UserID AS userID,
                    FullName AS fullName,
                    Email AS email,
                    UserRole AS userRole
                FROM dbo.UserAccount
                WHERE UserID = @UserID
                  AND IsActive = 1;
            `);

    const user = result.recordset[0];

    if (!user) {
      await new Promise(function (resolve, reject) {
        req.session.destroy(function (error) {
          if (error) reject(error);
          else resolve();
        });
      });

      res.clearCookie("aifreelance.sid", { path: "/" });

      return res.status(401).json({
        message: "Please log in again.",
      });
    }

    return res.json({ user: user });
  } catch (error) {
    console.error("Account lookup failed:", error.message);

    return res.status(500).json({
      message: "Unable to load account details.",
    });
  }
});

router.post("/logout", function (req, res) {
  req.session.destroy(function (error) {
    if (error) {
      console.error("Logout failed:", error.message);

      return res.status(500).json({
        message: "Unable to log out. Please try again.",
      });
    }

    res.clearCookie("aifreelance.sid", { path: "/" });

    return res.json({
      message: "Logged out successfully.",
    });
  });
});

module.exports = router;
