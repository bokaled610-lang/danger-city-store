/* ============ Danger City — Admin ============ */

let ALL_PRODUCTS = [];

let PERMS = [];
let IS_OWNER = false;
const can = (p) => IS_OWNER || PERMS.includes(p);

(async function init() {
  const res = await fetch("/api/me");
  const data = await res.json();
  if (!data.user) { location.href = "/auth/discord"; return; }
  if (!data.isAdmin) { location.href = "/"; return; }
  PERMS = data.perms || [];
  IS_OWNER = !!data.isOwner;

  // إخفاء الأزرار والتبويبات حسب الصلاحيات
  if (!can("product")) {
    const addBtn = document.querySelector('#tab-products > .btn');
    if (addBtn) addBtn.style.display = "none";
  }
  if (!IS_OWNER) {
    ["coupons", "settings"].forEach((t) => {
      const chip = document.querySelector(`.tabs .chip[data-tab="${t}"]`);
      if (chip) chip.style.display = "none";
    });
  }
  if (can("ranks")) {
    const hb = document.getElementById("hire-box");
    if (hb) hb.style.display = "block";
  }

  loadOverview();
  loadAdminProducts();
  loadAdminOrders();
  loadAdminUsers();
  loadStaff();
  if (IS_OWNER) loadCoupons();
  loadLogs();
  if (IS_OWNER) loadSettings();
})();

/* ---------- الإدارة (لوق + توظيف) ---------- */
const PERM_NAMES = { product: "إضافة منتج", ranks: "رتب وصلاحيات", xp: "إعطاء XP", ban: "حظر" };

async function loadStaff() {
  const res = await fetch("/api/admin/staff");
  const staff = await res.json();
  document.getElementById("staff-body").innerHTML = staff.length
    ? staff.map((st) => `
      <tr>
        <td style="color:var(--orange);font-weight:800">${st.owner ? "👑 " : ""}${st.rank}</td>
        <td style="color:var(--text)">${st.username || "—"}</td>
        <td>${st.discord_id}</td>
        <td>${st.owner ? "كل الصلاحيات" : ((st.perms || "").split(",").filter(Boolean).map((p) => PERM_NAMES[p] || p).join("، ") || "—")}</td>
        <td>${!st.owner && can("ranks") ? `
          <button class="btn" onclick="editStaff('${st.discord_id}', '${(st.rank || "").replace(/'/g, "\\'")}', ${st.rank_order}, '${st.perms || ""}')">تعديل</button>
          <button class="btn btn-danger" onclick="removeStaff(${st.id})">إزالة</button>` : ""}
        </td>
      </tr>`).join("")
    : `<tr><td colspan="5">ما فيه إداريين بعد</td></tr>`;
}

function editStaff(discordId, rank, order, perms) {
  document.getElementById("h-discord").value = discordId;
  document.getElementById("h-rank").value = rank;
  document.getElementById("h-order").value = order;
  const list = (perms || "").split(",");
  document.querySelectorAll(".h-perm").forEach((c) => (c.checked = list.includes(c.value)));
  document.getElementById("hire-box").scrollIntoView({ behavior: "smooth" });
}

async function hireStaff() {
  const discord_id = document.getElementById("h-discord").value.trim();
  const rank = document.getElementById("h-rank").value.trim();
  const rank_order = +document.getElementById("h-order").value || 100;
  const perms = [...document.querySelectorAll(".h-perm:checked")].map((c) => c.value);
  if (!discord_id || !rank) return toast("اكتب الآيدي والرتبة", true);
  const res = await fetch("/api/admin/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ discord_id, rank, rank_order, perms }),
  });
  const d = await res.json();
  if (res.ok) {
    toast("✅ انحفظ الإداري");
    document.getElementById("h-discord").value = "";
    document.getElementById("h-rank").value = "";
    document.getElementById("h-order").value = "";
    document.querySelectorAll(".h-perm").forEach((c) => (c.checked = false));
    loadStaff();
  } else toast("❌ " + (d.error || "فشل الحفظ"), true);
}

async function removeStaff(id) {
  if (!confirm("متأكد تبي تشيل هالإداري؟")) return;
  await fetch(`/api/admin/staff/${id}`, { method: "DELETE" });
  toast("🗑️ انشال الإداري");
  loadStaff();
}

/* ---------- Settings ---------- */
const SETTING_KEYS = ["announcement", "referral_xp", "welcome_xp", "xp_rate", "min_exchange"];

async function loadSettings() {
  const res = await fetch("/api/admin/settings");
  const st = await res.json();
  SETTING_KEYS.forEach((k) => {
    const el = document.getElementById("s-" + k);
    if (el) el.value = st[k] ?? "";
  });
  const btn = document.getElementById("settings-save");
  if (btn) btn.onclick = saveSettings;
}

