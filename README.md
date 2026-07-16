# 🧡 Danger City Ultimate Store

متجر إلكتروني احترافي لسيرفر Danger City في FiveM — تصميم Dark برتقالي/أسود، تسجيل دخول Discord، قاعدة بيانات PostgreSQL، سلة مشتريات، لوحة حساب، ولوحة إدارة كاملة.

## المميزات
- 🔥 شاشة تحميل احترافية بعبارات متغيرة
- 🏠 صفحة رئيسية مع Hero وإحصائيات حية ومنتجات مميزة
- 🛒 متجر كامل: بحث + فلترة بالأقسام + خصومات + سلة + كوبونات
- 🔐 تسجيل دخول حقيقي عبر Discord OAuth (يحفظ بيانات اللاعب في قاعدة البيانات)
- 👤 لوحة حساب: رقم الحساب، الرصيد، XP، الرتبة، سجل المشتريات
- 🛠️ لوحة إدارة: منتجات (إضافة/تعديل/حذف)، طلبات، مستخدمين، كوبونات، إحصائيات، سجل عمليات
- 💾 كل شي محفوظ في PostgreSQL — ما فيه بيانات مؤقتة

## خطوات التشغيل على Railway

### 1) ارفع المشروع على GitHub
- سوّ Repository جديد وارفع كل ملفات المشروع

### 2) اربطه بـ Railway
- New Project → Deploy from GitHub Repo
- اختر الريبو حقك

### 3) أضف قاعدة البيانات
- من نفس المشروع: New → Database → PostgreSQL
- Railway بيولّد لك `DATABASE_URL` تلقائياً

### 4) أضف المتغيرات (Variables) على خدمة الموقع
انسخها من `.env.example`:
- `BASE_URL` → رابط موقعك من Railway (Settings → Domains → Generate Domain)
- `DATABASE_URL` → من خدمة PostgreSQL (Variables → DATABASE_URL) — استخدم `${{Postgres.DATABASE_URL}}`
- `SESSION_SECRET` → أي نص عشوائي طويل
- `DISCORD_CLIENT_ID` و `DISCORD_CLIENT_SECRET` → من Discord Developer Portal
- `DISCORD_REDIRECT_URI` → `https://رابط-موقعك/auth/discord/callback`
- `DISCORD_ADMIN_IDS` → الـ Discord ID حقك (عشان تفتح لك لوحة الإدارة)

### 5) إعداد Discord
- [Discord Developer Portal](https://discord.com/developers/applications) → New Application
- OAuth2 → Redirects → أضف نفس `DISCORD_REDIRECT_URI` بالضبط
- انسخ Client ID و Client Secret

### 6) تهيئة قاعدة البيانات (مرة وحدة)
من Railway → خدمة الموقع → Settings → أو من جهازك:
```bash
npm install
npm run initdb
```
> ينشئ الجداول ويضيف منتجات تجريبية تقدر تعدلها من لوحة الإدارة.

### 7) خلاص 🎉
افتح رابط موقعك — سجل دخول بديسكورد — وإذا حسابك ضمن `DISCORD_ADMIN_IDS` بتظهر لك "الإدارة" في القائمة.

## التشغيل محلياً
```bash
npm install
cp .env.example .env   # وعبّي القيم
npm run initdb
npm start
```
الموقع بيشتغل على http://localhost:3000

## ملاحظات
- الرصيد يضيفه الأدمن يدوياً من لوحة الإدارة (تعديل مستخدم) — بوابة الدفع الحقيقية خطوة مستقبلية
- كل عملية شراء تنحفظ في `orders` وتنخصم من رصيد اللاعب وتعطيه XP
- كوبون تجريبي جاهز: `DANGER10` (خصم 10%)
