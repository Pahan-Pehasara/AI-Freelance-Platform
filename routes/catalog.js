const express = require("express");
const { pool } = require("../db");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", async function (req, res) {
  try {
    const result = await pool.request().query(`
      SELECT
        ServiceID AS serviceID,
        ServiceName AS serviceName,
        Description AS description
      FROM dbo.AIService
      WHERE IsActive = 1
      ORDER BY ServiceName;

      SELECT
        SkillID AS skillID,
        SkillName AS skillName,
        Description AS description
      FROM dbo.Skill
      ORDER BY SkillName;
    `);

    return res.json({
      services: result.recordsets[0],
      skills: result.recordsets[1],
    });
  } catch (error) {
    console.error("Catalog lookup failed:", error.message);

    return res.status(500).json({
      message: "Unable to load services and skills. Please try again.",
    });
  }
});

module.exports = router;