async function saveSettings() {
  const body = {};
  SETTING_KEYS.forEach((k) => {
    const el = document.getElementById("s-" + k);
    if (el) body[k] = el.value;
  });
  const res = await fetch("/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) toast("✅ انحفظت الإعدادات");
  else toast("❌ فشل الحفظ", true);
}

/* Tabs */
document.querySelectorAll(".tabs .chip").forEach((c) => {
  c.onclick = () => {
    document.querySelectorAll(".tabs .chip").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((x) => x.classList.remove("active"));
    c.classList.add("active");
    document.getElementById("tab-" + c.dataset.tab).classList.add("active");
  };
});

async function loadOverview() {
  const res = await fetch("/api/admin/overview");
  const o = await res.json();
  document.getElementById("ov-users").textContent = o.users;
  document.getElementById("ov-orders").textContent = o.orders;
  document.getElementById("ov-revenue").textContent = o.revenue.toFixed(2) + " DC";
  document.getElementById("ov-products").textContent = o.products;
}

/* ---------- Products ---------- */
async function loadAdminProducts() {
  const res = await fetch("/api/products");
  ALL_PRODUCTS = await res.json();
  document.getElementById("products-body").innerHTML = ALL_PRODUCTS.map((p) => `
    <tr>
      <td>${p.id}</td>
      <td style="color:var(--text)">${p.name}</td>
      <td>${CATEGORY_NAMES[p.category] || p.category}</td>
      <td>${(+p.price).toFixed(2)}</td>
      <td style="color:var(--orange)">${p.currency || "DC"}</td>
      <td>${+p.discount || 0}%</td>
      <td>${p.featured ? "⭐" : "—"}</td>
      <td>
        <button class="btn" onclick="openProductModal(${p.id})">تعديل</button>
        <button class="btn btn-danger" onclick="deleteProduct(${p.id})">حذف</button>
      </td>
    </tr>`).join("");
}

function openProductModal(id) {
  const modal = document.getElementById("product-modal");
  const p = id ? ALL_PRODUCTS.find((x) => x.id === id) : null;
  document.getElementById("modal-title").textContent = p ? "تعديل منتج" : "إضافة منتج";
  document.getElementById("p-id").value = p ? p.id : "";
  document.getElementById("p-name").value = p ? p.name : "";
  document.getElementById("p-desc").value = p ? p.description : "";
  document.getElementById("p-cat").value = p ? p.category : "cars";
  document.getElementById("p-currency").value = p ? (p.currency || "DC") : "DC";
  document.getElementById("p-price").value = p ? p.price : "";
  document.getElementById("p-discount").value = p ? p.discount : 0;
  document.getElementById("p-image").value = p ? p.image : "";
  document.getElementById("p-featured").checked = p ? p.featured : false;
  modal.classList.add("open");
}
function closeProductModal() {
  document.getElementById("product-modal").classList.remove("open");
}

async function saveProduct() {
  const id = document.getElementById("p-id").value;
  const body = {
    name: document.getElementById("p-name").value.trim(),
    description: document.getElementById("p-desc").value.trim(),
    category: document.getElementById("p-cat").value,
    currency: document.getElementById("p-currency").value,
    price: +document.getElementById("p-price").value,
    discount: +document.getElementById("p-discount").value || 0,
    image: document.getElementById("p-image").value.trim(),
    featured: document.getElementById("p-featured").checked,
  };
  if (!body.name || !body.price) return toast("الاسم والسعر مطلوبين", true);

  const res = await fetch(id ? `/api/admin/products/${id}` : "/api/admin/products", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    toast("✅ تم الحفظ");
    closeProductModal();
    loadAdminProducts();
    loadOverview();
  } else toast("❌ فشل الحفظ", true);
}

async function deleteProduct(id) {
  if (!confirm("متأكد تبي تحذف المنتج؟")) return;
  await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
  toast("🗑️ انحذف المنتج");
  loadAdminProducts();
  loadOverview();
}

/* ---------- Orders ---------- */
async function loadAdminOrders() {
  const res = await fetch("/api/admin/orders");
  const orders = await res.json();
  document.getElementById("orders-body").innerHTML = orders.length
    ? orders.map((o) => `
      <tr>
        <td>#${o.id}</td>
        <td style="color:var(--text)">${o.username}</td>
        <td style="color:var(--orange)">${(+o.total).toFixed(2)} DC</td>
        <td>${o.status === "completed" ? "✅ مكتمل" : o.status === "ticket" ? "🎫 بانتظار التكت" : o.status}</td>
        <td>${new Date(o.created_at).toLocaleString("ar-KW")}</td>
      </tr>`).join("")
    : `<tr><td colspan="5">ما فيه طلبات</td></tr>`;
}

/* ---------- Users ---------- */
async function loadAdminUsers() {
  const res = await fetch("/api/admin/users");
  const users = await res.json();
  document.getElementById("users-body").innerHTML = users.map((u) => `
    <tr>
      <td>#${u.id}</td>
      <td style="color:var(--text)">${u.username}</td>
      <td>${u.discord_id}</td>
      <td style="color:var(--orange)">${(+u.dr_balance || 0).toFixed(2)}</td>
      <td>${u.xp}</td>
      <td>${u.rank}</td>
      <td>${u.banned ? "🚫 محظور" : "✅"}</td>
      <td style="white-space:nowrap">
        ${can("ranks") ? `<button class="btn" onclick="editUser(${u.id}, ${+u.dr_balance || 0}, '${(u.rank || "").replace(/'/g, "\\'")}')">رتبة</button>` : ""}
        ${can("xp") ? `<button class="btn" onclick="giveXp(${u.id})">+XP</button>` : ""}
        ${can("ban") ? `<button class="btn btn-danger" onclick="toggleBan(${u.id}, ${!u.banned})">${u.banned ? "فك الحظر" : "حظر"}</button>` : ""}
      </td>
    </tr>`).join("");
}

async function editUser(id, dr, rank) {
  const newRank = prompt("الرتبة الجديدة:", rank);
  if (newRank === null) return;
  const newDr = prompt("رصيد DR الجديد:", dr);
  if (newDr === null) return;
  const res = await fetch(`/api/admin/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dr_balance: +newDr, rank: newRank }),
  });
  const d = await res.json();
  if (res.ok) { toast("✅ تم التعديل"); loadAdminUsers(); }
  else toast("❌ " + (d.error || "فشل التعديل"), true);
}

