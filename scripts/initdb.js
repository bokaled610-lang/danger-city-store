// يشتغل تلقائياً قبل تشغيل الموقع — ينشئ الجداول، ويضيف المنتجات التجريبية مرة وحدة فقط
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
    await pool.query(schema);
    console.log("✅ Schema ready");

    const { rows } = await pool.query("SELECT COUNT(*) FROM products");
    if (+rows[0].count === 0) {
      const seed = fs.readFileSync(path.join(__dirname, "../db/seed.sql"), "utf8");
      await pool.query(seed);
      console.log("✅ Seed data inserted");
    } else {
      console.log("ℹ️ Products already exist, skipping seed");
    }
  } catch (err) {
    console.error("❌ initdb error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
