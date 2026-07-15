const $=s=>document.querySelector(s);
const icons={house:"🏡",hq:"🏢",car:"🏎️",bundle:"🎁"};
let config={},products=[],category="";
const money=n=>new Intl.NumberFormat("en-US").format(Number(n||0))+" "+(config.currency||"DC");
async function api(url,options={}){const r=await fetch(url,options);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"حدث خطأ");return d}
function toast(t){const x=$("#toast");x.textContent=t;x.style.display="block";setTimeout(()=>x.style.display="none",2000)}
async function boot(){[config,products]=await Promise.all([api("/api/config"),api("/api/products")]);renderAccount();const u=config.user||{};$("#dcAccount").textContent=u.dc_account||"—";$("#balance").textContent=money(u.balance||0);$("#role").textContent=u.role||"مستخدم";render()}
function renderAccount(){if(config.user){$("#account").innerHTML=`${config.isAdmin?`<a href="/admin">الإدارة</a>`:""}<button onclick="logout()">${config.user.username}</button>`}else{$("#account").innerHTML=config.discordEnabled?`<a href="/auth/discord">دخول Discord</a>`:`<button onclick="toast('أضف بيانات Discord في Railway')">دخول Discord</button>`}}
async function logout(){await api("/auth/logout",{method:"POST"});location.reload()} window.logout=logout;
function render(){const q=$("#search").value.toLowerCase();$("#products").innerHTML=products.filter(p=>(!category||p.category===category)&&(`${p.name} ${p.description}`.toLowerCase().includes(q))).map(p=>`<article class="card"><div class="photo">${icons[p.category]||"📦"}<span class="tag">${p.tag||"منتج"}</span></div><div class="body"><h3>${p.name}</h3><p>${p.description}</p><div class="price">${money(p.price)}</div><button class="buy" onclick="buy('${p.id}')">فتح تكت للشراء</button></div></article>`).join("")}
async function buy(id){if(!config.user)return location.href="/auth/discord";try{const d=await api("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId:id})});window.open(d.ticketUrl,"_blank")}catch(e){toast(e.message)}} window.buy=buy;
document.querySelectorAll("[data-category]").forEach(b=>b.onclick=()=>{category=b.dataset.category;render()});
$("#search").oninput=render;
boot().catch(e=>toast(e.message));
