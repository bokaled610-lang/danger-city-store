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

async function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "غير مسجل دخول" });
  const { rows } = await pool.query("SELECT banned FROM users WHERE id = $1", [req.session.user.id]);
  if (rows[0] && rows[0].banned) {
    req.session.destroy(() => {});
    return res.status(403).json({ error: "حسابك محظور" });
  }
  next();
}

// الصلاحيات: product = إضافة منتج | ranks = إعطاء رتب وصلاحيات | xp = إعطاء XP | ban = حظر لاعب
const ALL_PERMS = ["product", "ranks", "xp", "ban"];

async function getStaff(discordId) {
  if (ADMIN_IDS.includes(discordId))
    return { rank: "أونر", rank_order: 0, perms: ALL_PERMS, owner: true };
  const { rows } = await pool.query(
    "SELECT rank, rank_order, perms FROM staff WHERE discord_id = $1",
    [discordId]
  );
  if (!rows.length) return null;
  return {
    rank: rows[0].rank,
    rank_order: rows[0].rank_order,
    perms: (rows[0].perms || "").split(",").map((s) => s.trim()).filter(Boolean),
    owner: false,
  };
}

function requirePerm(perm) {
  return async (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: "غير مسجل دخول" });
    const st = await getStaff(req.session.user.discord_id);
    if (!st) return res.status(403).json({ error: "ما عندك صلاحية أدمن" });
    if (perm && !st.owner && !st.perms.includes(perm))
      return res.status(403).json({ error: "ما عندك هالصلاحية" });
    req.staff = st;
    next();
  };
}
const requireAdmin = requirePerm(null); // أي إداري
function requireOwner(req, res, next) {
  requirePerm(null)(req, res, () => {
    if (!req.staff.owner) return res.status(403).json({ error: "هالشي للأونر فقط" });
    next();
  });
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

async function getSettings() {
  const { rows } = await pool.query("SELECT key, value FROM settings");
  const out = {};
  rows.forEach((r) => (out[r.key] = r.value));
  return out;
}
function num(v, def) { const n = +v; return Number.isFinite(n) ? n : def; }

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
      `INSERT INTO users (discord_id, username, avatar, email, ref_code)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (discord_id)
       DO UPDATE SET username = $2, avatar = $3, email = $4, last_login = NOW()
       RETURNING *, (xmax = 0) AS is_new`,
      [dUser.id, dUser.global_name || dUser.username, avatar, dUser.email || null, Math.random().toString(36).slice(2, 10)]
    );

    const user = result.rows[0];

    // محظور؟ ما يدخل
    if (user.banned) return res.redirect("/?error=banned");

    // Welcome + referral XP (amounts controlled from admin settings)
    if (user.is_new) {
      const st = await getSettings();
      const welcomeXp = num(st.welcome_xp, 0);
      if (welcomeXp > 0) {
        await pool.query("UPDATE users SET xp = xp + $1 WHERE id = $2", [welcomeXp, user.id]);
      }
      if (req.session.ref) {
        const ref = await pool.query(
          "SELECT id FROM users WHERE ref_code = $1 AND id <> $2",
          [req.session.ref, user.id]
        );
        if (ref.rows.length) {
          const referrerId = ref.rows[0].id;
          const refXp = num(st.referral_xp, 50);
          await pool.query("UPDATE users SET referred_by = $1, xp = xp + $2 WHERE id = $3", [referrerId, refXp, user.id]);
          await pool.query("UPDATE users SET xp = xp + $1 WHERE id = $2", [refXp, referrerId]);
          await logAction(referrerId, "referral", `دعوة ناجحة: ${user.username} (+${refXp} XP للطرفين)`);
        }
        delete req.session.ref;
      }
    }
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
app.get("/api/config", async (req, res) => {
  let st = {};
  try { st = await getSettings(); } catch (e) {}
  res.json({
    invite: process.env.DISCORD_INVITE_URL || "",
    ticket: process.env.DISCORD_TICKET_URL || "",
    currency: "DC",
    announcement: st.announcement || "",
    xpRate: num(st.xp_rate, 10),
    minExchange: num(st.min_exchange, 10),
    referralXp: num(st.referral_xp, 50),
  });
});

