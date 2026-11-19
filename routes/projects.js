const express = require("express");
const { sql, pool } = require("../db");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);

router.use(function (req, res, next) {
  if (req.user.userRole !== "Client") {
    return res.status(403).json({
      message: "Only client accounts can manage client projects.",
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

router.get("/mine", async function (req, res) {
  try {
    const result = await pool
      .request()
      .input("ClientID", sql.Int, req.user.userID).query(`
        SELECT
          p.ProjectID AS projectID,
          p.Title AS title,
          p.Budget AS budget,
          CONVERT(VARCHAR(10), p.Deadline, 23) AS deadline,
          p.ProjectStatus AS projectStatus,
          s.ServiceName AS serviceName
        FROM dbo.Project AS p
        INNER JOIN dbo.AIService AS s
          ON p.ServiceID = s.ServiceID
        WHERE p.ClientID = @ClientID
        ORDER BY p.CreatedAt DESC, p.ProjectID DESC;
      `);

    return res.json({
      projects: result.recordset,
    });
  } catch (error) {
    console.error("Project list failed:", error.message);

    return res.status(500).json({
      message: "Unable to load your projects.",
    });
  }
});

router.post("/", async function (req, res) {
  let transaction;
  let transactionStarted = false;

  try {
    if (!req.is("application/json")) {
      return res.status(415).json({
        message: "Please send project details as JSON.",
      });
    }

    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        message: "Please provide project details.",
      });
    }

    if (
      typeof body.title !== "string" ||
      typeof body.description !== "string"
    ) {
      return res.status(400).json({
        message: "Please enter a project title and description.",
      });
    }

    const title = body.title.trim();
    const description = body.description.trim();

    if (title.length < 5 || title.length > 200) {
      return res.status(400).json({
        message: "Title must contain 5 to 200 characters.",
      });
    }

    if (description.length < 20 || description.length > 10000) {
      return res.status(400).json({
        message: "Description must contain 20 to 10000 characters.",
      });
    }

    if (typeof body.budget !== "string" && typeof body.budget !== "number") {
      return res.status(400).json({
        message: "Please enter a valid budget.",
      });
    }

    const budgetText = String(body.budget).trim();

    if (
      !/^\d{1,10}(?:\.\d{1,2})?$/.test(budgetText) ||
      Number(budgetText) <= 0
    ) {
      return res.status(400).json({
        message:
          "Budget must be greater than zero, with up to two decimal places. Maximum: 9999999999.99.",
      });
    }

    const deadline = body.deadline;

    if (typeof deadline !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      return res.status(400).json({
        message: "Please select a valid deadline.",
      });
    }

    const parsedDeadline = new Date(deadline + "T00:00:00.000Z");

    if (
      Number.isNaN(parsedDeadline.getTime()) ||
      parsedDeadline.toISOString().slice(0, 10) !== deadline ||
      deadline <= todayInSriLanka()
    ) {
      return res.status(400).json({
        message: "Deadline must be a valid date after today in Sri Lanka.",
      });
    }

    const serviceID = body.serviceID;

    if (
      !Number.isInteger(serviceID) ||
      serviceID < 1 ||
      serviceID > 2147483647
    ) {
      return res.status(400).json({
        message: "Please select a valid AI service.",
      });
    }

    const selectedSkills = body.skillIDs;

    if (
      !Array.isArray(selectedSkills) ||
      selectedSkills.length < 1 ||
      selectedSkills.length > 20 ||
      selectedSkills.some(function (id) {
        return !Number.isInteger(id) || id < 1 || id > 2147483647;
      }) ||
      new Set(selectedSkills).size !== selectedSkills.length
    ) {
      return res.status(400).json({
        message: "Please select 1 to 20 different skills.",
      });
    }

    const skillIDs = [...selectedSkills].sort(function (a, b) {
      return a - b;
    });

    function requestError(message, statusCode = 400) {
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

    const clientResult = await new sql.Request(transaction).input(
      "ClientID",
      sql.Int,
      req.user.userID,
    ).query(`
        SELECT c.ClientID
        FROM dbo.Client AS c WITH (HOLDLOCK)
        INNER JOIN dbo.UserAccount AS u WITH (HOLDLOCK)
          ON c.ClientID = u.UserID
        WHERE c.ClientID = @ClientID
          AND u.UserRole = 'Client'
          AND u.IsActive = 1;
      `);

    if (!clientResult.recordset.length) {
      throw requestError("An active client account is required.", 403);
    }

    const serviceResult = await new sql.Request(transaction).input(
      "ServiceID",
      sql.Int,
      serviceID,
    ).query(`
        SELECT ServiceID
        FROM dbo.AIService WITH (HOLDLOCK)
        WHERE ServiceID = @ServiceID
          AND IsActive = 1;
      `);

    if (!serviceResult.recordset.length) {
      throw requestError("The selected service is unavailable.");
    }

    const projectResult = await new sql.Request(transaction)
      .input("ClientID", sql.Int, req.user.userID)
      .input("ServiceID", sql.Int, serviceID)
      .input("Title", sql.NVarChar(200), title)
      .input("Description", sql.NVarChar(sql.MAX), description)
      .input("Budget", sql.Decimal(12, 2), Number(budgetText))
      .input("Deadline", sql.VarChar(10), deadline).query(`
        INSERT INTO dbo.Project (
          ClientID,
          ServiceID,
          Title,
          Description,
          Budget,
          Deadline,
          ProjectStatus
        )
        OUTPUT INSERTED.ProjectID AS projectID
        VALUES (
          @ClientID,
          @ServiceID,
          @Title,
          @Description,
          @Budget,
          CONVERT(DATE, @Deadline, 23),
          'Open'
        );
      `);

    const projectID = projectResult.recordset[0].projectID;

    for (const skillID of skillIDs) {
      const skillResult = await new sql.Request(transaction)
        .input("ProjectID", sql.Int, projectID)
        .input("SkillID", sql.Int, skillID).query(`
          INSERT INTO dbo.ProjectSkill (ProjectID, SkillID)
          SELECT @ProjectID, SkillID
          FROM dbo.Skill WITH (HOLDLOCK)
          WHERE SkillID = @SkillID;
        `);

      if (skillResult.rowsAffected[0] !== 1) {
        throw requestError(
          "One of the selected skills is unavailable. Reload the page.",
        );
      }
    }

    await transaction.commit();
    transactionStarted = false;

    return res.status(201).json({
      message: "Project posted successfully.",
      projectID: projectID,
    });
  } catch (error) {
    if (transactionStarted && transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Project rollback failed:", rollbackError.message);
      }
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    console.error("Project creation failed:", error.message);

    return res.status(500).json({
      message:
        "Unable to post your project. Refresh your project list before trying again.",
    });
  }
});

module.exports = router;
