// تشغيل: npm run initdb  (مرة وحدة بعد ربط DATABASE_URL)
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("railway")
      ? { rejectUnauthorized: false }
      : false,
  });
  try {
    const schema = fs.readFileSync(path.join(__dirname, "../db/schema.sql"), "utf8");
    const seed = fs.readFileSync(path.join(__dirname, "../db/seed.sql"), "utf8");
    await pool.query(schema);
    console.log("✅ Schema created");
    await pool.query(seed);
    console.log("✅ Seed data inserted");
  } catch (err) {
    console.error("❌ initdb error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
