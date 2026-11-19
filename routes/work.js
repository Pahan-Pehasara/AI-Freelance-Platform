const express = require("express");
const { sql, pool } = require("../db");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);

router.use(function (req, res, next) {
  if (req.user.userRole !== "Freelancer") {
    return res.status(403).json({
      message: "Please log in with a Freelancer account to find work.",
    });
  }

  next();
});

function todayInSriLanka() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

router.get("/", async function (req, res) {
  try {
    const result = await pool
      .request()
      .input("FreelancerID", sql.Int, req.user.userID)
      .input("Today", sql.VarChar(10), todayInSriLanka()).query(`
        SELECT
          p.ProjectID AS projectID,
          p.Title AS title,
          p.Description AS description,
          p.Budget AS budget,
          CONVERT(VARCHAR(10), p.Deadline, 23) AS deadline,
          DATEDIFF(
            DAY,
            CONVERT(DATE, @Today, 23),
            p.Deadline
          ) AS remainingDays,
          u.FullName AS clientName,
          s.ServiceName AS serviceName,
          own.ProposalID AS proposalID,
          own.ProposalStatus AS proposalStatus,
          (
            SELECT STRING_AGG(
              CONVERT(NVARCHAR(MAX), sk.SkillName),
              N', '
            )
            FROM dbo.ProjectSkill AS ps
            INNER JOIN dbo.Skill AS sk
              ON ps.SkillID = sk.SkillID
            WHERE ps.ProjectID = p.ProjectID
          ) AS skills
        FROM dbo.Project AS p
        INNER JOIN dbo.UserAccount AS u
          ON p.ClientID = u.UserID
        INNER JOIN dbo.AIService AS s
          ON p.ServiceID = s.ServiceID
        LEFT JOIN dbo.Proposal AS own
          ON own.ProjectID = p.ProjectID
          AND own.FreelancerID = @FreelancerID
        WHERE p.ProjectStatus = 'Open'
          AND p.Deadline > CONVERT(DATE, @Today, 23)
          AND u.IsActive = 1
          AND u.UserRole = 'Client'
          AND NOT EXISTS (
            SELECT 1
            FROM dbo.Assignment AS a
            WHERE a.ProjectID = p.ProjectID
          )
        ORDER BY p.CreatedAt DESC, p.ProjectID DESC;
      `);

    return res.json({
      projects: result.recordset,
    });
  } catch (error) {
    console.error("Open project lookup failed:", error.message);

    return res.status(500).json({
      message: "Unable to load available projects.",
    });
  }
});

router.get("/proposals", async function (req, res) {
  try {
    const result = await pool
      .request()
      .input("FreelancerID", sql.Int, req.user.userID).query(`
        SELECT
          pr.ProposalID AS proposalID,
          pr.ProjectID AS projectID,
          p.Title AS projectTitle,
          pr.CoverLetter AS coverLetter,
          pr.BidAmount AS bidAmount,
          pr.EstimatedDays AS estimatedDays,
          pr.ProposalStatus AS proposalStatus,
          p.ProjectStatus AS projectStatus
        FROM dbo.Proposal AS pr
        INNER JOIN dbo.Project AS p
          ON pr.ProjectID = p.ProjectID
        WHERE pr.FreelancerID = @FreelancerID
        ORDER BY pr.SubmittedAt DESC, pr.ProposalID DESC;
      `);

    return res.json({
      proposals: result.recordset,
    });
  } catch (error) {
    console.error("Proposal lookup failed:", error.message);

    return res.status(500).json({
      message: "Unable to load your proposals.",
    });
  }
});