async function giveXp(id) {
  const amount = prompt("كم XP تبي تعطيه؟ (رقم سالب للخصم)", "50");
  if (amount === null) return;
  const res = await fetch(`/api/admin/users/${id}/xp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: +amount }),
  });
  const d = await res.json();
  if (res.ok) { toast(`✅ صار عنده ${d.xp} XP`); loadAdminUsers(); }
  else toast("❌ " + (d.error || "فشل"), true);
}

async function toggleBan(id, banned) {
  if (banned && !confirm("متأكد تبي تحظر هاللاعب؟ ما راح يقدر يدخل الموقع")) return;
  const res = await fetch(`/api/admin/users/${id}/ban`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ banned }),
  });
  const d = await res.json();
  if (res.ok) { toast(banned ? "🚫 انحظر" : "✅ انفك الحظر"); loadAdminUsers(); }
  else toast("❌ " + (d.error || "فشل"), true);
}

/* ---------- Coupons ---------- */
async function loadCoupons() {
  const res = await fetch("/api/admin/coupons");
  const coupons = await res.json();
  document.getElementById("coupons-body").innerHTML = coupons.length
    ? coupons.map((c) => `
      <tr>
        <td style="color:var(--orange);font-family:'Changa'">${c.code}</td>
        <td>${+c.percent}%</td>
        <td>${c.active ? "✅ فعال" : "⛔ موقوف"}</td>
        <td>${c.active ? `<button class="btn btn-danger" onclick="deleteCoupon(${c.id})">إيقاف</button>` : ""}</td>
      </tr>`).join("")
    : `<tr><td colspan="4">ما فيه كوبونات</td></tr>`;
}

async function addCoupon() {
  const code = document.getElementById("coupon-code").value.trim();
  const percent = +document.getElementById("coupon-percent").value;
  if (!code || !percent) return toast("اكتب الكود والنسبة", true);
  await fetch("/api/admin/coupons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, percent }),
  });
  toast("✅ انضاف الكوبون");
  document.getElementById("coupon-code").value = "";
  document.getElementById("coupon-percent").value = "";
  loadCoupons();
}

async function deleteCoupon(id) {
  await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
  loadCoupons();
}

/* ---------- Logs ---------- */
async function loadLogs() {
  const res = await fetch("/api/admin/logs");
  const logs = await res.json();
  document.getElementById("logs-body").innerHTML = logs.length
    ? logs.map((l) => `
      <tr>
        <td style="color:var(--text)">${l.username || "—"}</td>
        <td>${l.action}</td>
        <td>${l.details}</td>
        <td>${new Date(l.created_at).toLocaleString("ar-KW")}</td>
      </tr>`).join("")
    : `<tr><td colspan="4">السجل فاضي</td></tr>`;
}
