
const express = require("express");
const { sql, pool } = require("../db");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);


router.use(function (req, res, next) {
  if (req.user.userRole !== "Client") {
    return res.status(403).json({
      message: "Only clients can review proposals."
    });
  }

  next();
});

function isValidID(value) {
  return (
    /^\d+$/.test(value) &&
    Number.isInteger(Number(value)) &&
    Number(value) >= 1 &&
    Number(value) <= 2147483647
  );
}

router.get("/", async function (req, res) {
  try {
    const result = await pool.request()
      .input("ClientID", sql.Int, req.user.userID)
      .query(`
        SELECT
          p.ProjectID AS projectID,
          p.Title AS title,
          p.Budget AS budget,
          p.ProjectStatus AS projectStatus,
          CONVERT(VARCHAR(10), p.Deadline, 23) AS deadline,
          s.ServiceName AS serviceName,
          proposalCount.totalProposals AS totalProposals,
          a.AssignmentID AS assignmentID,
          a.AgreedAmount AS agreedAmount,
          selectedUser.FullName AS assignedFreelancer
        FROM dbo.Project AS p
        INNER JOIN dbo.AIService AS s
          ON p.ServiceID = s.ServiceID
        OUTER APPLY (
          SELECT COUNT(*) AS totalProposals
          FROM dbo.Proposal AS pr
          WHERE pr.ProjectID = p.ProjectID
        ) AS proposalCount
        LEFT JOIN dbo.Assignment AS a
          ON p.ProjectID = a.ProjectID
        LEFT JOIN dbo.Proposal AS selectedProposal
          ON a.ProposalID = selectedProposal.ProposalID
        LEFT JOIN dbo.UserAccount AS selectedUser
          ON selectedProposal.FreelancerID = selectedUser.UserID
        WHERE p.ClientID = @ClientID
        ORDER BY p.CreatedAt DESC, p.ProjectID DESC;
      `);

    return res.json({
      projects: result.recordset
    });

  } catch (error) {
    console.error("Client project lookup failed:", error.message);

    return res.status(500).json({
      message: "Unable to load your projects."
    });
  }
});


router.get("/:projectID", async function (req, res) {
  if (!isValidID(req.params.projectID)) {
    return res.status(400).json({
      message: "Invalid project ID."
    });
  }

  try {
    const result = await pool.request()
      .input("ProjectID", sql.Int, Number(req.params.projectID))
      .input("ClientID", sql.Int, req.user.userID)
      .query(`
        SELECT
          p.ProjectID AS projectID,
          p.Title AS title,
          p.Budget AS budget,
          p.ProjectStatus AS projectStatus,
          CONVERT(VARCHAR(10), p.Deadline, 23) AS deadline,
          s.ServiceName AS serviceName,
          a.AssignmentID AS assignmentID,
          a.AgreedAmount AS agreedAmount,
          selectedUser.FullName AS assignedFreelancer
        FROM dbo.Project AS p
        INNER JOIN dbo.AIService AS s
          ON p.ServiceID = s.ServiceID
        LEFT JOIN dbo.Assignment AS a
          ON p.ProjectID = a.ProjectID
        LEFT JOIN dbo.Proposal AS selectedProposal
          ON a.ProposalID = selectedProposal.ProposalID
        LEFT JOIN dbo.UserAccount AS selectedUser
          ON selectedProposal.FreelancerID = selectedUser.UserID
        WHERE p.ProjectID = @ProjectID
          AND p.ClientID = @ClientID;

        SELECT
          pr.ProposalID AS proposalID,
          pr.FreelancerID AS freelancerID,
          u.FullName AS fullName,
          f.ProfessionalTitle AS professionalTitle,
          pr.CoverLetter AS coverLetter,
          pr.BidAmount AS bidAmount,
          pr.EstimatedDays AS estimatedDays,
          pr.ProposalStatus AS proposalStatus,
          CAST(
            CASE
              WHEN u.IsActive = 1
                AND u.UserRole = 'Freelancer'
                AND pr.ProposalStatus = 'Pending'
                AND p.ProjectStatus = 'Open'
                AND NOT EXISTS (
                  SELECT 1
                  FROM dbo.Assignment AS existingAssignment
                  WHERE existingAssignment.ProjectID = p.ProjectID
                )
              THEN 1
              ELSE 0
            END AS BIT
          ) AS canBeSelected
        FROM dbo.Proposal AS pr
        INNER JOIN dbo.UserAccount AS u
          ON pr.FreelancerID = u.UserID
        INNER JOIN dbo.Freelancer AS f
          ON pr.FreelancerID = f.FreelancerID
        INNER JOIN dbo.Project AS p
          ON pr.ProjectID = p.ProjectID
        WHERE pr.ProjectID = @ProjectID
          AND p.ClientID = @ClientID
        ORDER BY pr.SubmittedAt DESC, pr.ProposalID DESC;
      `);

    const project = result.recordsets[0][0];

    if (!project) {
      return res.status(404).json({
        message: "Project not found."
      });
    }

    return res.json({
      project: project,
      proposals: result.recordsets[1]
    });

  } catch (error) {
    console.error("Proposal lookup failed:", error.message);

    return res.status(500).json({
      message: "Unable to load proposals."
    });
  }
});



router.post("/:projectID/:proposalID/accept", async function (req, res) {
  if (!req.is("application/json")) {
    return res.status(415).json({
      message: "Please send JSON data."
    });
  }

  if (
    !isValidID(req.params.projectID) ||
    !isValidID(req.params.proposalID)
  ) {
    return res.status(400).json({
      message: "Invalid project or proposal ID."
    });
  }

  try {
    const result = await pool.request()
      .input("ClientID", sql.Int, req.user.userID)
      .input("ProjectID", sql.Int, Number(req.params.projectID))
      .input("ProposalID", sql.Int, Number(req.params.proposalID))
      .execute("dbo.usp_SelectFreelancer");

    return res.status(201).json({
      message: "Freelancer selected successfully!",
      result: result.recordset || []
    });

  } catch (error) {
    console.error("Freelancer selection failed:", error.message);

    const errors = [
      error,
      error.originalError?.info,
      ...(error.precedingErrors || [])
    ];

    const conflict = errors.some(function (item) {
      return (
        item &&
        item.number >= 50000 &&
        item.number <= 59999
      );
    });

    return res.status(conflict ? 409 : 500).json({
      message: conflict
        ? "This proposal cannot be accepted. Refresh and check the project."
        : "Unable to select freelancer."
    });
  }
});

module.exports = router;
