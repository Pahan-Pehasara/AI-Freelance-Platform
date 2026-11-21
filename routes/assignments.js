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

router.post("/:assignmentID/complete", async function (req, res) {

  const assignmentID = Number(req.params.assignmentID);

  if (!Number.isInteger(assignmentID) || assignmentID < 1) {
    return res.status(400).json({
      message: "Invalid assignment ID."
    });
  }

  const transaction = new sql.Transaction(pool);

  try {

    await transaction.begin();

    const request = new sql.Request(transaction);

    request.input("AssignmentID", sql.Int, assignmentID);
    request.input("UserID", sql.Int, req.user.userID);

    const result = await request.query(`
        UPDATE p
        SET p.ProjectStatus = 'Completed'
        FROM dbo.Project AS p
        INNER JOIN dbo.Assignment AS a
            ON p.ProjectID = a.ProjectID
        WHERE
            a.AssignmentID = @AssignmentID
            AND p.ClientID = @UserID
            AND p.ProjectStatus = 'InProgress'
            AND a.CompletedAt IS NULL;

        UPDATE dbo.Assignment
        SET CompletedAt = GETDATE()
        WHERE
            AssignmentID = @AssignmentID
            AND CompletedAt IS NULL;
    `);

    if (result.rowsAffected[0] === 0 && result.rowsAffected[1] === 0) {
      await transaction.rollback();

      return res.status(409).json({
        message: "This assignment has already been completed or cannot be completed."
      });
    }

    await transaction.commit();

    return res.json({
      message: "Project marked as completed."
    });

  } catch (error) {

    await transaction.rollback();

    console.error("Complete assignment failed:", error.message);

    return res.status(500).json({
      message: "Unable to complete assignment."
    });
  }

});

module.exports = router;