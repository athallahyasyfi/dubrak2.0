'use client';

import React, { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { PickupType } from '@/types';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Banknote, QrCode } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableNumber = searchParams ? searchParams.get('table') : null;

  const { items, updateQuantity, clearCart, totalAmount, totalCount } = useCart();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isAsap, setIsAsap] = useState(true);
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'QRIS' | 'CASH'>('QRIS');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const setQuickTimeOffset = (minutes: number) => {
    const d = new Date(Date.now() + minutes * 60 * 1000);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    setScheduledTime(`${hh}:${mm}`);
    setIsAsap(false);
  };

  if (!isOpen) return null;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!customerName.trim()) {
      setErrorMsg('Nama pemesan wajib diisi.');
      return;
    }

    if (!customerPhone.trim()) {
      setErrorMsg('Nomor WhatsApp wajib diisi.');
      return;
    }

    if (!isAsap && !scheduledTime.trim()) {
      setErrorMsg('Silakan tentukan jam pengambilan pesanan.');
      return;
    }

    if (items.length === 0) {
      setErrorMsg('Keranjang belanja masih kosong.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        table_number: tableNumber || null,
        pickup_type: 'AMBIL_SENDIRI' as PickupType,
        is_asap: isAsap,
        pickup_scheduled_time: isAsap ? null : scheduledTime,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
        items: items.map((item) => ({
          menu_item_id: item.menuItemId,
          item_name: item.name,
          base_price: item.basePrice,
          quantity: item.quantity,
          notes: item.notes || null,
          subtotal: item.itemTotal,
          modifiers: item.selectedModifiers.map((m) => ({
            group_title: m.groupTitle,
            option_name: m.optionName,
            price: m.price,
            quantity: m.quantity || 1,
          })),
        })),
        total_amount: totalAmount,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pesanan');
      }

      clearCart();
      onClose();
      router.push(`/order/${data.order.id}`);
    } catch (err: any) {
      console.error('Order submission error:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-xl border-l border-[#E6DCD5]">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-[#EFE8E2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#D9381E]" />
            <h2 className="font-semibold text-sm text-[#1C1917]">
              Ringkasan Pesanan ({totalCount})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#78716C] hover:text-[#1C1917] hover:bg-[#FAF6F3] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {items.length === 0 ? (
            <div className="py-20 text-center space-y-1.5">
              <p className="font-semibold text-[#1C1917] text-sm">Keranjang masih kosong</p>
              <p className="text-xs text-[#78716C] max-w-xs mx-auto">
                Pilih menu Ayam Dubrak terlebih dahulu untuk mulai memesan.
              </p>
            </div>
          ) : (
            <>
              {/* Items List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1C1917]">
                    Daftar Menu Dipilih
                  </span>
                  <button
                    onClick={clearCart}
                    className="text-xs text-[#D9381E] hover:underline font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Kosongkan
                  </button>
                </div>

                <div className="divide-y divide-[#EFE8E2] border-y border-[#EFE8E2]">
                  {items.map((item) => (
                    <div key={item.id} className="py-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-xs text-[#1C1917]">{item.name}</h4>
                          <span className="text-xs font-mono font-semibold text-[#D9381E] tabular-nums">
                            Rp {item.itemTotal.toLocaleString('id-ID')}
                          </span>
                        </div>

                        {/* Stepper */}
                        <div className="flex items-center border border-[#DCD2CB] rounded overflow-hidden bg-[#FAF6F3]">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1.5 hover:bg-[#EFE8E2] transition text-[#44403C]"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-mono font-semibold tabular-nums text-[#1C1917]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1.5 hover:bg-[#EFE8E2] transition text-[#44403C]"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Modifiers */}
                      {item.selectedModifiers.length > 0 && (
                        <div className="text-[11px] text-[#57534E] space-y-0.5 pl-2.5 border-l-2 border-[#D9381E]">
                          {item.selectedModifiers.map((m, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>
                                {m.quantity && m.quantity > 1 ? `${m.quantity}x ` : ''}
                                {m.optionName}
                              </span>
                              {m.price > 0 && (
                                <span className="font-mono tabular-nums text-[#D9381E]">
                                  +Rp {(m.price * (m.quantity || 1)).toLocaleString('id-ID')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {item.notes && (
                        <p className="text-[11px] text-[#78716C] italic">
                          Catatan: {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Checkout Form */}
              <form onSubmit={handleSubmitOrder} id="checkout-form" className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1C1917]">
                    Data Pemesan & Pengambilan
                  </span>
                  {tableNumber && (
                    <span className="text-xs font-mono font-semibold bg-[#FCEAE6] text-[#D9381E] px-2 py-0.5 rounded border border-[#F5D0C8]">
                      Meja {tableNumber}
                    </span>
                  )}
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
                    {errorMsg}
                  </div>
                )}

                {/* Nama */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#44403C] block">
                    Nama Pemesan <span className="text-[#D9381E]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nama"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-md border border-[#DCD2CB] bg-[#FAF6F3] text-[#1C1917] focus:bg-white focus:outline-hidden focus:border-[#D9381E] transition"
                  />
                </div>

                {/* WhatsApp */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#44403C] block">
                    Nomor WhatsApp <span className="text-[#D9381E]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="08xxxxxxxxxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-md border border-[#DCD2CB] bg-[#FAF6F3] text-[#1C1917] focus:bg-white focus:outline-hidden focus:border-[#D9381E] font-mono transition"
                  />
                </div>

                {/* Jam Pengambilan / Pickup */}
                <div className="space-y-2 pt-1 border-t border-[#EFE8E2]">
                  <label className="text-xs font-medium text-[#44403C] block">
                    Waktu Pengambilan (Jam Pickup)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAsap(true)}
                      className={`py-2 px-3 rounded-md border text-xs font-medium transition text-center ${
                        isAsap
                          ? 'border-[#D9381E] bg-[#FCEAE6] text-[#D9381E] font-semibold'
                          : 'border-[#DCD2CB] text-[#57534E] hover:bg-[#FAF6F3]'
                      }`}
                    >
                      Langsung Dimasak (Sekarang)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAsap(false);
                        if (!scheduledTime) setQuickTimeOffset(30);
                      }}
                      className={`py-2 px-3 rounded-md border text-xs font-medium transition text-center ${
                        !isAsap
                          ? 'border-[#D9381E] bg-[#FCEAE6] text-[#D9381E] font-semibold'
                          : 'border-[#DCD2CB] text-[#57534E] hover:bg-[#FAF6F3]'
                      }`}
                    >
                      Jadwalkan Jam Pickup
                    </button>
                  </div>

                  {!isAsap && (
                    <div className="p-3 rounded-md bg-[#FAF6F3] border border-[#E6DCD5] space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#57534E] whitespace-nowrap">Pilih Jam:</span>
                        <input
                          type="time"
                          required
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs font-mono font-semibold rounded-md border border-[#DCD2CB] bg-white text-[#1C1917] focus:border-[#D9381E] focus:outline-hidden"
                        />
                      </div>

                      {/* Quick preset buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#E6DCD5]">
                        <span className="text-[11px] text-[#78716C]">Pilihan Cepat:</span>
                        <button
                          type="button"
                          onClick={() => setQuickTimeOffset(15)}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-stone-50 border border-[#DCD2CB] text-[#44403C]"
                        >
                          +15 mnt
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickTimeOffset(30)}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-stone-50 border border-[#DCD2CB] text-[#44403C]"
                        >
                          +30 mnt
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickTimeOffset(45)}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-stone-50 border border-[#DCD2CB] text-[#44403C]"
                        >
                          +45 mnt
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickTimeOffset(60)}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-stone-50 border border-[#DCD2CB] text-[#44403C]"
                        >
                          +1 jam
                        </button>
                      </div>

                      {scheduledTime && (
                        <p className="text-[11px] text-[#D9381E] font-medium">
                          Pesanan dijadwalkan siap diambil pukul {scheduledTime} WIB
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Metode Pembayaran: QRIS vs Tunai */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-medium text-[#44403C] block">
                    Metode Pembayaran <span className="text-[#D9381E]">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('QRIS')}
                      className={`p-2.5 rounded-md border text-left flex items-start gap-2 transition ${
                        paymentMethod === 'QRIS'
                          ? 'border-[#D9381E] bg-[#FCEAE6] text-[#D9381E]'
                          : 'border-[#DCD2CB] bg-[#FAF6F3] text-[#57534E] hover:bg-white'
                      }`}
                    >
                      <QrCode className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold text-xs block leading-tight">QRIS</span>
                        <span className="text-[10px] text-[#78716C] block leading-tight mt-0.5">
                          Scan QRIS &amp; kirim bukti via WA
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`p-2.5 rounded-md border text-left flex items-start gap-2 transition ${
                        paymentMethod === 'CASH'
                          ? 'border-[#D9381E] bg-[#FCEAE6] text-[#D9381E]'
                          : 'border-[#DCD2CB] bg-[#FAF6F3] text-[#57534E] hover:bg-white'
                      }`}
                    >
                      <Banknote className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold text-xs block leading-tight">Tunai / Cash</span>
                        <span className="text-[10px] text-[#78716C] block leading-tight mt-0.5">
                          Bayar saat ambil / di tempat
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Catatan */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#44403C] block">
                    Catatan Tambahan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Catatan..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-md border border-[#DCD2CB] bg-[#FAF6F3] text-[#1C1917] focus:bg-white focus:outline-hidden focus:border-[#D9381E]"
                  />
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer Checkout */}
        {items.length > 0 && (
          <div className="p-4 border-t border-[#EFE8E2] bg-white space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#57534E] font-medium">Total Tagihan</span>
              <span className="text-base font-mono font-bold text-[#1C1917] tabular-nums">
                Rp {totalAmount.toLocaleString('id-ID')}
              </span>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={isSubmitting}
              className="w-full bg-[#D9381E] hover:bg-[#C02E16] text-white font-semibold py-3 px-4 rounded-md flex items-center justify-center gap-2 text-xs transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Memproses Pesanan...</span>
              ) : (
                <>
                  <span>Kirim Pesanan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
