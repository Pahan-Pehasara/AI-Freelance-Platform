const { sql, pool } = require("../db");

async function requireAuth(req, res, next) {
  res.set("Cache-Control", "no-store");

  if (!req.session || !Number.isInteger(req.session.userID)) {
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

    req.user = user;
    return next();
  } catch (error) {
    console.error("Session verification failed:", error.message);

    return res.status(503).json({
      message: "Unable to verify your session. Please try again.",
    });
  }
}

module.exports = requireAuth;
