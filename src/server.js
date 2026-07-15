require("dotenv").config();
const express = require("express");
const session = require("express-session");
const PgStore = require("connect-pg-simple")(session);
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, "..", "public");

app.use(helmet({ contentSecurityPolicy:false }));
app.use(rateLimit({ windowMs:60000, limit:180 }));
app.use(express.json());
app.use(express.urlencoded({ extended:true }));
app.use(session({
  store:new PgStore({ pool:db.pool, tableName:"user_sessions", createTableIfMissing:true }),
  secret:process.env.SESSION_SECRET || "change-me",
  resave:false,
  saveUninitialized:false,
  cookie:{ httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV==="production", maxAge:1000*60*60*12 }
}));
app.use(express.static(PUBLIC));

async function ensureDevUser(req){
  if(req.session.user) return req.session.user;
  if(String(process.env.DEV_LOGIN_ENABLED).toLowerCase()!=="true") return null;
  try {
    const result=await db.query("SELECT * FROM users ORDER BY created_at LIMIT 1");
    req.session.user=result.rows[0]||null;
    return req.session.user;
  } catch (error) {
    console.error("Database not ready:", error.message);
    return null;
  }
}

app.get("/api/config", async (req,res)=>{
  const user=await ensureDevUser(req);
  res.json({
    user,
    currency:process.env.STORE_CURRENCY||"DC",
    ticketUrl:process.env.DISCORD_TICKET_URL||"https://discord.com",
    aiEnabled:String(process.env.AI_ENABLED).toLowerCase()==="true"
  });
});

app.get("/api/products", async (req,res)=>{
  const q=String(req.query.q||"").toLowerCase();
  const category=String(req.query.category||"");
  try {
    const result=await db.query(`
      SELECT * FROM products
      WHERE active=true
        AND ($1='' OR name ILIKE '%'||$1||'%' OR description ILIKE '%'||$1||'%')
        AND ($2='' OR category=$2)
      ORDER BY created_at DESC
    `,[q,category]);
    return res.json(result.rows);
  } catch (error) {
    const demo=[
      {id:"demo-1",name:"فيلا مونتانا الفاخرة",category:"house",description:"فيلا حديثة بمسبح وكراج خاص.",price:450000,image:"",tag:"حصري",rating:4.9},
      {id:"demo-2",name:"مقر شركة Eclipse",category:"hq",description:"مقر مجهز للشركات والفرق.",price:750000,image:"",tag:"جديد",rating:4.8},
      {id:"demo-3",name:"Bugatti Chiron",category:"car",description:"سيارة نادرة بأداء استثنائي.",price:2950000,image:"",tag:"الأكثر مبيعاً",rating:5.0},
      {id:"demo-4",name:"باقة البداية الذهبية",category:"bundle",description:"رصيد وسيارة وامتيازات بداية.",price:199000,image:"",tag:"عرض",rating:4.7}
    ];
    return res.json(demo.filter(p=>(!category||p.category===category)&&(!q||(`${p.name} ${p.description}`.toLowerCase().includes(q)))));
  }
});

app.get("/api/search/suggestions", async (req,res)=>{
  const q=String(req.query.q||"").trim();
  if(!q) return res.json([]);
  try {
    const result=await db.query(`
      SELECT id,name,category,price FROM products
      WHERE active=true AND name ILIKE '%'||$1||'%'
      ORDER BY rating DESC LIMIT 6
    `,[q]);
    res.json(result.rows);
  } catch (error) {
    res.json([]);
  }
});

app.get("/api/favorites", async (req,res)=>{
  const user=await ensureDevUser(req);
  if(!user) return res.status(401).json({error:"سجل دخولك"});
  const result=await db.query("SELECT product_id FROM favorites WHERE user_id=$1",[user.id]);
  res.json(result.rows.map(x=>x.product_id));
});

app.post("/api/favorites/:id", async (req,res)=>{
  const user=await ensureDevUser(req);
  if(!user) return res.status(401).json({error:"سجل دخولك"});
  await db.query(`INSERT INTO favorites(user_id,product_id) VALUES($1,$2)
    ON CONFLICT(user_id,product_id) DO NOTHING`,[user.id,req.params.id]);
  res.json({ok:true});
});

app.delete("/api/favorites/:id", async (req,res)=>{
  const user=await ensureDevUser(req);
  if(!user) return res.status(401).json({error:"سجل دخولك"});
  await db.query("DELETE FROM favorites WHERE user_id=$1 AND product_id=$2",[user.id,req.params.id]);
  res.json({ok:true});
});

app.get("/api/cart", async (req,res)=>{
  const user=await ensureDevUser(req);
  if(!user) return res.json([]);
  const result=await db.query(`
    SELECT c.product_id,c.quantity,p.name,p.price,p.image,p.category
    FROM carts c JOIN products p ON p.id=c.product_id
    WHERE c.user_id=$1 ORDER BY c.created_at DESC
  `,[user.id]);
  res.json(result.rows);
});

app.post("/api/cart/:id", async (req,res)=>{
  const user=await ensureDevUser(req);
  if(!user) return res.status(401).json({error:"سجل دخولك"});
  await db.query(`
    INSERT INTO carts(user_id,product_id,quantity) VALUES($1,$2,1)
    ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=carts.quantity+1
  `,[user.id,req.params.id]);
  res.json({ok:true});
});

app.delete("/api/cart/:id", async (req,res)=>{
  const user=await ensureDevUser(req);
  if(!user) return res.status(401).json({error:"سجل دخولك"});
  await db.query("DELETE FROM carts WHERE user_id=$1 AND product_id=$2",[user.id,req.params.id]);
  res.json({ok:true});
});

