import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ayam Dubrak! — Kios Pemesanan & Kasir",
  description: "Sistem Pemesanan Kios QR & Auto-Print Bluetooth 58mm Ayam Dubrak",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full antialiased">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#D9381E" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#FAF6F3] text-[#1C1917]">
        {children}
      </body>
    </html>
  );
}
