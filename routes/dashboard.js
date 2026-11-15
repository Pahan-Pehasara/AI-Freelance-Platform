const express = require("express");
const { sql, pool } = require("../db");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.get("/", requireAuth, async function (req, res) {
  try {
    const request = pool.request().input("UserID", sql.Int, req.user.userID);

    let stats;

    if (req.user.userRole === "Client") {
      const result = await request.query(`
                SELECT
                    COUNT(*) AS TotalProjects,
                    COUNT(
                        CASE WHEN ProjectStatus = 'Open' THEN 1 END
                    ) AS OpenProjects,
                    COUNT(
                        CASE WHEN ProjectStatus = 'InProgress' THEN 1 END
                    ) AS InProgressProjects,
                    COUNT(
                        CASE WHEN ProjectStatus = 'Completed' THEN 1 END
                    ) AS CompletedProjects
                FROM dbo.Project
                WHERE ClientID = @UserID;
            `);

      const data = result.recordset[0];

      stats = [
        { label: "Total projects", value: data.TotalProjects },
        { label: "Open projects", value: data.OpenProjects },
        { label: "In progress", value: data.InProgressProjects },
        { label: "Completed projects", value: data.CompletedProjects },
      ];
    } else if (req.user.userRole === "Freelancer") {
      const result = await request.query(`
                SELECT
                    (
                        SELECT COUNT(*)
                        FROM dbo.Proposal
                        WHERE FreelancerID = @UserID
                    ) AS TotalProposals,
                    (
                        SELECT COUNT(*)
                        FROM dbo.Proposal
                        WHERE FreelancerID = @UserID
                          AND ProposalStatus = 'Pending'
                    ) AS PendingProposals,
                    (
                        SELECT COUNT(*)
                        FROM dbo.Assignment AS a
                        INNER JOIN dbo.Proposal AS pr
                            ON a.ProposalID = pr.ProposalID
                        WHERE pr.FreelancerID = @UserID
                    ) AS AssignedProjects,
                    (
                        SELECT COUNT(*)
                        FROM dbo.Assignment AS a
                        INNER JOIN dbo.Proposal AS pr
                            ON a.ProposalID = pr.ProposalID
                        INNER JOIN dbo.Project AS p
                            ON a.ProjectID = p.ProjectID
                        WHERE pr.FreelancerID = @UserID
                          AND p.ProjectStatus = 'Completed'
                          AND a.CompletedAt IS NOT NULL
                    ) AS CompletedProjects;
            `);

      const data = result.recordset[0];

      stats = [
        { label: "Total proposals", value: data.TotalProposals },
        { label: "Pending proposals", value: data.PendingProposals },
        { label: "Assigned projects", value: data.AssignedProjects },
        { label: "Completed projects", value: data.CompletedProjects },
      ];
    } else {
      return res.status(403).json({
        message: "This dashboard is for client and freelancer accounts.",
      });
    }

    return res.json({
      user: req.user,
      stats: stats,
    });
  } catch (error) {
    console.error("Dashboard lookup failed:", error.message);

    return res.status(500).json({
      message: "Unable to load dashboard data.",
    });
  }
});

module.exports = router;