app.get("/r/:code", (req, res) => {
  req.session.ref = req.params.code;
  res.redirect("/");
});

app.get("/api/coupon/check", async (req, res) => {
  const code = (req.query.code || "").trim().toUpperCase();
  if (!code) return res.json({ valid: false });
  const { rows } = await pool.query(
    "SELECT percent FROM coupons WHERE code = $1 AND active = TRUE",
    [code]
  );
  if (!rows.length) return res.json({ valid: false });
  res.json({ valid: true, percent: +rows[0].percent });
});

app.get("/api/me", async (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  const { rows } = await pool.query("SELECT id, discord_id, username, avatar, dr_balance, xp, rank, ref_code, banned FROM users WHERE id = $1", [req.session.user.id]);
  const user = rows[0] || null;
  if (user && user.banned) {
    req.session.destroy(() => {});
    return res.json({ user: null, banned: true });
  }
  if (user && !user.ref_code) {
    user.ref_code = Math.random().toString(36).slice(2, 10);
    await pool.query("UPDATE users SET ref_code = $1 WHERE id = $2", [user.ref_code, user.id]);
  }
  let refCount = 0;
  if (user) {
    const rc = await pool.query("SELECT COUNT(*) FROM users WHERE referred_by = $1", [user.id]);
    refCount = +rc.rows[0].count;
  }
  const st = user ? await getStaff(user.discord_id) : null;
  res.json({
    user,
    refCount,
    isAdmin: !!st,
    isOwner: !!(st && st.owner),
    perms: st ? st.perms : [],
    staffRank: st ? st.rank : null,
  });
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
    const ids = [...new Set(items.map((i) => +i.id))];
    if (ids.some((x) => !Number.isFinite(x))) throw new Error("السلة فيها عنصر تالف — فرّغها وجرب من جديد");
    const { rows: products } = await client.query(
      "SELECT id, name, price, discount, currency FROM products WHERE id = ANY($1) AND active = TRUE",
      [ids]
    );
    if (products.length !== ids.length) throw new Error("منتج غير موجود");

    let total = 0, totalDr = 0;
    const lines = items.map((i) => {
      const p = products.find((x) => +x.id === +i.id);
      if (!p) throw new Error("منتج بالسلة ما عاد موجود — فرّغ السلة وجرب من جديد");
      const qty = Math.max(1, Math.min(99, +i.qty || 1));
      const price = +p.price * (1 - (+p.discount || 0) / 100);
      if ((p.currency || "DC") === "DR") totalDr += price * qty;
      else total += price * qty;
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
    totalDr = +(totalDr * (1 - couponPct / 100)).toFixed(2);

    // Ticket flow: save the order as pending, payment is completed inside the Discord ticket
    const orderResult = await client.query(
      "INSERT INTO orders (user_id, total, total_dr, status) VALUES ($1, $2, $3, 'ticket') RETURNING id",
      [req.session.user.id, total, totalDr]
    );
    const orderId = orderResult.rows[0].id;
    for (const l of lines) {
      await client.query(
        "INSERT INTO order_items (order_id, product_id, qty, price) VALUES ($1, $2, $3, $4)",
        [orderId, l.product_id, l.qty, l.price]
      );
    }

    await client.query("COMMIT");
    await logAction(req.session.user.id, "ticket_order", `تكت شراء #${orderId} بقيمة ${total} DC + ${totalDr} DR`);
    res.json({
      success: true,
      orderId,
      total,
      totalDr,
      ticketUrl: process.env.DISCORD_TICKET_URL || process.env.DISCORD_INVITE_URL || "",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CHECKOUT ERROR:", err.stack || err);
    res.status(400).json({ error: err.message || "فشلت العملية" });
  } finally {
    client.release();
  }
});

// ---------- XP Exchange (10 XP = 1 DC) ----------
app.post("/api/exchange-xp", requireAuth, async (req, res) => {
  const st = await getSettings();
  const rate = Math.max(1, num(st.xp_rate, 10));
  const minEx = Math.max(1, num(st.min_exchange, 10));
  const xp = Math.floor(+req.body.xp || 0);
  if (xp < minEx) return res.status(400).json({ error: `أقل استبدال ${minEx} XP` });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT xp FROM users WHERE id = $1 FOR UPDATE", [req.session.user.id]);
    if (+rows[0].xp < xp) throw new Error("نقاطك ما تكفي");
    const dr = +(xp / rate).toFixed(2);
    await client.query("UPDATE users SET xp = xp - $1, dr_balance = dr_balance + $2 WHERE id = $3", [xp, dr, req.session.user.id]);
    await client.query("COMMIT");
    await logAction(req.session.user.id, "xp_exchange", `استبدال ${xp} XP مقابل ${dr} DR`);
    res.json({ success: true, dr });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message || "فشل الاستبدال" });
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

app.post("/api/admin/products", requirePerm("product"), async (req, res) => {
  const { name, description, category, price, image, discount, featured, currency } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO products (name, description, category, price, image, discount, featured, currency)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name, description || "", category, +price, image || "", +discount || 0, !!featured, currency === "DR" ? "DR" : "DC"]
  );
  await logAction(req.session.user.id, "product_add", `إضافة منتج: ${name}`);
  res.json(rows[0]);
});

app.put("/api/admin/products/:id", requirePerm("product"), async (req, res) => {
  const { name, description, category, price, image, discount, featured, active, currency } = req.body;
  const { rows } = await pool.query(
    `UPDATE products SET name=$1, description=$2, category=$3, price=$4, image=$5,
     discount=$6, featured=$7, active=$8, currency=$9 WHERE id=$10 RETURNING *`,
    [name, description, category, +price, image, +discount || 0, !!featured, active !== false, currency === "DR" ? "DR" : "DC", +req.params.id]
  );
  await logAction(req.session.user.id, "product_edit", `تعديل منتج #${req.params.id}`);
  res.json(rows[0]);
});

app.delete("/api/admin/products/:id", requirePerm("product"), async (req, res) => {
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
    "SELECT id, discord_id, username, dr_balance, xp, rank, banned, created_at FROM users ORDER BY id DESC LIMIT 100"
  );
  res.json(rows);
});

