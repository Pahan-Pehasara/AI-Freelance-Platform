const express = require("express");
const { pool, sql } = require("../db");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", async function (req, res) {
  try {
    const result = await pool.request()
      .input("UserID", sql.Int, req.user.userID)
      .query(`
        SELECT
          a.AssignmentID AS assignmentID,
          p.ProjectID AS projectID,
          p.Title AS projectTitle,
          p.ProjectStatus AS projectStatus,
          a.AgreedAmount AS agreedAmount,
          client.FullName AS clientName,
          freelancer.FullName AS freelancerName
        FROM dbo.Assignment AS a
        INNER JOIN dbo.Project AS p
          ON a.ProjectID = p.ProjectID
        INNER JOIN dbo.Proposal AS pr
          ON a.ProposalID = pr.ProposalID
        INNER JOIN dbo.UserAccount AS client
          ON p.ClientID = client.UserID
        INNER JOIN dbo.UserAccount AS freelancer
          ON pr.FreelancerID = freelancer.UserID
        WHERE
          p.ClientID = @UserID
          OR pr.FreelancerID = @UserID
        ORDER BY a.AssignmentID DESC;
      `);

    return res.json({
      assignments: result.recordset
    });

  } catch (error) {
    console.error("Assignment lookup failed:", error.message);

    return res.status(500).json({
      message: "Unable to load assignments."
    });
  }
});

module.exports = router;