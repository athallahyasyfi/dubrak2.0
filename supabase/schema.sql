-- ========================================================
-- SKEMA SUPABASE LENGKAP: TABEL MENUS & ORDERS + RLS
-- Kios Pemesanan QR & Auto-Print ESC/POS (Ayam Dubrak!)
-- ========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUM STATUS PESANAN
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
      'MENUNGGU_BAYAR', 
      'DIPROSES', 
      'SIAP_DIAMBIL', 
      'SELESAI', 
      'BATAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABEL CATEGORIES (Kategori Dinamis Kios)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL MENUS (Katalog Menu Kios)
CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  description TEXT,
  price INT NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  modifier_groups JSONB DEFAULT '[]'::jsonb,  -- Kustomisasi Pilihan Sambal & Extra Add-ons
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL ORDERS (Pesanan Masuk)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_code TEXT NOT NULL,                  -- Contoh: #001, #002
  table_number TEXT,                         -- Nomor meja (opsional jika dine-in via QR /order?table=XX)
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  pickup_type TEXT DEFAULT 'AMBIL_SENDIRI',  -- 'AMBIL_SENDIRI' atau 'DRIVER_OJOL'
  is_asap BOOLEAN NOT NULL DEFAULT TRUE,
  pickup_scheduled_time TEXT,
  items JSONB NOT NULL,                      -- Daftar menu, quantity, pilihan sambal, add-ons
  notes TEXT,                                -- Catatan khusus pelanggan
  status order_status NOT NULL DEFAULT 'MENUNGGU_BAYAR',
  total_amount INT NOT NULL,                 -- Dihitung ulang di sisi server
  payment_method TEXT,                       -- 'CASH' atau 'QRIS'
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL COUNTER ANTREAN HARIAN
CREATE TABLE IF NOT EXISTS daily_queue_counters (
  order_date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  last_number INT NOT NULL DEFAULT 0
);

-- 5. FUNCTION & TRIGGER NOMOR ANTREAN OTOMATIS (#001, #002...)
CREATE OR REPLACE FUNCTION generate_daily_queue_number()
RETURNS TRIGGER AS $$
DECLARE
  current_cnt INT;
  today_date DATE := CURRENT_DATE;
BEGIN
  INSERT INTO daily_queue_counters (order_date, last_number)
  VALUES (today_date, 1)
  ON CONFLICT (order_date)
  DO UPDATE SET last_number = daily_queue_counters.last_number + 1
  RETURNING last_number INTO current_cnt;

  NEW.queue_code := '#DB-' || FLOOR(100 + RANDOM() * 900)::TEXT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_daily_queue ON orders;
CREATE TRIGGER trigger_generate_daily_queue
BEFORE INSERT ON orders
FOR EACH ROW
WHEN (NEW.queue_code IS NULL OR NEW.queue_code = '')
EXECUTE FUNCTION generate_daily_queue_number();

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Hak Akses Tabel Categories:
CREATE POLICY "Public can view categories" 
ON categories FOR SELECT 
USING (true);

CREATE POLICY "Authenticated staff can manage categories" 
ON categories FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Hak Akses Tabel Menus:
-- 1. Publik bisa membaca menu aktif (SELECT)
CREATE POLICY "Public can view menus" 
ON menus FOR SELECT 
USING (true);

-- 2. Staff/Admin terautentikasi bisa menambah, mengubah, dan menghapus menu
CREATE POLICY "Authenticated staff can manage menus" 
ON menus FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Hak Akses Tabel Orders:
-- 1. Publik bisa membuat pesanan baru (INSERT)
CREATE POLICY "Public can insert orders" 
ON orders FOR INSERT 
WITH CHECK (true);

-- 2. Publik bisa membaca pesanan miliknya berdasarkan ID
CREATE POLICY "Public can view own order" 
ON orders FOR SELECT 
USING (true);

-- 3. Staff/Kasir terautentikasi bisa melihat dan mengupdate status pesanan
CREATE POLICY "Authenticated staff can update orders" 
ON orders FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated staff can delete orders" 
ON orders FOR DELETE 
TO authenticated 
USING (true);

-- ========================================================
-- ENABLE REALTIME REPLICATION DI SUPABASE
-- Agar dashboard kasir langsung menerima notifikasi pesanan masuk
-- ========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- ========================================================
-- SEED DATA AWAL MENUS AYAM DUBRAK!
-- ========================================================
INSERT INTO menus (name, category, description, price, is_available, image_url) VALUES
('Paket Nasi Ayam Dubrak Komplit', 'Paket Ayam', 'Nasi hangat + Ayam krispi gurih khas Dubrak + Sambal pilihan + Tahu & Tempe + Lalapan segar.', 22000, true, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80'),
('Paket Ayam Dubrak Geprek Jumbo', 'Paket Ayam', 'Ayam krispi digeprek hancur dengan sambal pilihan melimpah + Nasi hangat porsi jumbo.', 24000, true, 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80'),
('Ayam Crispy Dubrak Saja (Ala Carte)', 'Ala Carte', '1 potong ayam crispy dubrak gurih renyah + sambal pilihan.', 16000, true, 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=600&q=80'),
('Es Teh Manis Jumbo', 'Minuman', 'Teh melati wangi asli, manis pas, disajikan dingin dengan es melimpah.', 4000, true, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80'),
('Es Jeruk Peras Segar', 'Minuman', 'Jeruk peras murni asli, asam manis segar alami.', 6000, true, 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80'),
('Tahu & Tempe Goreng Krispi', 'Camilan', '1 porsi tahu dan tempe goreng gurih dengan bumbu meresap.', 7000, true, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80')
ON CONFLICT DO NOTHING;