router.post("/:projectID/proposals", async function (req, res) {
  let transaction;
  let transactionStarted = false;

  try {
    if (!req.is("application/json")) {
      return res.status(415).json({
        message: "Please send proposal details as JSON.",
      });
    }

    const projectID = Number(req.params.projectID);

    if (
      !/^\d+$/.test(req.params.projectID) ||
      !Number.isInteger(projectID) ||
      projectID < 1 ||
      projectID > 2147483647
    ) {
      return res.status(400).json({
        message: "Invalid project ID.",
      });
    }

    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        message: "Please provide your proposal details.",
      });
    }

    if (typeof body.coverLetter !== "string") {
      return res.status(400).json({
        message: "Please enter a cover letter.",
      });
    }

    const coverLetter = body.coverLetter.trim();

    if (coverLetter.length < 20 || coverLetter.length > 2000) {
      return res.status(400).json({
        message: "Cover letter must contain 20 to 2000 characters.",
      });
    }

    if (
      typeof body.bidAmount !== "string" &&
      typeof body.bidAmount !== "number"
    ) {
      return res.status(400).json({
        message: "Please enter a valid bid amount.",
      });
    }

    const bidText = String(body.bidAmount).trim();

    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(bidText) || Number(bidText) <= 0) {
      return res.status(400).json({
        message:
          "Bid must be greater than zero, with up to two decimal places. Maximum: 9999999999.99.",
      });
    }

    const estimatedDays = body.estimatedDays;

    if (
      !Number.isInteger(estimatedDays) ||
      estimatedDays < 1 ||
      estimatedDays > 3650
    ) {
      return res.status(400).json({
        message: "Estimated days must be a whole number from 1 to 3650.",
      });
    }

    function requestError(message, statusCode) {
      const error = new Error(message);
      error.statusCode = statusCode;
      return error;
    }

    transaction = new sql.Transaction(pool);

    transaction.on("rollback", function () {
      transactionStarted = false;
    });

    await transaction.begin();
    transactionStarted = true;

    const projectResult = await new sql.Request(transaction)
      .input("ProjectID", sql.Int, projectID)
      .input("Today", sql.VarChar(10), todayInSriLanka()).query(`
        SELECT
          p.ProjectID,
          p.ProjectStatus,
          DATEDIFF(
            DAY,
            CONVERT(DATE, @Today, 23),
            p.Deadline
          ) AS remainingDays,
          u.IsActive AS clientIsActive,
          u.UserRole AS clientRole
        FROM dbo.Project AS p WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.UserAccount AS u WITH (HOLDLOCK)
          ON p.ClientID = u.UserID
        WHERE p.ProjectID = @ProjectID;
      `);

    const project = projectResult.recordset[0];

    if (!project) {
      throw requestError("Project not found.", 404);
    }

    if (
      project.ProjectStatus !== "Open" ||
      project.remainingDays < 1 ||
      !project.clientIsActive ||
      project.clientRole !== "Client"
    ) {
      throw requestError("This project is no longer accepting proposals.", 409);
    }

    if (estimatedDays > project.remainingDays) {
      throw requestError(
        "Estimated days must fit within the project deadline.",
        400,
      );
    }

    const assignmentResult = await new sql.Request(transaction).input(
      "ProjectID",
      sql.Int,
      projectID,
    ).query(`
        SELECT AssignmentID
        FROM dbo.Assignment WITH (HOLDLOCK)
        WHERE ProjectID = @ProjectID;
      `);

    if (assignmentResult.recordset.length) {
      throw requestError("This project is already assigned.", 409);
    }

    const freelancerResult = await new sql.Request(transaction).input(
      "FreelancerID",
      sql.Int,
      req.user.userID,
    ).query(`
        SELECT f.FreelancerID
        FROM dbo.Freelancer AS f WITH (HOLDLOCK)
        INNER JOIN dbo.UserAccount AS u WITH (HOLDLOCK)
          ON f.FreelancerID = u.UserID
        WHERE f.FreelancerID = @FreelancerID
          AND u.UserRole = 'Freelancer'
          AND u.IsActive = 1;
      `);

    if (!freelancerResult.recordset.length) {
      throw requestError("An active freelancer account is required.", 403);
    }

    const existingResult = await new sql.Request(transaction)
      .input("ProjectID", sql.Int, projectID)
      .input("FreelancerID", sql.Int, req.user.userID).query(`
        SELECT ProposalID
        FROM dbo.Proposal
        WHERE ProjectID = @ProjectID
          AND FreelancerID = @FreelancerID;
      `);

    if (existingResult.recordset.length) {
      throw requestError(
        "You have already submitted a proposal for this project.",
        409,
      );
    }

    const result = await new sql.Request(transaction)
      .input("ProjectID", sql.Int, projectID)
      .input("FreelancerID", sql.Int, req.user.userID)
      .input("CoverLetter", sql.NVarChar(2000), coverLetter)
      .input("BidAmount", sql.Decimal(12, 2), Number(bidText))
      .input("EstimatedDays", sql.Int, estimatedDays).query(`
        INSERT INTO dbo.Proposal (
          ProjectID,
          FreelancerID,
          CoverLetter,
          BidAmount,
          EstimatedDays,
          ProposalStatus
        )
        OUTPUT INSERTED.ProposalID AS proposalID
        VALUES (
          @ProjectID,
          @FreelancerID,
          @CoverLetter,
          @BidAmount,
          @EstimatedDays,
          'Pending'
        );
      `);

    const proposalID = result.recordset[0].proposalID;

    await transaction.commit();
    transactionStarted = false;

    return res.status(201).json({
      message: "Proposal submitted successfully.",
      proposalID: proposalID,
    });
  } catch (error) {
    if (transactionStarted && transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Proposal rollback failed:", rollbackError.message);
      }
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    const errors = [
      error,
      error.originalError?.info,
      ...(error.precedingErrors || []),
    ];

    if (
      errors.some(function (item) {
        return item && (item.number === 2601 || item.number === 2627);
      })
    ) {
      return res.status(409).json({
        message: "You have already submitted a proposal for this project.",
      });
    }

    console.error("Proposal submission failed:", error.message);

    return res.status(500).json({
      message:
        "Unable to submit your proposal. Refresh your proposals before trying again.",
    });
  }
});

module.exports = router;