app.post("/api/orders/checkout", async (req,res)=>{
  const user=await ensureDevUser(req);
  if(!user) return res.status(401).json({error:"سجل دخولك"});
  const cart=await db.query(`
    SELECT c.quantity,p.id,p.name,p.price
    FROM carts c JOIN products p ON p.id=c.product_id
    WHERE c.user_id=$1
  `,[user.id]);
  if(!cart.rowCount) return res.status(400).json({error:"السلة فارغة"});
  const total=cart.rows.reduce((s,x)=>s+Number(x.price)*Number(x.quantity),0);
  const order=await db.query(`
    INSERT INTO orders(user_id,total,status,payment_method)
    VALUES($1,$2,'pending','ticket') RETURNING *
  `,[user.id,total]);
  for(const item of cart.rows){
    await db.query(`
      INSERT INTO order_items(order_id,product_id,product_name,price,quantity)
      VALUES($1,$2,$3,$4,$5)
    `,[order.rows[0].id,item.id,item.name,item.price,item.quantity]);
  }
  await db.query("DELETE FROM carts WHERE user_id=$1",[user.id]);
  await db.query(`
    INSERT INTO notifications(user_id,title,body)
    VALUES($1,'تم إنشاء الطلب',$2)
  `,[user.id,`طلبك رقم ${order.rows[0].id} جاهز لإكماله عبر التكت.`]);
  res.json({ok:true,order:order.rows[0],ticketUrl:process.env.DISCORD_TICKET_URL||"https://discord.com"});
});

app.get("/api/orders/my", async (req,res)=>{
  const user=await ensureDevUser(req);
  if(!user) return res.json([]);
  const result=await db.query("SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC",[user.id]);
  res.json(result.rows);
});

app.get("/api/notifications", async (req,res)=>{
  const user=await ensureDevUser(req);
  if(!user) return res.json([]);
  const result=await db.query("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",[user.id]);
  res.json(result.rows);
});

app.post("/api/rewards/spin", async (req,res)=>{
  const user=await ensureDevUser(req);
  if(!user) return res.status(401).json({error:"سجل دخولك"});
  const current=await db.query("SELECT daily_spin_at FROM users WHERE id=$1",[user.id]);
  const last=current.rows[0].daily_spin_at;
  if(last && Date.now()-new Date(last).getTime()<24*60*60*1000)
    return res.status(429).json({error:"تقدر تلف العجلة مرة كل 24 ساعة"});
  const rewards=[500,1000,2500,5000,10000];
  const reward=rewards[Math.floor(Math.random()*rewards.length)];
  await db.query("UPDATE users SET balance=balance+$1,xp=xp+50,daily_spin_at=NOW() WHERE id=$2",[reward,user.id]);
  await db.query(`
    INSERT INTO reward_history(user_id,reward_type,amount,description)
    VALUES($1,'daily_spin',$2,'مكافأة عجلة الحظ')
  `,[user.id,reward]);
  res.json({ok:true,reward});
});

app.post("/api/gift-cards/redeem", async (req,res)=>{
  const user=await ensureDevUser(req);
  if(!user) return res.status(401).json({error:"سجل دخولك"});
  const code=String(req.body.code||"").trim().toUpperCase();
  const result=await db.query("SELECT * FROM gift_cards WHERE code=$1 AND active=true AND used_by IS NULL",[code]);
  if(!result.rowCount) return res.status(404).json({error:"بطاقة غير صالحة"});
  const card=result.rows[0];
  await db.query("UPDATE gift_cards SET used_by=$1,used_at=NOW(),active=false WHERE id=$2",[user.id,card.id]);
  await db.query("UPDATE users SET balance=balance+$1 WHERE id=$2",[card.value,user.id]);
  res.json({ok:true,value:Number(card.value)});
});

app.get("/api/leaderboard", async (_,res)=>{
  const result=await db.query(`
    SELECT username,dc_account,xp,balance FROM users
    WHERE banned=false ORDER BY xp DESC LIMIT 10
  `);
  res.json(result.rows);
});

app.post("/api/support/message", async (req,res)=>{
  const user=await ensureDevUser(req);
  if(!user) return res.status(401).json({error:"سجل دخولك"});
  const content=String(req.body.content||"").trim().slice(0,1500);
  if(!content) return res.status(400).json({error:"اكتب رسالتك"});
  await db.query(`
    INSERT INTO support_messages(user_id,sender_type,content)
    VALUES($1,'user',$2)
  `,[user.id,content]);
  let answer="تم استلام رسالتك. إذا كانت المشكلة تتعلق بالشراء، افتح تكت المتجر وأرسل رقم حسابك.";
  if(String(process.env.AI_ENABLED).toLowerCase()==="true" && process.env.OPENAI_API_KEY){
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||"gpt-5-mini",
        instructions:`أنت دعم متجر Danger City. أجب بالعربية وباختصار. رقم حساب المستخدم ${user.dc_account}. لا تخترع معلومات. إذا لم تعرف اطلب فتح تكت.`,
        input:content,
        max_output_tokens:250,
        safety_identifier:crypto.createHash("sha256").update(String(user.discord_id||user.id)).digest("hex")
      })
    });
    const data=await response.json();
    if(response.ok) answer=data.output_text||answer;
  }
  await db.query(`
    INSERT INTO support_messages(user_id,sender_type,content)
    VALUES($1,'assistant',$2)
  `,[user.id,answer]);
  res.json({answer,ticketUrl:process.env.DISCORD_TICKET_URL||"https://discord.com"});
});

app.get("*",(_,res)=>res.sendFile(path.join(PUBLIC,"index.html")));
app.use((err,req,res,next)=>res.status(400).json({error:err.message||"حدث خطأ"}));
app.listen(PORT,()=>console.log(`Danger City Phase 8: http://localhost:${PORT}`));
