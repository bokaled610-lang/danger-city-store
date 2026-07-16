/* ============ Danger City — Shared JS ============ */

const CATEGORY_ICONS = {
  cars: "🏎️", houses: "🏠", coins: "🪙", ranks: "👑",
  bundles: "🎁", hq: "🏢", perks: "⚡", services: "🛠️",
};
const CATEGORY_NAMES = {
  cars: "سيارات", houses: "بيوت", coins: "عملات", ranks: "رتب",
  bundles: "باقات", hq: "مقرات", perks: "مزايا", services: "خدمات",
};

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
    progress = Math.min(100, progress + Math.random() * 22);
    fill.style.width = progress + "%";
    if (progress >= 100) {
      clearInterval(bInt); clearInterval(pInt);
      setTimeout(() => el.classList.add("hidden"), 350);
    }
  }, 320);
})();

/* ---------- Toast ---------- */
function toast(msg, isError = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = isError ? "error show" : "show";
  setTimeout(() => t.classList.remove("show"), 3000);
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
        <span class="price">${final}$${+p.discount > 0 ? `<s>${price.toFixed(2)}$</s>` : ""}</span>
        <button class="btn btn-primary" onclick="addToCart(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${final})">أضف للسلة</button>
      </div>
    </div>
  </div>`;
}

/* ---------- Cart (localStorage) ---------- */
function getCart() { return JSON.parse(localStorage.getItem("dc_cart") || "[]"); }
function saveCart(c) { localStorage.setItem("dc_cart", JSON.stringify(c)); renderCart(); }

function addToCart(id, name, price) {
  const cart = getCart();
  const item = cart.find((i) => i.id === id);
  if (item) item.qty++;
  else cart.push({ id, name, price, qty: 1 });
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
        <div><b>${i.name}</b><br /><small style="color:var(--muted)">${i.qty} × ${i.price}$</small></div>
        <button class="btn btn-danger" onclick="removeFromCart(${i.id})">✕</button>
      </div>`).join("")
    : `<p style="color:var(--muted)">سلتك فارغة</p>`;
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalEl = document.getElementById("cart-total");
  if (totalEl) totalEl.textContent = total.toFixed(2);
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

  // reveal on scroll
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible"));
  }, { threshold: 0.1 });
  document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
});

/* ---------- Checkout ---------- */
async function doCheckout() {
  const cart = getCart();
  if (!cart.length) return toast("سلتك فارغة!", true);
  if (!ME) { toast("سجل دخول بديسكورد أول 👇", true); setTimeout(() => location.href = "/auth/discord", 1200); return; }

  const btn = document.getElementById("checkout-btn");
  btn.disabled = true; btn.textContent = "جاري الشراء…";
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((i) => ({ id: i.id, qty: i.qty })),
        coupon: (document.getElementById("coupon-input")?.value || "").trim(),
      }),
    });
    const data = await res.json();
    if (data.success) {
      saveCart([]);
      toggleCart(false);
      toast(`🎉 تم الشراء! رقم طلبك #${data.orderId}`);
    } else {
      toast("❌ " + (data.error || "فشلت العملية"), true);
    }
  } catch (e) {
    toast("❌ صار خطأ، جرب مرة ثانية", true);
  } finally {
    btn.disabled = false; btn.textContent = "إتمام الشراء";
  }
}
