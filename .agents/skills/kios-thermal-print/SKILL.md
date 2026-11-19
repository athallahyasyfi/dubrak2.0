---
name: kios-thermal-print
description: Arsitektur sistem pemesanan QR kios berbasis web dengan real-time dashboard, cetak struk printer thermal ESC/POS, dan keamanan OWASP.
---

# Aturan Pengembangan Sistem Kios QR

## 1. Tech Stack & Tampilan
- Gunakan Next.js (App Router) + TypeScript + Tailwind CSS.
- Gunakan Supabase untuk database, autentikasi kasir, dan Realtime subscription.
- Halaman pelanggan (`/order?table=XX`) wajib mobile-first (rapi di layar HP).
- Halaman kasir (`/kasir`) optimal untuk layar tablet/laptop dengan notifikasi suara saat pesanan masuk.

## 2. Cetak Printer Thermal (ESC/POS)
- Sediakan tombol "Hubungkan Printer" di `/kasir` via WebUSB / WebBluetooth API.
- Format struk menggunakan `esc-pos-encoder` (nama kios, nomor meja, daftar menu, catatan, total harga, waktu).
- Sediakan sakelar *Auto-Print* otomatis saat ada pesanan baru masuk.

## 3. Keamanan Wajib (OWASP & Anti-Spam)
- Kunci halaman `/kasir` dan `/admin` dengan sistem login (Supabase Auth).
- Validasi dan sanitasi semua input pelanggan (nama, catatan) dengan `zod` di server; dilarang pakai `dangerouslySetInnerHTML` (mencegah XSS).
- Gunakan SDK Supabase resmi untuk mencegah SQL Injection.
- Hitung ulang total harga di sisi server berdasarkan database (jangan percaya total harga dari browser pelanggan).
- Terapkan *rate limiting* sederhana agar satu perangkat tidak bisa melakukan spam pesanan.
- Aktifkan Row Level Security (RLS): publik hanya bisa baca menu (`SELECT`) dan kirim pesanan (`INSERT`).
