require("dotenv").config();
const express=require("express");
const session=require("express-session");
const PgStore=require("connect-pg-simple")(session);
const helmet=require("helmet");
const rateLimit=require("express-rate-limit");
const crypto=require("crypto");
const path=require("path");
const db=require("./src/db");

const app=express();
const PORT=Number(process.env.PORT||3000);
const BASE_URL=process.env.BASE_URL||`http://localhost:${PORT}`;
const PUBLIC=path.join(__dirname,"public");

app.set("trust proxy",1);
app.use(helmet({contentSecurityPolicy:false}));
app.use(rateLimit({windowMs:60000,limit:180}));
app.use(express.json());
app.use(express.urlencoded({extended:true}));

const sessionOptions={
  secret:process.env.SESSION_SECRET||"change-this-secret",
  resave:false,
  saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:1000*60*60*12}
};
if(process.env.DATABASE_URL){
  sessionOptions.store=new PgStore({pool:db.pool,tableName:"user_sessions",createTableIfMissing:true});
}
app.use(session(sessionOptions));
app.use(express.static(PUBLIC));

function requireLogin(req,res,next){
  if(!req.session.user)return res.status(401).json({error:"سجل دخولك عبر Discord"});
  next();
}
function requireAdmin(req,res,next){
  if(["owner","admin"].includes(req.session.user?.role))return next();
  res.status(403).json({error:"ليس لديك صلاحية الإدارة"});
}
async function nextDcAccount(){
  const r=await db.query("SELECT COALESCE(MAX(CAST(REPLACE(dc_account,'DC-','') AS INTEGER)),100000) AS max FROM users WHERE dc_account ~ '^DC-[0-9]+$'");
  return `DC-${Number(r.rows[0].max)+1}`;
}

app.get("/api/config",(req,res)=>res.json({
  user:req.session.user||null,
  currency:process.env.STORE_CURRENCY||"DC",
  ticketUrl:process.env.DISCORD_TICKET_URL||"https://discord.com",
  discordEnabled:Boolean(process.env.DISCORD_CLIENT_ID&&process.env.DISCORD_CLIENT_SECRET),
  isAdmin:["owner","admin"].includes(req.session.user?.role)
}));

app.get("/api/products",async(req,res)=>{
  try{
    const r=await db.query("SELECT * FROM products WHERE active=true ORDER BY created_at DESC");
    res.json(r.rows);
  }catch(e){res.status(500).json({error:"تعذر تحميل المنتجات"});}
});

app.get("/auth/discord",(req,res)=>{
  if(!process.env.DISCORD_CLIENT_ID||!process.env.DISCORD_CLIENT_SECRET)return res.status(503).send("Discord غير مهيأ");
  const state=crypto.randomBytes(16).toString("hex");
  req.session.oauthState=state;
  const redirectUri=process.env.DISCORD_REDIRECT_URI||`${BASE_URL}/auth/discord/callback`;
  const params=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,response_type:"code",redirect_uri:redirectUri,scope:"identify",state});
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get("/auth/discord/callback",async(req,res)=>{
  try{
    if(!req.query.code||req.query.state!==req.session.oauthState)return res.status(400).send("طلب غير صالح");
    const redirectUri=process.env.DISCORD_REDIRECT_URI||`${BASE_URL}/auth/discord/callback`;
    const tokenRes=await fetch("https://discord.com/api/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({
      client_id:process.env.DISCORD_CLIENT_ID,
      client_secret:process.env.DISCORD_CLIENT_SECRET,
      grant_type:"authorization_code",
      code:req.query.code,
      redirect_uri:redirectUri
    })});
    const token=await tokenRes.json();
    if(!token.access_token)throw new Error("Discord token failed");

    const profileRes=await fetch("https://discord.com/api/users/@me",{headers:{Authorization:`Bearer ${token.access_token}`}});
    const profile=await profileRes.json();

    let r=await db.query("SELECT * FROM users WHERE discord_id=$1",[profile.id]);
    let user=r.rows[0];
    const role=String(profile.id)===String(process.env.OWNER_DISCORD_ID)?"owner":(user?.role||"user");
    const username=profile.global_name||profile.username;
    const avatar=profile.avatar?`https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`:"";

    if(!user){
      const dcAccount=await nextDcAccount();
      r=await db.query("INSERT INTO users(discord_id,username,avatar,dc_account,role) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [profile.id,username,avatar,dcAccount,role]);
      user=r.rows[0];
    }else{
      r=await db.query("UPDATE users SET username=$1,avatar=$2,role=$3 WHERE id=$4 RETURNING *",
        [username,avatar,role,user.id]);
      user=r.rows[0];
    }
    req.session.user=user;
    res.redirect("/");
  }catch(e){
    console.error(e);
    res.status(500).send("فشل تسجيل الدخول عبر Discord");
  }
});

app.post("/auth/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.post("/api/orders",requireLogin,async(req,res)=>{
  const r=await db.query("SELECT * FROM products WHERE id=$1",[req.body.productId]);
  const p=r.rows[0];
  if(!p)return res.status(404).json({error:"المنتج غير موجود"});
  await db.query("INSERT INTO orders(user_id,product_id,product_name,amount) VALUES($1,$2,$3,$4)",
    [req.session.user.id,p.id,p.name,p.price]);
  res.json({ok:true,ticketUrl:process.env.DISCORD_TICKET_URL||"https://discord.com"});
});

app.get("/api/admin/users",requireLogin,requireAdmin,async(req,res)=>{
  const r=await db.query("SELECT id,username,dc_account,role,balance,created_at FROM users ORDER BY created_at DESC");
  res.json(r.rows);
});
app.put("/api/admin/users/:id",requireLogin,requireAdmin,async(req,res)=>{
  const allowed=["user","support","seller","admin"];
  const role=allowed.includes(req.body.role)?req.body.role:"user";
  const r=await db.query("UPDATE users SET role=$1,balance=$2 WHERE id=$3 RETURNING *",
    [role,Number(req.body.balance||0),req.params.id]);
  res.json({ok:true,user:r.rows[0]});
});
app.get("/admin",requireLogin,requireAdmin,(req,res)=>res.sendFile(path.join(PUBLIC,"admin.html")));
app.get("*",(req,res)=>res.sendFile(path.join(PUBLIC,"index.html")));
app.listen(PORT,()=>console.log(`Danger City Store running on port ${PORT}`));