// تعديل رتبة/رصيد DR — يحتاج صلاحية "ranks"
app.put("/api/admin/users/:id", requirePerm("ranks"), async (req, res) => {
  const { dr_balance, rank } = req.body;
  const { rows } = await pool.query(
    "UPDATE users SET dr_balance = $1, rank = $2 WHERE id = $3 RETURNING id, username, dr_balance, xp, rank",
    [+dr_balance || 0, (rank || "مواطن").trim(), +req.params.id]
  );
  await logAction(req.session.user.id, "user_edit", `تعديل مستخدم #${req.params.id} (رتبة: ${rows[0]?.rank})`);
  res.json(rows[0]);
});

// إعطاء XP — يحتاج صلاحية "xp"
app.post("/api/admin/users/:id/xp", requirePerm("xp"), async (req, res) => {
  const amount = Math.floor(+req.body.amount || 0);
  if (!amount) return res.status(400).json({ error: "اكتب كمية XP" });
  const { rows } = await pool.query(
    "UPDATE users SET xp = GREATEST(0, xp + $1) WHERE id = $2 RETURNING id, username, xp",
    [amount, +req.params.id]
  );
  await logAction(req.session.user.id, "xp_give", `${amount > 0 ? "إعطاء" : "خصم"} ${Math.abs(amount)} XP للمستخدم #${req.params.id}`);
  res.json(rows[0]);
});

// حظر / فك حظر — يحتاج صلاحية "ban"
app.post("/api/admin/users/:id/ban", requirePerm("ban"), async (req, res) => {
  const target = await pool.query("SELECT discord_id FROM users WHERE id = $1", [+req.params.id]);
  if (!target.rows.length) return res.status(404).json({ error: "المستخدم غير موجود" });
  if (ADMIN_IDS.includes(target.rows[0].discord_id))
    return res.status(403).json({ error: "ما تقدر تحظر الأونر 😅" });
  const banned = !!req.body.banned;
  const { rows } = await pool.query(
    "UPDATE users SET banned = $1 WHERE id = $2 RETURNING id, username, banned",
    [banned, +req.params.id]
  );
  await logAction(req.session.user.id, banned ? "ban" : "unban", `${banned ? "حظر" : "فك حظر"} المستخدم #${req.params.id}`);
  res.json(rows[0]);
});

