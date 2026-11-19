const express = require("express");
const { sql, pool } = require("../db");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", async function (req, res) {
  try {
    let query;

    if (req.user.userRole === "Client") {
      query = `
                SELECT
                    u.UserID AS userID,
                    u.FullName AS fullName,
                    u.Email AS email,
                    u.PhoneNumber AS phoneNumber,
                    u.UserRole AS userRole,
                    c.CompanyName AS companyName,
                    c.BillingAddress AS billingAddress
                FROM dbo.UserAccount AS u
                INNER JOIN dbo.Client AS c
                    ON u.UserID = c.ClientID
                WHERE u.UserID = @UserID
                  AND u.UserRole = @UserRole
                  AND u.IsActive = 1;
            `;
    } else if (req.user.userRole === "Freelancer") {
      query = `
                SELECT
                    u.UserID AS userID,
                    u.FullName AS fullName,
                    u.Email AS email,
                    u.PhoneNumber AS phoneNumber,
                    u.UserRole AS userRole,
                    f.ProfessionalTitle AS professionalTitle,
                    f.Bio AS bio,
                    f.HourlyRate AS hourlyRate,
                    f.PortfolioURL AS portfolioURL
                FROM dbo.UserAccount AS u
                INNER JOIN dbo.Freelancer AS f
                    ON u.UserID = f.FreelancerID
                WHERE u.UserID = @UserID
                  AND u.UserRole = @UserRole
                  AND u.IsActive = 1;
            `;
    } else {
      return res.status(403).json({
        message: "This profile is for client and freelancer accounts.",
      });
    }

    const result = await pool
      .request()
      .input("UserID", sql.Int, req.user.userID)
      .input("UserRole", sql.VarChar(20), req.user.userRole)
      .query(query);

    const profile = result.recordset[0];

    if (!profile) {
      return res.status(404).json({
        message: "Profile not found.",
      });
    }

    return res.json({
      profile: profile,
    });
  } catch (error) {
    console.error("Profile lookup failed:", error.message);

    return res.status(500).json({
      message: "Unable to load your profile.",
    });
  }
});

router.put("/", async function (req, res) {
  let transaction;
  let transactionStarted = false;

  try {
    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        message: "Please provide your profile details.",
      });
    }

    const role = req.user.userRole;

    if (role !== "Client" && role !== "Freelancer") {
      return res.status(403).json({
        message: "This profile is for client and freelancer accounts.",
      });
    }

    function readText(name, label, maximum, required = false) {
      const value = body[name];

      if (value === undefined || value === null) {
        if (required) {
          const error = new Error(label + " is required.");
          error.statusCode = 400;
          throw error;
        }

        return null;
      }

      if (typeof value !== "string") {
        const error = new Error(label + " must be text.");
        error.statusCode = 400;
        throw error;
      }

      const text = value.trim();

      if ((required && text.length < 2) || text.length > maximum) {
        const error = new Error(
          required
            ? label + " must contain 2 to " + maximum + " characters."
            : label + " must not exceed " + maximum + " characters.",
        );

        error.statusCode = 400;
        throw error;
      }

      return text || null;
    }

    const fullName = readText("fullName", "Full name", 100, true);
    const phoneNumber = readText("phoneNumber", "Phone number", 25);

    let companyName = null;
    let billingAddress = null;
    let professionalTitle = null;
    let bio = null;
    let hourlyRate = null;
    let portfolioURL = null;

    if (role === "Client") {
      companyName = readText("companyName", "Company name", 150);
      billingAddress = readText("billingAddress", "Billing address", 300);
    } else {
      professionalTitle = readText(
        "professionalTitle",
        "Professional title",
        100,
      );

      bio = readText("bio", "Bio", 1000);
      portfolioURL = readText("portfolioURL", "Portfolio URL", 500);

      if (portfolioURL) {
        let validURL = false;

        try {
          const url = new URL(portfolioURL);
          validURL = url.protocol === "http:" || url.protocol === "https:";
        } catch {
          validURL = false;
        }

        if (!validURL) {
          return res.status(400).json({
            message: "Portfolio URL must start with http:// or https://.",
          });
        }
      }

      const rate = body.hourlyRate;

      if (rate !== undefined && rate !== null && rate !== "") {
        if (typeof rate !== "string" && typeof rate !== "number") {
          return res.status(400).json({
            message: "Please enter a valid hourly rate.",
          });
        }

        const rateText = String(rate).trim();

        if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(rateText)) {
          return res.status(400).json({
            message:
              "Hourly rate must be between 0 and 99999999.99, with up to two decimal places.",
          });
        }

        hourlyRate = Number(rateText);
      }
    }

    transaction = new sql.Transaction(pool);

    transaction.on("rollback", function () {
      transactionStarted = false;
    });

    await transaction.begin();
    transactionStarted = true;

    await new sql.Request(transaction)
      .input("UserID", sql.Int, req.user.userID)
      .input("UserRole", sql.VarChar(20), role)
      .input("FullName", sql.NVarChar(100), fullName)
      .input("PhoneNumber", sql.NVarChar(25), phoneNumber).query(`
        UPDATE dbo.UserAccount
        SET FullName = @FullName,
            PhoneNumber = @PhoneNumber
        WHERE UserID = @UserID
          AND UserRole = @UserRole
          AND IsActive = 1;

        IF @@ROWCOUNT <> 1
          THROW 50010, 'Account is no longer available.', 1;
      `);

    if (role === "Client") {
      await new sql.Request(transaction)
        .input("UserID", sql.Int, req.user.userID)
        .input("CompanyName", sql.NVarChar(150), companyName)
        .input("BillingAddress", sql.NVarChar(300), billingAddress).query(`
          UPDATE dbo.Client
          SET CompanyName = @CompanyName,
              BillingAddress = @BillingAddress
          WHERE ClientID = @UserID;

          IF @@ROWCOUNT <> 1
            THROW 50011, 'Client profile is missing.', 1;
        `);
    } else {
      await new sql.Request(transaction)
        .input("UserID", sql.Int, req.user.userID)
        .input("ProfessionalTitle", sql.NVarChar(100), professionalTitle)
        .input("Bio", sql.NVarChar(1000), bio)
        .input("HourlyRate", sql.Decimal(10, 2), hourlyRate)
        .input("PortfolioURL", sql.NVarChar(500), portfolioURL).query(`
          UPDATE dbo.Freelancer
          SET ProfessionalTitle = @ProfessionalTitle,
              Bio = @Bio,
              HourlyRate = @HourlyRate,
              PortfolioURL = @PortfolioURL
          WHERE FreelancerID = @UserID;

          IF @@ROWCOUNT <> 1
            THROW 50011, 'Freelancer profile is missing.', 1;
        `);
    }

    await transaction.commit();
    transactionStarted = false;

    return res.json({
      message: "Profile updated successfully.",
    });
  } catch (error) {
    if (transactionStarted && transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Profile rollback failed:", rollbackError.message);
      }
    }

    if (error.statusCode === 400) {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error("Profile update failed:", error.message);

    return res.status(500).json({
      message: "Unable to update your profile. Please try again.",
    });
  }
});
module.exports = router;
