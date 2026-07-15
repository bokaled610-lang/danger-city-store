require("dotenv").config();

const express = require("express");
const session = require("express-session");
const PgStore = require("connect-pg-simple")(session);
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const db = require("./src/db");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, "public");

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(rateLimit({ windowMs: 60000, limit: 180 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionOptions = {
  secret: process.env.SESSION_SECRET || "change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 12
  }
};

if (process.env.DATABASE_URL) {
  sessionOptions.store = new PgStore({
    pool: db.pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  });
}

app.use(session(sessionOptions));
app.use(express.static(PUBLIC));

const fallbackProducts = [
  {id:"1",name:"فيلا مونتانا الفاخرة",category:"house",description:"فيلا حديثة بمسبح خاص وكراج واسع.",price:450000,tag:"حصري"},
  {id:"2",name:"مقر شركة Eclipse",category:"hq",description:"مقر مجهز للشركات والفرق.",price:750000,tag:"جديد"},
  {id:"3",name:"Bugatti Chiron",category:"car",description:"سيارة نادرة بأداء استثنائي.",price:2950000,tag:"الأكثر مبيعاً"},
  {id:"4",name:"باقة البداية الذهبية",category:"bundle",description:"رصيد وسيارة وامتيازات بداية.",price:199000,tag:"عرض"}
];

async function getUser(req) {
  if (req.session.user) return req.session.user;

  if (String(process.env.DEV_LOGIN_ENABLED).toLowerCase() === "true") {
    if (process.env.DATABASE_URL) {
      try {
        const result = await db.query("SELECT * FROM users ORDER BY created_at LIMIT 1");
        req.session.user = result.rows[0] || null;
      } catch {
        req.session.user = null;
      }
    } else {
      req.session.user = {
        id: "dev",
        username: "Rashed",
        dc_account: "DC-100001",
        role: "owner",
        balance: 125000
      };
    }
  }

  return req.session.user || null;
}

app.get("/health", async (_, res) => {
  try {
    if (process.env.DATABASE_URL) await db.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.get("/api/config", async (req, res) => {
  const user = await getUser(req);
  res.json({
    user,
    currency: process.env.STORE_CURRENCY || "DC",
    ticketUrl: process.env.DISCORD_TICKET_URL || "https://discord.com"
  });
});

app.get("/api/products", async (_, res) => {
  if (!process.env.DATABASE_URL) return res.json(fallbackProducts);

  try {
    const result = await db.query("SELECT * FROM products WHERE active=true ORDER BY created_at DESC");
    res.json(result.rows.length ? result.rows : fallbackProducts);
  } catch {
    res.json(fallbackProducts);
  }
});

app.post("/api/orders", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "سجل دخولك أولاً" });

  let product;
  if (process.env.DATABASE_URL) {
    const result = await db.query("SELECT * FROM products WHERE id=$1", [req.body.productId]);
    product = result.rows[0];
  } else {
    product = fallbackProducts.find(p => p.id === req.body.productId);
  }

  if (!product) return res.status(404).json({ error: "المنتج غير موجود" });

  if (process.env.DATABASE_URL && user.id !== "dev") {
    await db.query(
      "INSERT INTO orders(user_id,product_id,product_name,amount) VALUES($1,$2,$3,$4)",
      [user.id, product.id, product.name, product.price]
    );
  }

  res.json({
    ok: true,
    ticketUrl: process.env.DISCORD_TICKET_URL || "https://discord.com"
  });
});

app.get("*", (_, res) => res.sendFile(path.join(PUBLIC, "index.html")));

app.listen(PORT, () => {
  console.log(`Danger City Store running on port ${PORT}`);
});
