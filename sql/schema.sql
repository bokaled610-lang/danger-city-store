CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT UNIQUE,
  username TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  dc_account TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  balance BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  price BIGINT NOT NULL CHECK(price >= 0),
  tag TEXT DEFAULT 'جديد',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  amount BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users(username, dc_account, role, balance)
SELECT 'Rashed', 'DC-100001', 'owner', 125000
WHERE NOT EXISTS (SELECT 1 FROM users);

INSERT INTO products(name, category, description, price, tag)
SELECT * FROM (VALUES
 ('فيلا مونتانا الفاخرة','house','فيلا حديثة بمسبح خاص وكراج واسع.',450000,'حصري'),
 ('مقر شركة Eclipse','hq','مقر مجهز للشركات والفرق.',750000,'جديد'),
 ('Bugatti Chiron','car','سيارة نادرة بأداء استثنائي.',2950000,'الأكثر مبيعاً'),
 ('باقة البداية الذهبية','bundle','رصيد وسيارة وامتيازات بداية.',199000,'عرض')
) AS seed(name,category,description,price,tag)
WHERE NOT EXISTS (SELECT 1 FROM products);