// ---------- Staff API (لوق الإدارة + التوظيف) ----------
app.get("/api/admin/staff", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, u.username, u.avatar FROM staff s
     LEFT JOIN users u ON u.discord_id = s.discord_id
     ORDER BY s.rank_order ASC, s.id ASC`
  );
  const owners = [];
  for (const oid of ADMIN_IDS) {
    const u = await pool.query("SELECT username, avatar FROM users WHERE discord_id = $1", [oid]);
    owners.push({
      id: 0, discord_id: oid, rank: "أونر", rank_order: 0, perms: ALL_PERMS.join(","),
      owner: true, username: u.rows[0]?.username || "الأونر", avatar: u.rows[0]?.avatar || "",
    });
  }
  res.json([...owners, ...rows]);
});

app.post("/api/admin/staff", requirePerm("ranks"), async (req, res) => {
  const discord_id = (req.body.discord_id || "").trim();
  const rank = (req.body.rank || "إداري").trim();
  const rank_order = Math.max(1, Math.floor(+req.body.rank_order || 100));
  const perms = (Array.isArray(req.body.perms) ? req.body.perms : [])
    .filter((p) => ALL_PERMS.includes(p)).join(",");
  if (!/^[0-9]{15,25}$/.test(discord_id))
    return res.status(400).json({ error: "آيدي الديسكورد غير صحيح" });
  if (ADMIN_IDS.includes(discord_id))
    return res.status(400).json({ error: "هذا أونر أصلاً وعنده كل الصلاحيات" });
  const { rows } = await pool.query(
    `INSERT INTO staff (discord_id, rank, rank_order, perms, added_by)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (discord_id) DO UPDATE SET rank=$2, rank_order=$3, perms=$4
     RETURNING *`,
    [discord_id, rank, rank_order, perms, req.session.user.discord_id]
  );
  await logAction(req.session.user.id, "staff_hire", `توظيف/تعديل إداري ${discord_id} — رتبة: ${rank}`);
  res.json(rows[0]);
});

app.delete("/api/admin/staff/:id", requirePerm("ranks"), async (req, res) => {
  await pool.query("DELETE FROM staff WHERE id = $1", [+req.params.id]);
  await logAction(req.session.user.id, "staff_remove", `إزالة إداري #${req.params.id}`);
  res.json({ success: true });
});

app.get("/api/admin/coupons", requireAdmin, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM coupons ORDER BY id DESC");
  res.json(rows);
});

app.post("/api/admin/coupons", requireOwner, async (req, res) => {
  const { code, percent } = req.body;
  const { rows } = await pool.query(
    "INSERT INTO coupons (code, percent) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET percent = $2, active = TRUE RETURNING *",
    [code.trim().toUpperCase(), +percent]
  );
  res.json(rows[0]);
});

app.delete("/api/admin/coupons/:id", requireOwner, async (req, res) => {
  await pool.query("UPDATE coupons SET active = FALSE WHERE id = $1", [+req.params.id]);
  res.json({ success: true });
});

app.get("/api/admin/logs", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.*, u.username FROM logs l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT 100`
  );
  res.json(rows);
});

app.get("/api/admin/settings", requireAdmin, async (req, res) => {
  res.json(await getSettings());
});

app.put("/api/admin/settings", requireOwner, async (req, res) => {
  const allowed = ["referral_xp", "welcome_xp", "xp_rate", "min_exchange", "purchase_xp_percent", "announcement"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      await pool.query(
        "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
        [key, String(req.body[key])]
      );
    }
  }
  await logAction(req.session.user.id, "settings", "تعديل إعدادات المتجر");
  res.json(await getSettings());
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`✅ Danger City Store running on ${BASE_URL}`);
});
