/* ============ Danger City — Shared JS ============ */

const CUR = "DC";
let CONFIG = { invite: "", ticket: "", currency: CUR };
let APPLIED_COUPON = null; // {code, percent}

const CATEGORY_ICONS = {
  cars: "🏎️", houses: "🏠", coins: "🪙", ranks: "👑",
  bundles: "🎁", hq: "🏢", perks: "⚡", services: "🛠️",
};
const CATEGORY_NAMES = {
  cars: "سيارات", houses: "بيوت", coins: "عملات", ranks: "رتب",
  bundles: "باقات", hq: "مقرات", perks: "مزايا", services: "خدمات",
};

/* ---------- Config (Discord links) ---------- */
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    CONFIG = await res.json();
    const loaderBtn = document.getElementById("loader-discord");
    if (loaderBtn && CONFIG.invite) {
      loaderBtn.href = CONFIG.invite;
      loaderBtn.style.display = "inline-flex";
    }
    ["hero-join", "side-join"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && CONFIG.invite) el.href = CONFIG.invite;
    });
    const navDiscord = document.getElementById("nav-discord");
    if (navDiscord && CONFIG.invite) {
      navDiscord.href = CONFIG.invite;
      navDiscord.style.display = "inline";
    }
    if (CONFIG.announcement) {
      const bar = document.createElement("div");
      bar.textContent = "📢 " + CONFIG.announcement;
      bar.style.cssText = "background:linear-gradient(135deg,var(--orange),#ff6a00);color:#16100a;font-weight:700;text-align:center;padding:10px 16px;font-size:.95rem";
      const nav = document.querySelector("nav");
      if (nav) nav.after(bar);
    }
    const exSub = document.getElementById("exchange-sub");
    if (exSub) exSub.textContent = `كل ${CONFIG.xpRate} XP = 1 DR تنضاف لرصيدك — تشتري فيها منتجات DR مثل الخزنات والبيوت المؤقتة`;
  } catch (e) {}
}
loadConfig();

/* ---------- Loading screen ---------- */
(function loader() {
  const el = document.getElementById("loader");
  if (!el) return;
  const phrases = [
    "امتلك ما يميزك داخل المدينة",
    "استعد لتجربة جديدة",
    "مكافآت يومية بانتظارك",
    "أفضل متجر داخل المدينة",
    "جودة وسرعة وأمان",
  ];
  let i = 0, progress = 0;
  const fill = document.getElementById("loader-fill");
  const phrase = document.getElementById("loader-phrase");
  const pInt = setInterval(() => {
    phrase.textContent = phrases[++i % phrases.length];
    phrase.style.animation = "none";
    void phrase.offsetWidth;
    phrase.style.animation = "fadeIn .5s ease";
  }, 900);
  const bInt = setInterval(() => {
    progress = Math.min(100, progress + Math.random() * 18);
    fill.style.width = progress + "%";
    if (progress >= 100) {
      clearInterval(bInt); clearInterval(pInt);
      setTimeout(() => el.classList.add("hidden"), 600);
    }
  }, 340);
})();

/* ---------- Toast ---------- */
function toast(msg, isError = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = isError ? "error show" : "show";
  setTimeout(() => t.classList.remove("show"), 3200);
}

/* ---------- Auth state ---------- */
let ME = null;
async function loadMe() {
  try {
    const res = await fetch("/api/me");
    const data = await res.json();
    ME = data.user;
    if (ME) {
      document.getElementById("login-btn").style.display = "none";
      const chip = document.getElementById("user-chip");
      chip.style.display = "block";
      document.getElementById("user-avatar").src = ME.avatar;
      const dash = document.getElementById("nav-dash");
      if (dash) dash.style.display = "inline";
      if (data.isAdmin) {
        const adm = document.getElementById("nav-admin");
        if (adm) adm.style.display = "inline";
      }
    }
  } catch (e) { /* not logged in */ }
}
loadMe();

/* ---------- Stats ---------- */
async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    const s = await res.json();
    animateCount("stat-users", s.users);
    animateCount("stat-orders", s.orders);
    animateCount("stat-products", s.products);
  } catch (e) {}
}
function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 40));
  const int = setInterval(() => {
    cur = Math.min(target, cur + step);
    el.textContent = cur.toLocaleString("en");
    if (cur >= target) clearInterval(int);
  }, 30);
}

/* ---------- Products ---------- */
async function loadProducts(gridId, params = {}) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch("/api/products" + (qs ? "?" + qs : ""));
  const products = await res.json();
  grid.innerHTML = products.length
    ? products.map(productCard).join("")
    : `<p style="color:var(--muted)">ما فيه منتجات حالياً — نضيفها قريب 👀</p>`;
}

function productCard(p) {
  const price = +p.price;
  const cur = (p.currency || "DC");
  const final = (price * (1 - (+p.discount || 0) / 100)).toFixed(2);
  const img = p.image
    ? `<img src="${p.image}" alt="${p.name}" loading="lazy" />`
    : CATEGORY_ICONS[p.category] || "📦";
  return `
  <div class="card reveal visible">
    ${+p.discount > 0 ? `<span class="badge">خصم ${+p.discount}%</span>` : p.featured ? `<span class="badge featured">مميز</span>` : ""}
    <div class="card-img">${img}</div>
    <div class="card-body">
      <h3>${p.name}</h3>
      <p>${p.description || ""}</p>
      <div class="card-footer">
        <span class="price">${final} ${cur}${+p.discount > 0 ? `<s>${price.toFixed(2)} ${cur}</s>` : ""}</span>
        <button class="btn btn-primary" onclick="addToCart(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${final}, '${cur}')">أضف للسلة</button>
      </div>
    </div>
  </div>`;
}

