const sql = require("mssql/msnodesqlv8");

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  driver: process.env.DB_DRIVER,
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 15000,
  requestTimeout: 15000,
};

const pool = new sql.ConnectionPool(config);

pool.on("error", function (error) {
  console.error("Database pool error:", error.message);
});

module.exports = { sql, pool };
