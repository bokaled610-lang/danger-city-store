# Danger City Store v1

هذه نسخة نظيفة وجاهزة للرفع إلى GitHub وRailway.

## مهم عند الرفع إلى GitHub
ارفع المجلدات كما هي:

- `public`
- `src`
- `sql`
- `scripts`
- `package.json`
- `railway.toml`
- `.env.example`

لا تضع ملفات `public` أو `src` في الصفحة الرئيسية للمستودع.

## Railway
أضف المتغيرات التالية داخل Variables:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=اكتب قيمة طويلة وعشوائية
BASE_URL=https://رابط-موقعك.up.railway.app
DISCORD_REDIRECT_URI=https://رابط-موقعك.up.railway.app/auth/discord/callback
STORE_CURRENCY=DC
DEV_LOGIN_ENABLED=true
```

ثم شغل تهيئة قاعدة البيانات:

```bash
npm run db:init
```

بعد ربط Discord الحقيقي غيّر:

```text
DEV_LOGIN_ENABLED=false
```
