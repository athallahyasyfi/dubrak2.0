'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Order } from '@/types';
import { AlertCircle, MapPin, ArrowLeft, Send, MessageCircle, QrCode, Banknote } from 'lucide-react';
import Link from 'next/link';

function OrderDetailContent() {
  const params = useParams();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrder = async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders?id=${orderId}`);
      if (!res.ok) throw new Error('Pesanan tidak ditemukan');
      const data = await res.json();
      setOrder(data.order);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat pesanan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 4000);
    return () => clearInterval(interval);
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6F3] p-4">
        <div className="text-center space-y-2">
          <div className="w-6 h-6 border-2 border-[#D9381E] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-[#78716C]">Memuat status pesanan...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6F3] p-4">
        <div className="max-w-md w-full bg-white rounded-lg p-6 text-center space-y-4 border border-[#E6DCD5] shadow-xs">
          <AlertCircle className="w-8 h-8 text-[#78716C] mx-auto" />
          <h2 className="text-base font-semibold text-[#1C1917]">
            Pesanan Tidak Ditemukan
          </h2>
          <p className="text-xs text-[#78716C]">{error || 'ID pesanan tidak valid.'}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#D9381E] text-white font-semibold text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Menu
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = () => {
    switch (order.status) {
      case 'MENUNGGU_BAYAR':
        return order.payment_method === 'CASH'
          ? {
              label: 'Menunggu Konfirmasi (Tunai)',
              dot: 'bg-amber-500',
              badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
              desc: 'Konfirmasi pesanan ke WhatsApp kami, pembayaran tunai dilakukan saat pengambilan.',
            }
          : {
              label: 'Menunggu Pembayaran QRIS',
              dot: 'bg-amber-500',
              badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
              desc: 'Scan QRIS di bawah lalu kirim bukti bayar ke WhatsApp kami agar pesanan segera dimasak.',
            };
      case 'DIPROSES':
        return {
          label: 'Sedang Dimasak di Dapur',
          dot: 'bg-blue-500',
          badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
          desc: 'Pembayaran terkonfirmasi. Pesanan Anda sedang disiapkan oleh tim dapur.',
        };
      case 'SIAP_DIAMBIL':
        return {
          label: 'Pesanan Siap Diambil',
          dot: 'bg-emerald-500',
          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          desc: 'Pesanan sudah selesai dibungkus dan siap diambil / dikirim.',
        };
      case 'SELESAI':
        return {
          label: 'Pesanan Selesai',
          dot: 'bg-stone-500',
          badgeBg: 'bg-stone-100 text-stone-700 border-stone-200',
          desc: 'Terima kasih atas pesanan Anda di Ayam Dubrak.',
        };
      case 'BATAL':
        return {
          label: 'Pesanan Dibatalkan',
          dot: 'bg-red-500',
          badgeBg: 'bg-red-50 text-red-800 border-red-200',
          desc: 'Pesanan ini telah dibatalkan.',
        };
    }
  };

  const statusInfo = getStatusBadge();

  const generateWaText = () => {
    const pickupTimeStr = order.is_asap ? 'Langsung Dimasak (Sekarang)' : `Jam ${order.pickup_scheduled_time} WIB`;
    const isUnpaid = order.status === 'MENUNGGU_BAYAR';
    const isCash = order.payment_method === 'CASH';

    if (isUnpaid && isCash) {
      const lines = [
        `Halo Ayam Dubrak! Saya ingin konfirmasi pesanan (Bayar Tunai):`,
        ``,
        `*Nomor Pesanan:* ${order.queue_code}`,
        `*Nama Pemesan:* ${order.customer_name}`,
        `*WhatsApp:* ${order.customer_phone}`,
        `*Jam Pickup:* ${pickupTimeStr}`,
        `*Metode:* Tunai / Cash (Bayar saat ambil / di tempat)`,
        `*Total Tagihan:* Rp ${order.total_amount.toLocaleString('id-ID')}`,
        ``,
        `Mohon segera disiapkan ya. Terima kasih!`,
      ];
      return encodeURIComponent(lines.join('\n'));
    }

    if (isUnpaid) {
      const lines = [
        `Halo Ayam Dubrak! Saya ingin kirim bukti pembayaran QRIS:`,
        ``,
        `*Nomor Pesanan:* ${order.queue_code}`,
        `*Nama Pemesan:* ${order.customer_name}`,
        `*WhatsApp:* ${order.customer_phone}`,
        `*Jam Pickup:* ${pickupTimeStr}`,
        `*Metode:* QRIS`,
        `*Total Tagihan:* Rp ${order.total_amount.toLocaleString('id-ID')}`,
        ``,
        `Berikut bukti transfer QRIS saya lampirkan di chat ini. Mohon segera diproses ya. Terima kasih!`,
      ];
      return encodeURIComponent(lines.join('\n'));
    }

    const lines = [
      `Halo Ayam Dubrak! Saya ingin konfirmasi pesanan:`,
      ``,
      `*Nomor Pesanan:* ${order.queue_code}`,
      `*Nama Pemesan:* ${order.customer_name}`,
      `*Jam Pickup:* ${pickupTimeStr}`,
      `*Total:* Rp ${order.total_amount.toLocaleString('id-ID')}`,
      ``,
      `Mohon infonya apabila pesanan sudah siap diambil. Terima kasih.`,
    ];
    return encodeURIComponent(lines.join('\n'));
  };

  const isUnpaid = order.status === 'MENUNGGU_BAYAR';
  const whatsappTarget = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';

  return (
    <div className="min-h-screen bg-[#FAF6F3] text-[#1C1917] px-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        {/* Navigation */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#78716C] hover:text-[#1C1917] transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Buat Pesanan Baru
        </Link>

        {/* Ticket Card */}
        <div className="bg-white rounded-lg p-6 border border-[#E6DCD5] shadow-xs space-y-5 text-center">
          <div className="space-y-1">
            <span className="text-xs font-medium text-[#78716C] block">
              Nomor Pesanan
            </span>
            <div className="text-4xl font-mono font-bold tracking-tight text-[#D9381E] tabular-nums">
              {order.queue_code}
            </div>
          </div>

          {/* Status Badge */}
          <div className={`px-3.5 py-2.5 rounded-md border text-xs font-semibold flex items-center justify-center gap-2 ${statusInfo.badgeBg}`}>
            <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
            <span>{statusInfo.label}</span>
          </div>

          <p className="text-xs text-[#57534E] leading-relaxed max-w-xs mx-auto">
            {statusInfo.desc}
          </p>

          {/* BLOK PEMBAYARAN SAAT MENUNGGU BAYAR */}
          {isUnpaid ? (
            order.payment_method === 'CASH' ? (
              /* Blok Pembayaran Tunai */
              <div className="bg-[#FAF6F3] p-4 rounded-lg border border-[#E6DCD5] space-y-3.5 text-left">
                <div className="flex items-center justify-between border-b border-[#EFE8E2] pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-emerald-700" />
                    <span className="font-semibold text-xs text-[#1C1917]">
                      Pembayaran Tunai
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm text-[#D9381E] tabular-nums">
                    Rp {order.total_amount.toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-md border border-[#E6DCD5] space-y-1.5 text-xs">
                  <span className="font-semibold text-[#1C1917] block">
                    Petunjuk Pembayaran Tunai:
                  </span>
                  <p className="text-[#57534E] text-[11px] leading-relaxed">
                    Silakan konfirmasi pesanan <strong>{order.queue_code}</strong> lewat WhatsApp dan selesaikan pembayaran tunai saat pengambilan pesanan.
                  </p>
                </div>

                <a
                  href={`https://wa.me/${whatsappTarget}?text=${generateWaText()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold text-xs transition"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-white" />
                  <span>Konfirmasi ke WhatsApp</span>
                </a>
              </div>
            ) : (
              /* Blok Pembayaran QRIS */
              <div className="bg-[#FAF6F3] p-4 rounded-lg border border-[#E6DCD5] space-y-3.5 text-left">
                <div className="flex items-center justify-between border-b border-[#EFE8E2] pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-[#D9381E]" />
                    <span className="font-semibold text-xs text-[#1C1917]">
                      Pembayaran QRIS
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm text-[#D9381E] tabular-nums">
                    Rp {order.total_amount.toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Tampilan Gambar Barcode QRIS */}
                <div className="bg-white p-3 rounded-lg border border-[#E6DCD5] flex flex-col items-center">
                  <img
                    src="/qris.jpg"
                    alt="QRIS Barcode Ayam Dubrak"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                    className="w-56 max-w-full h-auto rounded object-contain shadow-2xs"
                  />
                  <span className="text-[11px] text-[#78716C] mt-2 text-center">
                    BCA · Mandiri · BRI · BNI · GoPay · OVO · DANA · ShopeePay
                  </span>
                </div>

                {/* Instruksi Kirim Bukti ke WhatsApp */}
                <div className="bg-white p-3 rounded-md border border-[#E6DCD5] space-y-1 text-xs">
                  <span className="font-semibold text-[#1C1917] block">
                    Petunjuk Pembayaran:
                  </span>
                  <ol className="text-[#57534E] space-y-1 list-decimal list-inside leading-relaxed text-[11px]">
                    <li>Scan QRIS di atas dan selesaikan pembayaran.</li>
                    <li>Simpan / screenshot bukti transfer Anda.</li>
                    <li>Kirim bukti transfer ke WhatsApp kami dengan menekan tombol hijau di bawah agar pesanan langsung dimasak.</li>
                  </ol>
                </div>

                {/* Tombol Kirim Bukti ke WhatsApp */}
                <a
                  href={`https://wa.me/${whatsappTarget}?text=${generateWaText()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold text-xs shadow-xs transition"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>Kirim Bukti Bayar ke WhatsApp</span>
                </a>
              </div>
            )
          ) : (
            /* Jika Sudah Bayar / Diproses / Siap */
            <div className="space-y-3">
              <a
                href={`https://wa.me/${whatsappTarget}?text=${generateWaText()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold text-xs transition"
              >
                <MessageCircle className="w-3.5 h-3.5 fill-white" />
                <span>Hubungi WhatsApp Ayam Dubrak</span>
              </a>
            </div>
          )}

          {/* Location Box */}
          <div className="p-3.5 rounded-md bg-[#FAF6F3] border border-[#E6DCD5] flex items-start gap-2.5 text-left text-xs">
            <MapPin className="w-4 h-4 text-[#D9381E] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#1C1917] block">
                Lokasi Pengambilan
              </span>
              <span className="text-[#78716C] leading-tight block mt-0.5">
                Perumahan Bukit Alam Permai No.1 blok D4, Langkapura, Kec. Langkapura, Kota Bandar Lampung, Lampung 35144
              </span>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-lg p-5 border border-[#E6DCD5] shadow-xs space-y-4 text-xs">
          <h3 className="font-semibold text-sm text-[#1C1917] pb-2.5 border-b border-[#EFE8E2]">
            Rincian Pesanan
          </h3>

          <div className="grid grid-cols-2 gap-3 text-[#57534E]">
            <div>
              <span className="block text-[11px] text-[#78716C]">Nama Pemesan</span>
              <span className="font-semibold text-[#1C1917]">{order.customer_name}</span>
            </div>
            <div>
              <span className="block text-[11px] text-[#78716C]">WhatsApp</span>
              <span className="font-mono font-medium text-[#1C1917]">{order.customer_phone}</span>
            </div>
            <div className="col-span-2 pt-1 border-t border-[#EFE8E2]">
              <span className="block text-[11px] text-[#78716C]">Waktu Pengambilan (Jam Pickup)</span>
              <span className="font-semibold text-[#D9381E] text-xs">
                {order.is_asap ? 'Langsung Dimasak (Sekarang)' : `Jam ${order.pickup_scheduled_time} WIB`}
              </span>
            </div>
          </div>

          {/* Items */}
          <div className="pt-3 border-t border-[#EFE8E2] space-y-2.5">
            {order.items?.map((item) => (
              <div key={item.id} className="space-y-0.5">
                <div className="flex justify-between font-semibold text-[#1C1917]">
                  <span>{item.quantity}x {item.item_name}</span>
                  <span className="font-mono tabular-nums text-[#D9381E]">Rp {item.subtotal.toLocaleString('id-ID')}</span>
                </div>
                {item.modifiers?.map((m) => (
                  <div key={m.id} className="text-[11px] text-[#78716C] pl-3">
                    - {m.quantity && m.quantity > 1 ? `${m.quantity}x ` : ''}{m.option_name} {m.price > 0 && `(+Rp ${(m.price * (m.quantity || 1)).toLocaleString('id-ID')})`}
                  </div>
                ))}
                {item.notes && (
                  <div className="text-[11px] text-[#78716C] italic pl-3">
                    Catatan: {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="pt-3 border-t border-[#EFE8E2] flex justify-between items-center text-xs">
            <span className="text-[#57534E] font-medium">Total Tagihan</span>
            <span className="text-base font-mono font-bold text-[#1C1917] tabular-nums">
              Rp {order.total_amount.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FAF6F3] p-4">
          <div className="text-center space-y-2">
            <div className="w-6 h-6 border-2 border-[#D9381E] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium text-[#78716C]">Memuat status pesanan...</p>
          </div>
        </div>
      }
    >
      <OrderDetailContent />
    </Suspense>
  );
}
