require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const PgSession = require("connect-pg-simple")(session);

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ---------- Database ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("railway")
    ? { rejectUnauthorized: false }
    : false,
});

// ---------- Middleware ----------
app.set("trust proxy", 1); // Railway is behind a proxy
app.use(express.json());
app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      secure: BASE_URL.startsWith("https"),
      httpOnly: true,
      sameSite: "lax",
    },
  })
);
app.use(express.static(path.join(__dirname, "public")));

// ---------- Helpers ----------
const ADMIN_IDS = (process.env.DISCORD_ADMIN_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "غير مسجل دخول" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "غير مسجل دخول" });
  if (!ADMIN_IDS.includes(req.session.user.discord_id))
    return res.status(403).json({ error: "ما عندك صلاحية أدمن" });
  next();
}

async function logAction(userId, action, details) {
  try {
    await pool.query(
      "INSERT INTO logs (user_id, action, details) VALUES ($1, $2, $3)",
      [userId, action, details]
    );
  } catch (e) {
    console.error("log error:", e.message);
  }
}

// ---------- Discord OAuth ----------
app.get("/auth/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI || `${BASE_URL}/auth/discord/callback`,
    response_type: "code",
    scope: "identify email",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get("/auth/discord/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect("/?error=no_code");
  try {
    // 1) Exchange code for token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI || `${BASE_URL}/auth/discord/callback`,
      }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) {
      console.error("token error:", token);
      return res.redirect("/?error=token");
    }

    // 2) Fetch Discord user
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const dUser = await userRes.json();

    // 3) Upsert into database
    const avatar = dUser.avatar
      ? `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/0.png`;

    const result = await pool.query(
      `INSERT INTO users (discord_id, username, avatar, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (discord_id)
       DO UPDATE SET username = $2, avatar = $3, email = $4, last_login = NOW()
       RETURNING *`,
      [dUser.id, dUser.global_name || dUser.username, avatar, dUser.email || null]
    );

    const user = result.rows[0];
    req.session.user = {
      id: user.id,
      discord_id: user.discord_id,
      username: user.username,
      avatar: user.avatar,
    };
    await logAction(user.id, "login", "تسجيل دخول عبر Discord");
    res.redirect("/dashboard.html");
  } catch (err) {
    console.error("oauth error:", err);
    res.redirect("/?error=oauth");
  }
});

app.get("/auth/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// ---------- Public API ----------
app.get("/api/me", async (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  const { rows } = await pool.query("SELECT id, discord_id, username, avatar, balance, xp, rank FROM users WHERE id = $1", [req.session.user.id]);
  const user = rows[0] || null;
  res.json({ user, isAdmin: user ? ADMIN_IDS.includes(user.discord_id) : false });
});

app.get("/api/products", async (req, res) => {
  const { category, search, featured } = req.query;
  let sql = "SELECT * FROM products WHERE active = TRUE";
  const params = [];
  if (category) { params.push(category); sql += ` AND category = $${params.length}`; }
  if (search) { params.push(`%${search}%`); sql += ` AND name ILIKE $${params.length}`; }
  if (featured === "1") sql += " AND featured = TRUE";
  sql += " ORDER BY featured DESC, id DESC";
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

app.get("/api/stats", async (req, res) => {
  const users = await pool.query("SELECT COUNT(*) FROM users");
  const orders = await pool.query("SELECT COUNT(*) FROM orders");
  const products = await pool.query("SELECT COUNT(*) FROM products WHERE active = TRUE");
  res.json({
    users: +users.rows[0].count,
    orders: +orders.rows[0].count,
    products: +products.rows[0].count,
  });
});

// ---------- User API ----------
app.get("/api/orders", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT o.id, o.total, o.status, o.created_at,
            json_agg(json_build_object('name', p.name, 'qty', oi.qty, 'price', oi.price)) AS items
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     WHERE o.user_id = $1
     GROUP BY o.id ORDER BY o.id DESC`,
    [req.session.user.id]
  );
  res.json(rows);
});

app.post("/api/checkout", requireAuth, async (req, res) => {
  const { items, coupon } = req.body; // items: [{id, qty}]
  if (!Array.isArray(items) || !items.length)
    return res.status(400).json({ error: "السلة فارغة" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch real prices from DB (never trust the client)
    const ids = items.map((i) => +i.id);
    const { rows: products } = await client.query(
      "SELECT id, name, price, discount FROM products WHERE id = ANY($1) AND active = TRUE",
      [ids]
    );
    if (products.length !== ids.length) throw new Error("منتج غير موجود");

    let total = 0;
    const lines = items.map((i) => {
      const p = products.find((x) => x.id === +i.id);
      const qty = Math.max(1, Math.min(99, +i.qty || 1));
      const price = +p.price * (1 - (+p.discount || 0) / 100);
      total += price * qty;
      return { product_id: p.id, qty, price: price.toFixed(2) };
    });

    // Coupon
    let couponPct = 0;
    if (coupon) {
      const { rows: c } = await client.query(
        "SELECT percent FROM coupons WHERE code = $1 AND active = TRUE",
        [coupon.trim().toUpperCase()]
      );
      if (c.length) couponPct = +c[0].percent;
    }
    total = +(total * (1 - couponPct / 100)).toFixed(2);

    // Balance check + deduct
    const { rows: u } = await client.query(
      "SELECT balance FROM users WHERE id = $1 FOR UPDATE",
      [req.session.user.id]
    );
    if (+u[0].balance < total) throw new Error("رصيدك ما يكفي");

    await client.query(
      "UPDATE users SET balance = balance - $1, xp = xp + $2 WHERE id = $3",
      [total, Math.floor(total), req.session.user.id]
    );

    const { rows: o } = await client.query(
      "INSERT INTO orders (user_id, total, status) VALUES ($1, $2, 'completed') RETURNING id",
      [req.session.user.id, total]
    );
    for (const l of lines) {
      await client.query(
        "INSERT INTO order_items (order_id, product_id, qty, price) VALUES ($1, $2, $3, $4)",
        [o.rows[0].id, l.product_id, l.qty, l.price]
      );
    }

    await client.query("COMMIT");
    await logAction(req.session.user.id, "purchase", `طلب #${o.rows[0].id} بقيمة ${total}`);
    res.json({ success: true, orderId: o.rows[0].id, total });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message || "فشلت العملية" });
  } finally {
    client.release();
  }
});

