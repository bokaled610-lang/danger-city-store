/* ============ Danger City — Admin ============ */

let ALL_PRODUCTS = [];

(async function init() {
  const res = await fetch("/api/me");
  const data = await res.json();
  if (!data.user) { location.href = "/auth/discord"; return; }
  if (!data.isAdmin) { location.href = "/"; return; }

  loadOverview();
  loadAdminProducts();
  loadAdminOrders();
  loadAdminUsers();
  loadCoupons();
  loadLogs();
})();

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
  document.getElementById("ov-revenue").textContent = o.revenue.toFixed(2) + "$";
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
      <td>${(+p.price).toFixed(2)}$</td>
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
        <td style="color:var(--orange)">${(+o.total).toFixed(2)}$</td>
        <td>${o.status === "completed" ? "✅ مكتمل" : o.status}</td>
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
      <td>${(+u.balance).toFixed(2)}$</td>
      <td>${u.xp}</td>
      <td>${u.rank}</td>
      <td><button class="btn" onclick="editUser(${u.id}, ${+u.balance}, '${u.rank}')">تعديل</button></td>
    </tr>`).join("");
}

async function editUser(id, balance, rank) {
  const newBalance = prompt("الرصيد الجديد:", balance);
  if (newBalance === null) return;
  const newRank = prompt("الرتبة الجديدة:", rank);
  if (newRank === null) return;
  const res = await fetch(`/api/admin/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ balance: +newBalance, rank: newRank }),
  });
  if (res.ok) { toast("✅ تم التعديل"); loadAdminUsers(); }
  else toast("❌ فشل التعديل", true);
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
