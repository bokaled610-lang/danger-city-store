const $=s=>document.querySelector(s);
const icons={house:"🏡",hq:"🏢",car:"🏎️",bundle:"🎁"};
let config={},products=[],favorites=[],cart=[],category="";
const money=n=>new Intl.NumberFormat("en-US").format(Number(n||0))+" "+(config.currency||"DC");
async function api(url,options={}){const r=await fetch(url,options);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"حدث خطأ");return d}
function toast(t){let x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2100)}
async function boot(){
  try {
    config=await api("/api/config");
    products=await api("/api/products");
    if(config.user){
      [favorites,cart]=await Promise.all([api("/api/favorites"),api("/api/cart")]);
    }else{
      favorites=[];cart=[];
    }
    renderAccount();renderProducts();updateProfile();updateCart();$("#ticketLink").href=config.ticketUrl;
  } finally {
    setTimeout(()=>{if($("#loader")){ $("#loader").style.opacity="0";setTimeout(()=>$("#loader")?.remove(),500)}},400);
  }
}
function renderAccount(){$("#account").innerHTML=config.user?`<button>${config.user.username}</button>`:`<button onclick="location.href='/auth/discord'">دخول Discord</button>`}
function updateProfile(){let u=config.user||{};$("#dcAccount").textContent=u.dc_account||"—";$("#balance").textContent=money(u.balance||0);$("#xp").textContent=(u.xp||0)+" XP";$("#role").textContent=u.role||"مستخدم"}
function updateCart(){$("#cartCount").textContent=cart.reduce((s,x)=>s+Number(x.quantity),0)}
function renderProducts(){let q=$("#search").value.toLowerCase();$("#products").innerHTML=products.filter(p=>(!category||p.category===category)&&(`${p.name} ${p.description}`.toLowerCase().includes(q))).map(p=>`<article class="card"><div class="photo" style="${p.image?`background-image:url('${p.image}')`:''}">${p.image?"":icons[p.category]}<span class="tag">${p.tag}</span></div><div class="card-body"><h3>${p.name}</h3><p>${p.description}</p><div class="rating">⭐ ${p.rating}</div><div class="price">${money(p.price)}</div><div class="card-actions"><button class="add" onclick="addCart('${p.id}')">إضافة للسلة</button><button class="fav" onclick="toggleFavorite('${p.id}')">${favorites.includes(p.id)?"♥":"♡"}</button></div></div></article>`).join("")}
async function addCart(id){await api("/api/cart/"+id,{method:"POST"});cart=await api("/api/cart");updateCart();toast("تمت إضافة المنتج للسلة")}window.addCart=addCart;
async function toggleFavorite(id){if(favorites.includes(id)){await api("/api/favorites/"+id,{method:"DELETE"});favorites=favorites.filter(x=>x!==id)}else{await api("/api/favorites/"+id,{method:"POST"});favorites.push(id)}renderProducts()}window.toggleFavorite=toggleFavorite;
async function openPanel(type){let title="",html="";if(type==="cart"){title="سلة المشتريات";html=cart.map(x=>`<div class="item"><div class="item-icon">${icons[x.category]}</div><div><b>${x.name}</b><small>${x.quantity} × ${money(x.price)}</small></div><button onclick="removeCart('${x.product_id}')">حذف</button></div>`).join("")||"السلة فارغة";if(cart.length)html+=`<button class="primary full" onclick="checkoutCart()">إكمال الطلب</button>`}if(type==="favorites"){title="المفضلة";html=products.filter(p=>favorites.includes(p.id)).map(p=>`<div class="item"><div class="item-icon">${icons[p.category]}</div><div><b>${p.name}</b><small>${money(p.price)}</small></div></div>`).join("")||"لا توجد مفضلة"}if(type==="notifications"){title="الإشعارات";let n=await api("/api/notifications");html=n.map(x=>`<div class="item"><div class="item-icon">🔔</div><div><b>${x.title}</b><small>${x.body}</small></div></div>`).join("")||"لا توجد إشعارات"}$("#panelTitle").textContent=title;$("#panelContent").innerHTML=html;$("#sidePanel").classList.remove("hidden")}window.openPanel=openPanel;
function closePanel(){$("#sidePanel").classList.add("hidden")}window.closePanel=closePanel;
async function removeCart(id){await api("/api/cart/"+id,{method:"DELETE"});cart=await api("/api/cart");updateCart();openPanel("cart")}window.removeCart=removeCart;
async function checkoutCart(){let d=await api("/api/orders/checkout",{method:"POST"});cart=[];updateCart();closePanel();toast("تم إنشاء الطلب");window.open(d.ticketUrl,"_blank")}window.checkoutCart=checkoutCart;
function openRewards(){$("#rewardModal").classList.remove("hidden")}window.openRewards=openRewards;
async function spinWheel(){try{let d=await api("/api/rewards/spin",{method:"POST"});toast(`ربحت ${money(d.reward)}`);config=await api("/api/config");updateProfile()}catch(e){toast(e.message)}}window.spinWheel=spinWheel;
async function redeemGift(){try{let d=await api("/api/gift-cards/redeem",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:$("#giftCode").value})});toast(`تم إضافة ${money(d.value)}`)}catch(e){toast(e.message)}}window.redeemGift=redeemGift;
async function openLeaderboard(){let d=await api("/api/leaderboard");$("#leaderboard").innerHTML=d.map((u,i)=>`<div class="rank"><div class="rank-num">${i+1}</div><div><b>${u.username}</b><small>${u.dc_account}</small></div><span>${u.xp} XP</span></div>`).join("");$("#leaderboardModal").classList.remove("hidden")}window.openLeaderboard=openLeaderboard;
function closeModal(id){$("#"+id).classList.add("hidden")}window.closeModal=closeModal;
function toggleSupport(){$("#supportBox").classList.toggle("hidden")}window.toggleSupport=toggleSupport;
$("#supportForm").onsubmit=async e=>{e.preventDefault();let msg=$("#supportInput").value.trim();if(!msg)return;$("#supportMessages").insertAdjacentHTML("beforeend",`<div class="me">${msg}</div>`);$("#supportInput").value="";try{let d=await api("/api/support/message",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:msg})});$("#supportMessages").insertAdjacentHTML("beforeend",`<div class="bot">${d.answer}</div>`)}catch(e){toast(e.message)}}
$("#search").oninput=async()=>{let q=$("#search").value.trim();renderProducts();if(!q)return $("#suggestions").classList.add("hidden");let d=await api("/api/search/suggestions?q="+encodeURIComponent(q));$("#suggestions").innerHTML=d.map(x=>`<button onclick="document.querySelector('#search').value='${x.name}';renderProducts();document.querySelector('#suggestions').classList.add('hidden')"><span>${x.name}</span><b>${money(x.price)}</b></button>`).join("");$("#suggestions").classList.toggle("hidden",!d.length)}
document.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{category=b.dataset.cat;renderProducts()});
boot().catch(e=>toast(e.message));
