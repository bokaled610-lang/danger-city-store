<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Danger City Ultimate Store</title>
<link rel="icon" href="/assets/dg-logo.jpeg">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div id="loader"><img src="/assets/dg-logo.jpeg"><span>جاري تجهيز مدينة الخطر...</span></div>

<header>
  <a class="brand" href="/"><img src="/assets/dg-logo.jpeg"><div><b>DANGER <em>CITY</em></b><small>ULTIMATE STORE</small></div></a>
  <nav><button data-cat="">الرئيسية</button><button data-cat="house">البيوت</button><button data-cat="hq">المقرات</button><button data-cat="car">السيارات</button><button data-cat="bundle">الباقات</button></nav>
  <div class="header-actions">
    <button onclick="openPanel('notifications')">🔔</button>
    <button onclick="openPanel('favorites')">♡</button>
    <button onclick="openPanel('cart')">🛒 <span id="cartCount">0</span></button>
    <div id="account"></div>
  </div>
</header>

<main>
<section class="hero">
  <div class="hero-copy">
    <span class="eyebrow">المتجر الرسمي لـ Danger City</span>
    <h1>عيش التجربة<br><em>بأسلوب مختلف</em></h1>
    <p>متجر متكامل للسيارات والبيوت والمقرات والباقات، مع مكافآت ودعم ذكي وتجربة شراء سريعة.</p>
    <div class="hero-buttons"><button class="primary" onclick="document.querySelector('#store').scrollIntoView()">استكشف المتجر</button><button class="ghost" onclick="openRewards()">المكافآت اليومية</button></div>
  </div>
  <div class="hero-logo"><img src="/assets/dg-logo.jpeg"></div>
</section>

<section class="profile-strip">
  <div><small>رقم الحساب</small><b id="dcAccount">—</b></div>
  <div><small>الرصيد</small><b id="balance">0 DC</b></div>
  <div><small>نقاط الولاء</small><b id="xp">0 XP</b></div>
  <div><small>الرتبة</small><b id="role">مستخدم</b></div>
</section>

<section class="smart-search">
  <input id="search" placeholder="ابحث عن سيارة، بيت، مقر أو باقة...">
  <div id="suggestions" class="suggestions hidden"></div>
</section>

<section id="store">
  <div class="section-head"><h2>المنتجات المميزة</h2><button onclick="openLeaderboard()">أفضل المشترين</button></div>
  <div id="products" class="grid"></div>
</section>
</main>

<button class="support-toggle" onclick="toggleSupport()">💬</button>
<section id="supportBox" class="support-box hidden">
  <header><img src="/assets/dg-logo.jpeg"><div><b>دعم Danger City</b><small>متصل الآن</small></div><button onclick="toggleSupport()">×</button></header>
  <div id="supportMessages" class="support-messages"><div class="bot">هلا فيك، شلون أقدر أساعدك؟</div></div>
  <form id="supportForm"><input id="supportInput" placeholder="اكتب مشكلتك..."><button>إرسال</button></form>
  <a id="ticketLink" target="_blank">فتح تكت Discord</a>
</section>

<div id="sidePanel" class="side-panel hidden">
  <header><h2 id="panelTitle"></h2><button onclick="closePanel()">×</button></header>
  <div id="panelContent"></div>
</div>

<div id="rewardModal" class="overlay hidden"><div class="modal"><button class="close" onclick="closeModal('rewardModal')">×</button><img class="modal-logo" src="/assets/dg-logo.jpeg"><h2>عجلة الحظ اليومية</h2><div class="wheel">DC</div><button class="primary full" onclick="spinWheel()">لف العجلة</button><hr><h3>استبدال بطاقة هدية</h3><input id="giftCode" placeholder="أدخل كود البطاقة"><button class="ghost full" onclick="redeemGift()">استبدال</button></div></div>

<div id="leaderboardModal" class="overlay hidden"><div class="modal wide"><button class="close" onclick="closeModal('leaderboardModal')">×</button><h2>لوحة أفضل اللاعبين</h2><div id="leaderboard"></div></div></div>

<div id="toast"></div>
<script src="/app.js"></script>
</body>
</html>