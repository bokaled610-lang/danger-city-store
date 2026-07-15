CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT UNIQUE,
  username TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  dc_account TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  balance BIGINT NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES users(id),
  daily_spin_at TIMESTAMPTZ,
  banned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  price BIGINT NOT NULL CHECK(price >= 0),
  image TEXT DEFAULT '',
  tag TEXT DEFAULT 'جديد',
  rating NUMERIC(2,1) NOT NULL DEFAULT 4.8,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id,product_id)
);

CREATE TABLE IF NOT EXISTS carts (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id,product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  total BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT DEFAULT 'ticket',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  price BIGINT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  value BIGINT NOT NULL,
  used_by UUID REFERENCES users(id),
  used_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users(username,dc_account,role,balance,xp,referral_code)
SELECT 'Rashed','DC-100001','owner',125000,4200,'RASHEDDC'
WHERE NOT EXISTS (SELECT 1 FROM users);

INSERT INTO products(name,category,description,price,tag,rating)
SELECT * FROM (VALUES
 ('فيلا مونتانا الفاخرة','house','فيلا حديثة بمسبح وكراج خاص.',450000,'حصري',4.9),
 ('مقر شركة Eclipse','hq','مقر مجهز للشركات والفرق.',750000,'جديد',4.8),
 ('Bugatti Chiron','car','سيارة نادرة بأداء استثنائي.',2950000,'الأكثر مبيعاً',5.0),
 ('باقة البداية الذهبية','bundle','رصيد وسيارة وامتيازات بداية.',199000,'عرض',4.7),
 ('Lamborghini Aventador','car','سيارة رياضية حصرية.',1850000,'مميز',4.9),
 ('بيت الشاطئ الملكي','house','إطلالة بحرية ومواقف خاصة.',820000,'فاخر',4.8)
) AS seed(name,category,description,price,tag,rating)
WHERE NOT EXISTS (SELECT 1 FROM products);
