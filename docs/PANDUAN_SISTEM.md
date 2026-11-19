# Panduan Sistem Pemesanan QR Kios & Auto-Print Bluetooth — Ayam Dubrak!

Aplikasi web modern untuk pemesanan F&B kios (Take Away Only) dengan auto-print ke printer thermal ESC/POS 58mm via Web Bluetooth API.

---

## 🍗 Fitur Utama

1. **Halaman Pelanggan (`/` & `/order`) — Mobile-First**
   - Katalog menu dengan navigasi kategori dinamis.
   - Modal kustomisasi menu:
     - **Pilihan Sambal (Wajib 1):** Radio selection (Sambal Korek, Sambal Matah, Sambal Ijo, dll).
     - **Add-ons Tambahan (Bebas Pilih):** Checkbox multi-select (Extra Moza, Extra Kol Goreng, Extra Telur, dll).
     - Catatan khusus per menu.
   - Form Checkout Pengambilan (Take Away):
     - Nama Pemesan & Nomor WhatsApp.
     - Tipe Pengambilan: *Ambil Sendiri* vs *Driver Ojol / Maxim*.
     - Waktu Pengambilan: *Sekarang (ASAP)* vs *Jadwalkan Jam Pickup*.
   - Layar Konfirmasi & Pelacakan:
     - Nomor Antrean Otomatis (Format: `#001`, `#002`).
     - Status real-time (Menunggu Bayar $\rightarrow$ Dimasak $\rightarrow$ Siap Diambil).
     - Tombol cepat **"Kirim Format ke WhatsApp Kios"**.
     - Info lokasi: *Jl Pramuka (belakang SMPN2)*.

2. **Halaman Kasir (`/kasir`) — Layar Tablet/Laptop**
   - Monitor antrean pesanan real-time.
   - **Notifikasi Suara:** Bunyi bel/chime otomatis saat ada order baru masuk.
   - **Koneksi Web Bluetooth API:** Tombol *Hubungkan Printer Bluetooth* untuk pairing langsung ke printer thermal portabel 58mm tanpa driver pihak ketiga.
   - **Modal Pembayaran Kasir:**
     - Pilihan metode: **Tunai (Cash)** dan **QRIS / Transfer**.
     - Kalkulator uang tunai & kembalian otomatis.
   - **Auto-Print ESC/POS:** Seketika kasir klik *"Lunas & Cetak Struk"*, printer Bluetooth langsung mencetak struk 32-kolom dengan layout rapi dan nomor antrean besar.

3. **Halaman Admin & Owner (`/admin`)**
   - **Rekap Omzet & Laporan Penjualan:** Total omzet lunas hari ini, total pesanan, breakdown pendapatan Tunai vs QRIS.
   - **Manajemen Menu & Stok:** Switch sakelar toggle *Tersedia / Habis* untuk menu, varian sambal, dan add-ons (mencegah pelanggan memesan bahan yang habis).

---

## 🖨️ Cara Menghubungkan Printer Bluetooth 58mm

1. Pastikan Bluetooth di laptop/tablet/HP kasir sudah aktif.
2. Nyalakan printer thermal portabel 58mm Anda (pastikan kertas 58mm terpasang).
3. Buka halaman `/kasir` menggunakan browser **Google Chrome** atau browser berbasis Chromium (karena Web Bluetooth API membutuhkan Chromium engine).
4. Klik tombol **"Hubungkan Printer Bluetooth"** di pojok kanan atas.
5. Pada pop-up browser, pilih nama printer Anda (misal: *MPT-II*, *RPP02N*, *Bluetooth Printer*, atau *InnerPrinter*) dan klik **Pair / Hubungkan**.
6. Status akan berubah menjadi hijau *(Terhubung)*. Setiap kali kasir mengonfirmasi pembayaran, struk akan otomatis tercetak!

---

## 🗄️ Menghubungkan ke Supabase (Database Produksi)

Skrip SQL lengkap sudah disiapkan di file [`supabase/schema.sql`](file:///c:/Users/Athallah/Documents/Projeect/dubrakapp/supabase/schema.sql):

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) dan buat proyek baru.
2. Masuk ke menu **SQL Editor**, buka file `supabase/schema.sql`, salin seluruh isinya, dan klik **Run**.
3. Buka menu **Project Settings > API**, salin:
   - `Project URL`
   - `anon public key`
   - `service_role secret key`
4. Buat file `.env.local` di root folder proyek ini:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
   ```
5. Restart server dengan `npm run dev`.

*(Catatan: Aplikasi ini juga sudah dilengkapi **Local Store Fallback**, sehingga Anda tetap bisa menguji coba seluruh alur pemesanan, kasir, dan cetak printer thermal secara instan di `localhost` bahkan sebelum Supabase dikonfigurasi!)*

---

## 🚀 Menjalankan Server Lokal

```bash
npm run dev
```

Buka URL di browser:
- Pelanggan: `http://localhost:3000/order`
- Kasir: `http://localhost:3000/kasir`
- Admin: `http://localhost:3000/admin`
