const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const express = require("express");
const { pool } = require("./db");

const app = express();
const port = Number(process.env.PORT) || 3000;

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("A SESSION_SECRET of at least 32 characters is required.");
}

app.use(express.json());

app.use(
  require("express-session")({
    name: "aifreelance.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 2 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api/auth", function (req, res, next) {
  res.set("Cache-Control", "no-store");

  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    const allowedOrigins = [
      "http://localhost:" + port,
      "http://127.0.0.1:" + port,
    ];

    if (origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({
        message: "Request origin is not allowed.",
      });
    }
  }

  next();
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", function (req, res) {
  res.send("<h1>AI Freelancing Platform</h1><p>Web server is working!</p>");
});

app.get("/api/db-check", async function (req, res) {
  try {
    const result = await pool.request().query(`
            SELECT
                DB_NAME() AS DatabaseName,
                (
                    SELECT COUNT(*)
                    FROM sys.tables
                    WHERE schema_id = SCHEMA_ID('dbo')
                      AND is_ms_shipped = 0
                ) AS TableCount;
        `);

    const data = result.recordset[0];

    res.json({
      message: "Database connected successfully",
      database: data.DatabaseName,
      tableCount: data.TableCount,
    });
  } catch (error) {
    console.error("Database check failed:", error.message);

    res.status(500).json({
      message: "Database check failed. See the server terminal.",
    });
  }
});

async function startServer() {
  try {
    await pool.connect();

    console.log("Database connected successfully");

    app.listen(port, "127.0.0.1", function () {
      console.log("Server running at http://localhost:" + port);
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    await pool.close();
    process.exitCode = 1;
  }
}

startServer();