/* ---------- Cart (localStorage) ---------- */
function getCart() { return JSON.parse(localStorage.getItem("dc_cart") || "[]"); }
function saveCart(c) { localStorage.setItem("dc_cart", JSON.stringify(c)); renderCart(); }

function addToCart(id, name, price, cur) {
  const cart = getCart();
  const item = cart.find((i) => i.id === id);
  if (item) item.qty++;
  else cart.push({ id, name, price, cur: cur || "DC", qty: 1 });
  saveCart(cart);
  toast(`✅ انضاف "${name}" للسلة`);
}

function removeFromCart(id) {
  saveCart(getCart().filter((i) => i.id !== id));
}

function renderCart() {
  const cart = getCart();
  const count = document.getElementById("cart-count");
  if (count) count.textContent = cart.reduce((s, i) => s + i.qty, 0);
  const box = document.getElementById("cart-items");
  if (!box) return;
  box.innerHTML = cart.length
    ? cart.map((i) => `
      <div class="cart-item">
        <div><b>${i.name}</b><br /><small style="color:var(--muted)">${i.qty} × ${i.price} ${i.cur || "DC"}</small></div>
        <button class="btn btn-danger" onclick="removeFromCart(${i.id})">✕</button>
      </div>`).join("")
    : `<p style="color:var(--muted)">سلتك فارغة</p>`;
  renderTotals();
}

function renderTotals() {
  const cart = getCart();
  const totalDC = cart.filter((i) => (i.cur || "DC") === "DC").reduce((s, i) => s + i.price * i.qty, 0);
  const totalDR = cart.filter((i) => i.cur === "DR").reduce((s, i) => s + i.price * i.qty, 0);
  const box = document.getElementById("cart-totals");
  if (!box) return;
  const pct = APPLIED_COUPON ? APPLIED_COUPON.percent : 0;
  let html = "";
  if (APPLIED_COUPON) html += `<div style="color:var(--orange);font-weight:700">🏷️ خصم ${pct}% (${APPLIED_COUPON.code})</div>`;
  const line = (total, cur) => {
    if (total <= 0) return "";
    if (!pct) return `<div class="cart-total">${total.toFixed(2)} ${cur}</div>`;
    const after = total * (1 - pct / 100);
    return `<div class="cart-total"><s style="color:var(--muted);font-size:.95rem">${total.toFixed(2)} ${cur}</s></div>
            <div class="cart-total" style="color:var(--red)">${after.toFixed(2)} ${cur}</div>`;
  };
  html += line(totalDC, "DC") + line(totalDR, "DR");
  if (totalDC <= 0 && totalDR <= 0) html = `<div class="cart-total">الإجمالي: 0 DC</div>`;
  box.innerHTML = html;
}

async function applyCoupon() {
  const input = document.getElementById("coupon-input");
  const code = (input.value || "").trim();
  if (!code) return toast("اكتب كود الخصم أول", true);
  const res = await fetch("/api/coupon/check?code=" + encodeURIComponent(code));
  const data = await res.json();
  if (data.valid) {
    APPLIED_COUPON = { code: code.toUpperCase(), percent: data.percent };
    toast(`✅ انطبق خصم ${data.percent}%`);
  } else {
    APPLIED_COUPON = null;
    toast("❌ كود الخصم غير صحيح", true);
  }
  renderTotals();
}

function toggleCart(open) {
  document.getElementById("cart-panel").classList.toggle("open", open);
}

document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  const btn = document.getElementById("cart-btn");
  if (btn) btn.onclick = () => toggleCart(true);
  const checkout = document.getElementById("checkout-btn");
  if (checkout) checkout.onclick = doCheckout;
  const couponBtn = document.getElementById("coupon-apply");
  if (couponBtn) couponBtn.onclick = applyCoupon;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible"));
  }, { threshold: 0.1 });
  document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
});

/* ---------- Ticket Checkout ---------- */
async function doCheckout() {
  const cart = getCart();
  if (!cart.length) return toast("سلتك فارغة!", true);
  if (!ME) { toast("سجل دخول بديسكورد أول 👇", true); setTimeout(() => location.href = "/auth/discord", 1200); return; }

  const btn = document.getElementById("checkout-btn");
  btn.disabled = true; btn.textContent = "جاري فتح التكت…";
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((i) => ({ id: i.id, qty: i.qty })),
        coupon: APPLIED_COUPON ? APPLIED_COUPON.code : "",
      }),
    });
    const data = await res.json();
    if (data.success) {
      saveCart([]);
      APPLIED_COUPON = null;
      toggleCart(false);
      toast(`🎫 انسجل طلبك #${data.orderId} — كمّل الشراء بالتكت`);
      const url = data.ticketUrl || CONFIG.ticket || CONFIG.invite;
      if (url) setTimeout(() => window.open(url, "_blank"), 900);
    } else {
      toast("❌ " + (data.error || "فشلت العملية"), true);
    }
  } catch (e) {
    toast("❌ صار خطأ، جرب مرة ثانية", true);
  } finally {
    btn.disabled = false; btn.textContent = "🎫 فتح تكت شراء";
  }
}
