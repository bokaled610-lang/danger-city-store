require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: String(process.env.DATABASE_SSL).toLowerCase() === "true"
      ? { rejectUnauthorized: false }
      : false
  });

  const schema = fs.readFileSync(path.join(__dirname, "..", "sql", "schema.sql"), "utf8");
  await pool.query(schema);
  console.log("Database initialized successfully.");
  await pool.end();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
