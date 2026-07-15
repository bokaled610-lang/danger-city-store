require("dotenv").config();
const fs=require("fs");
const path=require("path");
const {Pool}=require("pg");
(async()=>{
  const pool=new Pool({
    connectionString:process.env.DATABASE_URL,
    ssl:String(process.env.DATABASE_SSL).toLowerCase()==="true"?{rejectUnauthorized:false}:false
  });
  const schema=fs.readFileSync(path.join(__dirname,"..","sql","schema.sql"),"utf8");
  await pool.query(schema);
  console.log("Database initialized.");
  await pool.end();
})().catch(e=>{console.error(e);process.exit(1)});