// ---------- Admin API ----------
app.get("/api/admin/overview", requireAdmin, async (req, res) => {
  const users = await pool.query("SELECT COUNT(*) FROM users");
  const orders = await pool.query("SELECT COUNT(*), COALESCE(SUM(total),0) AS revenue FROM orders");
  const products = await pool.query("SELECT COUNT(*) FROM products");
  res.json({
    users: +users.rows[0].count,
    orders: +orders.rows[0].count,
    revenue: +orders.rows[0].revenue,
    products: +products.rows[0].count,
  });
});

app.post("/api/admin/products", requireAdmin, async (req, res) => {
  const { name, description, category, price, image, discount, featured } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO products (name, description, category, price, image, discount, featured)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, description || "", category, +price, image || "", +discount || 0, !!featured]
  );
  await logAction(req.session.user.id, "product_add", `إضافة منتج: ${name}`);
  res.json(rows[0]);
});

app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {
  const { name, description, category, price, image, discount, featured, active } = req.body;
  const { rows } = await pool.query(
    `UPDATE products SET name=$1, description=$2, category=$3, price=$4, image=$5,
     discount=$6, featured=$7, active=$8 WHERE id=$9 RETURNING *`,
    [name, description, category, +price, image, +discount || 0, !!featured, active !== false, +req.params.id]
  );
  await logAction(req.session.user.id, "product_edit", `تعديل منتج #${req.params.id}`);
  res.json(rows[0]);
});

app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
  await pool.query("UPDATE products SET active = FALSE WHERE id = $1", [+req.params.id]);
  await logAction(req.session.user.id, "product_delete", `حذف منتج #${req.params.id}`);
  res.json({ success: true });
});

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT o.*, u.username FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 100`
  );
  res.json(rows);
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, discord_id, username, balance, xp, rank, created_at FROM users ORDER BY id DESC LIMIT 100"
  );
  res.json(rows);
});

app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
  const { balance, rank } = req.body;
  const { rows } = await pool.query(
    "UPDATE users SET balance = $1, rank = $2 WHERE id = $3 RETURNING id, username, balance, rank",
    [+balance, rank, +req.params.id]
  );
  await logAction(req.session.user.id, "user_edit", `تعديل مستخدم #${req.params.id}`);
  res.json(rows[0]);
});

app.get("/api/admin/coupons", requireAdmin, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM coupons ORDER BY id DESC");
  res.json(rows);
});

app.post("/api/admin/coupons", requireAdmin, async (req, res) => {
  const { code, percent } = req.body;
  const { rows } = await pool.query(
    "INSERT INTO coupons (code, percent) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET percent = $2, active = TRUE RETURNING *",
    [code.trim().toUpperCase(), +percent]
  );
  res.json(rows[0]);
});

app.delete("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
  await pool.query("UPDATE coupons SET active = FALSE WHERE id = $1", [+req.params.id]);
  res.json({ success: true });
});

app.get("/api/admin/logs", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.*, u.username FROM logs l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT 100`
  );
  res.json(rows);
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`✅ Danger City Store running on ${BASE_URL}`);
});
