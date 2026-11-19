'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus } from '@/types';
import { getBluetoothPrinter } from '@/lib/printer/bluetooth-printer';
import { playNotificationSound } from '@/lib/audio/beep';
import { StaffAuthGate } from '@/components/auth/StaffAuthGate';
import { createClient } from '@/lib/supabase/client';
import {
  Printer,
  Volume2,
  VolumeX,
  RefreshCw,
  Bluetooth,
  CreditCard,
  Banknote,
  X,
  Zap,
  Clock,
  Bell,
} from 'lucide-react';

function KasirDashboardContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrintOnNewOrder, setAutoPrintOnNewOrder] = useState(true);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerDeviceName, setPrinterDeviceName] = useState('');
  const [connectingPrinter, setConnectingPrinter] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('AKTIF');

  // Background Notification untuk Tablet
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Modal Pembayaran Kasir
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS'>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Audio permission unlock on first click
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Register Service Worker & Notifikasi Tablet
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          swRegistrationRef.current = reg;
        })
        .catch((err) => {
          console.warn('Gagal registrasi Service Worker:', err);
        });

      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        if (perm === 'granted') {
          triggerBackgroundNotification(
            'Notifikasi Tablet Aktif',
            'Tablet siap berbunyi dan bergetar saat ada pesanan baru.'
          );
        }
      } catch (err) {
        console.warn('Gagal meminta izin notifikasi:', err);
      }
    }
  };

  const triggerBackgroundNotification = (title: string, body: string, queueCode?: string) => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return;
    }

    // Tampilkan notifikasi melalui Service Worker agar muncul di status bar/heads-up tablet
    if (swRegistrationRef.current) {
      swRegistrationRef.current.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: queueCode || 'dubrak-order-notif',
        vibrate: [300, 100, 300, 100, 400],
        requireInteraction: true,
        data: { url: '/kasir' },
      } as NotificationOptions);
    } else {
      try {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
        });
      } catch (e) {
        console.warn('Notification fallback failed:', e);
      }
    }

    // Getar perangkat jika didukung
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([300, 100, 300, 100, 400]);
      } catch {}
    }
  };

  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef<boolean>(true);

  const notifyAndPrintNewOrders = (incoming: Order[]) => {
    const newOrders = incoming.filter((o) => !seenOrderIdsRef.current.has(o.id));
    for (const o of newOrders) {
      seenOrderIdsRef.current.add(o.id);
    }

    const pendingOrders = newOrders.filter((o) => o.status === 'MENUNGGU_BAYAR');
    if (pendingOrders.length === 0) return;

    if (soundEnabled) {
      playNotificationSound();
    }

    for (const pOrder of pendingOrders) {
      const summary = `${pOrder.customer_name} (${pOrder.pickup_type === 'DRIVER_OJOL' ? 'Ojol' : 'Ambil Sendiri'}) - Rp ${pOrder.total_amount.toLocaleString('id-ID')}`;
      triggerBackgroundNotification(`Pesanan Masuk ${pOrder.queue_code}`, summary, pOrder.queue_code);
    }

    if (autoPrintOnNewOrder) {
      const printer = getBluetoothPrinter();
      if (printer.isConnected()) {
        for (const orderToPrint of pendingOrders) {
          printer.printReceipt(orderToPrint).catch((err) => {
            console.warn('Auto-print error:', err);
          });
        }
      }
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        const incomingOrders: Order[] = data.orders || [];

        if (initialLoadRef.current) {
          for (const o of incomingOrders) {
            seenOrderIdsRef.current.add(o.id);
          }
          initialLoadRef.current = false;
        } else {
          notifyAndPrintNewOrders(incomingOrders);
        }

        setOrders(incomingOrders);
      }
    } catch (e) {
      console.warn('Gagal memuat pesanan kasir:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, [soundEnabled, autoPrintOnNewOrder]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createClient();
        const channel = supabase
          .channel('realtime-orders')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'orders' },
            (payload: any) => {
              const newOrder = payload.new as Order;
              setOrders((prev) => (prev.some((o) => o.id === newOrder.id) ? prev : [newOrder, ...prev]));
              notifyAndPrintNewOrders([newOrder]);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (err) {
        console.warn('Supabase Realtime not initialized:', err);
      }
    }
  }, [soundEnabled, autoPrintOnNewOrder]);

  useEffect(() => {
    const printer = getBluetoothPrinter();
    setPrinterConnected(printer.isConnected());
    if (printer.isConnected()) {
      setPrinterDeviceName(printer.getDeviceName());
    }
  }, []);

  const handleConnectBluetooth = async () => {
    setConnectingPrinter(true);
    try {
      const printer = getBluetoothPrinter();
      await printer.connect();
      setPrinterConnected(true);
      setPrinterDeviceName(printer.getDeviceName());
      alert(`Berhasil terhubung ke printer thermal: ${printer.getDeviceName()}`);
    } catch (err: any) {
      alert(`Gagal menghubungkan Bluetooth: ${err.message || 'Coba lagi'}`);
    } finally {
      setConnectingPrinter(false);
    }
  };

  const handleDisconnectBluetooth = async () => {
    try {
      const printer = getBluetoothPrinter();
      await printer.disconnect();
      setPrinterConnected(false);
      setPrinterDeviceName('');
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrintReceipt = async (order: Order) => {
    try {
      const printer = getBluetoothPrinter();
      if (!printer.isConnected()) {
        const confirmConnect = confirm('Printer Bluetooth belum terhubung. Hubungkan sekarang?');
        if (confirmConnect) {
          await handleConnectBluetooth();
          await getBluetoothPrinter().printReceipt(order);
        }
        return;
      }
      await printer.printReceipt(order);
    } catch (err: any) {
      alert(`Cetak gagal: ${err.message}`);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedOrderForPayment) return;
    setIsProcessingPayment(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedOrderForPayment.id,
          status: 'DIPROSES',
          payment_method: paymentMethod,
        }),
      });

      if (!res.ok) throw new Error('Gagal mengupdate status pembayaran');

      const data = await res.json();
      const updatedOrder = data.order;

      setOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
      );

      await handlePrintReceipt(updatedOrder);

      setSelectedOrderForPayment(null);
      setCashReceived('');
    } catch (err: any) {
      alert(`Error konfirmasi pembayaran: ${err.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderId,
          status: newStatus,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? data.order : o))
        );
      }
    } catch (e: any) {
      alert(`Gagal update status: ${e.message}`);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'AKTIF') {
      return ['MENUNGGU_BAYAR', 'DIPROSES', 'SIAP_DIAMBIL'].includes(o.status);
    }
    if (statusFilter === 'MENUNGGU_BAYAR') return o.status === 'MENUNGGU_BAYAR';
    if (statusFilter === 'DIPROSES') return o.status === 'DIPROSES';
    if (statusFilter === 'SIAP_DIAMBIL') return o.status === 'SIAP_DIAMBIL';
    if (statusFilter === 'SELESAI') return o.status === 'SELESAI';
    return true;
  });

  const cashChange =
    paymentMethod === 'CASH' && cashReceived && selectedOrderForPayment
      ? Math.max(0, parseInt(cashReceived.replace(/\D/g, '') || '0') - selectedOrderForPayment.total_amount)
      : 0;

  return (
    <div
      onClick={() => {
        if (!audioUnlocked) {
          playNotificationSound();
          setAudioUnlocked(true);
        }
      }}
      className="min-h-screen bg-[#FAF6F3] text-[#1C1917] flex flex-col"
    >
      {/* Top Header Kasir */}
      <header className="bg-white border-b border-[#E6DCD5] px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-[#1C1917]">
                Kasir Ayam Dubrak
              </h1>
              <span className="text-[11px] font-medium text-[#D9381E] px-2 py-0.5 rounded bg-[#FCEAE6] border border-[#F5D0C8]">
                POS Terminal
              </span>
            </div>
            <p className="text-xs text-[#78716C] mt-0.5">
              Perumahan Bukit Alam Permai No.1 blok D4, Langkapura, Kota Bandar Lampung
            </p>
          </div>

          {/* Quick Hardware & Automation Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sakelar Auto-Print */}
            <button
              onClick={() => setAutoPrintOnNewOrder((v) => !v)}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition ${
                autoPrintOnNewOrder
                  ? 'border-[#D9381E] bg-[#FCEAE6] text-[#D9381E] font-semibold'
                  : 'border-[#DCD2CB] text-[#78716C] bg-white'
              }`}
              title="Sakelar Auto-Print otomatis saat ada pesanan baru masuk"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Auto-Print: {autoPrintOnNewOrder ? 'Aktif' : 'Nonaktif'}</span>
            </button>

            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition ${
                soundEnabled
                  ? 'border-[#DCD2CB] bg-[#FAF6F3] text-[#1C1917]'
                  : 'border-[#E6DCD5] text-[#78716C]'
              }`}
              title="Notifikasi Suara Pesanan Masuk"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Suara Aktif' : 'Bisu'}</span>
            </button>

            {/* Notifikasi Tablet Background (ShopeeFood / Grab / GoFood) */}
            {notificationPermission === 'granted' ? (
              <div
                className="px-3 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-1.5"
                title="Notifikasi tablet aktif saat membuka aplikasi lain"
              >
                <Bell className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Notif Tablet Aktif</span>
              </div>
            ) : (
              <button
                onClick={requestNotificationPermission}
                className="px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex items-center gap-1.5 transition"
                title="Aktifkan notifikasi & getar saat tablet membuka ShopeeFood, Grab, atau GoFood"
              >
                <Bell className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                <span>Aktifkan Notif Tablet</span>
              </button>
            )}

            {/* Bluetooth Printer Connection */}
            {printerConnected ? (
              <div className="flex items-center gap-2 bg-[#FAF6F3] border border-[#DCD2CB] px-3 py-1.5 rounded-md text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-[#1C1917] truncate max-w-[130px]">
                  {printerDeviceName || 'Printer 58mm'}
                </span>
                <button
                  onClick={handleDisconnectBluetooth}
                  className="text-[11px] text-[#78716C] hover:text-red-600 transition ml-1"
                >
                  Lepas
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectBluetooth}
                disabled={connectingPrinter}
                className="bg-[#1C1917] hover:bg-[#292524] text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>{connectingPrinter ? 'Menghubungkan...' : 'Hubungkan Printer'}</span>
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={fetchOrders}
              className="p-2 rounded-md border border-[#DCD2CB] hover:bg-[#FAF6F3] text-[#57534E] transition"
              title="Muat Ulang Pesanan"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="max-w-7xl mx-auto flex gap-1.5 overflow-x-auto mt-4 pt-3 border-t border-[#EFE8E2] no-scrollbar">
          {[
            { id: 'AKTIF', label: 'Pesanan Aktif', count: orders.filter((o) => ['MENUNGGU_BAYAR', 'DIPROSES', 'SIAP_DIAMBIL'].includes(o.status)).length },
            { id: 'MENUNGGU_BAYAR', label: 'Belum Bayar', count: orders.filter((o) => o.status === 'MENUNGGU_BAYAR').length },
            { id: 'DIPROSES', label: 'Sedang Dimasak', count: orders.filter((o) => o.status === 'DIPROSES').length },
            { id: 'SIAP_DIAMBIL', label: 'Siap Ambil', count: orders.filter((o) => o.status === 'SIAP_DIAMBIL').length },
            { id: 'SELESAI', label: 'Selesai', count: orders.filter((o) => o.status === 'SELESAI').length },
            { id: 'ALL', label: 'Semua', count: orders.length },
          ].map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap flex items-center gap-2 transition ${
                  isSelected
                    ? 'bg-[#1C1917] text-white font-semibold'
                    : 'bg-[#FAF6F3] text-[#57534E] hover:bg-[#EFE8E2] border border-[#E6DCD5]'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded text-[11px] font-mono tabular-nums ${
                  isSelected
                    ? 'bg-[#292524] text-white'
                    : 'bg-[#E6DCD5] text-[#44403C]'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Order Grid */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full pb-20">
        {filteredOrders.length === 0 ? (
          <div className="py-24 text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#44403C]">
              Belum ada pesanan pada kategori ini
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => {
              const isUnpaid = order.status === 'MENUNGGU_BAYAR';
              const isCooking = order.status === 'DIPROSES';
              const isReady = order.status === 'SIAP_DIAMBIL';

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-lg border flex flex-col shadow-2xs transition ${
                    isUnpaid
                      ? 'border-[#D9381E]'
                      : 'border-[#E6DCD5]'
                  }`}
                >
                  {/* Card Header: Queue Code & Status */}
                  <div className="p-4 border-b border-[#EFE8E2] flex items-start justify-between">
                    <div>
                      <span className="text-[11px] text-[#78716C] block">
                        Nomor Pesanan
                      </span>
                      <span className="text-2xl font-mono font-bold tracking-tight text-[#D9381E] tabular-nums">
                        {order.queue_code}
                      </span>
                    </div>

                    <div className="text-right space-y-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          isUnpaid
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : isCooking
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : isReady
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        {order.status === 'MENUNGGU_BAYAR' ? 'Belum Bayar' :
                         order.status === 'DIPROSES' ? 'Dimasak' :
                         order.status === 'SIAP_DIAMBIL' ? 'Siap Ambil' :
                         order.status === 'SELESAI' ? 'Selesai' : 'Batal'}
                      </span>
                      <span className="text-[11px] font-mono text-[#78716C] block tabular-nums">
                        {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Customer Meta */}
                  <div className="px-4 py-3 bg-[#FAF6F3] border-b border-[#EFE8E2] text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-semibold text-[#1C1917]">
                      <span>{order.customer_name}</span>
                      <span className="text-[#78716C] font-mono font-normal">{order.customer_phone}</span>
                    </div>

                    {/* Jam Pickup Yang Jelas & Rapi */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#EFE8E2]/70 text-xs">
                      <span className="text-[#78716C] flex items-center gap-1.5 text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-[#D9381E]" />
                        <span>Jam Pickup:</span>
                      </span>
                      {order.is_asap ? (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Langsung Dimasak (Sekarang)
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold text-[#D9381E] bg-[#FCEAE6] px-2.5 py-0.5 rounded border border-[#F5D0C8] tabular-nums">
                          Jam {order.pickup_scheduled_time}
                        </span>
                      )}
                    </div>

                    {order.notes && (
                      <p className="text-[11px] text-[#57534E] italic pt-1 border-t border-[#E6DCD5]">
                        Catatan: {order.notes}
                      </p>
                    )}
                  </div>

                  {/* Menu Items List */}
                  <div className="p-4 flex-1 space-y-2 text-xs overflow-y-auto max-h-56">
                    {order.items?.map((item) => (
                      <div key={item.id} className="pb-2 border-b border-[#EFE8E2] last:border-0">
                        <div className="flex justify-between font-semibold text-[#1C1917]">
                          <span>{item.quantity}x {item.item_name}</span>
                          <span className="font-mono tabular-nums">Rp {item.subtotal.toLocaleString('id-ID')}</span>
                        </div>
                        {item.modifiers?.map((m: any) => (
                          <div key={m.id} className="text-[11px] text-[#78716C] pl-2">
                            - {m.quantity && m.quantity > 1 ? `${m.quantity}x ` : ''}{m.option_name} {m.price > 0 && `(+Rp ${(m.price * (m.quantity || 1)).toLocaleString('id-ID')})`}
                          </div>
                        ))}
                        {item.notes && (
                          <div className="text-[11px] text-[#78716C] italic pl-2">
                            Catatan: {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Card Footer: Total Price & Actions */}
                  <div className="p-4 bg-[#FAF6F3] border-t border-[#EFE8E2] space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#57534E] font-medium">Total Tagihan</span>
                      <span className="text-base font-mono font-bold text-[#1C1917] tabular-nums">
                        Rp {order.total_amount.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isUnpaid && (
                        <button
                          onClick={() => {
                            setSelectedOrderForPayment(order);
                            setPaymentMethod(order.payment_method || 'CASH');
                            setCashReceived(order.total_amount.toString());
                          }}
                          className="flex-1 bg-[#D9381E] hover:bg-[#C02E16] text-white font-semibold py-2 px-3 rounded-md text-xs transition"
                        >
                          Terima Pembayaran
                        </button>
                      )}

                      {isCooking && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'SIAP_DIAMBIL')}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-md text-xs transition"
                        >
                          Tandai Siap Diambil
                        </button>
                      )}

                      {isReady && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'SELESAI')}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-md text-xs transition"
                        >
                          Selesaikan Pesanan
                        </button>
                      )}

                      <button
                        onClick={() => handlePrintReceipt(order)}
                        className="p-2 rounded-md border border-[#DCD2CB] bg-white hover:bg-[#EFE8E2] text-[#1C1917] transition"
                        title="Cetak Struk Thermal 58mm"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL TERIMA PEMBAYARAN KASIR */}
      {selectedOrderForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-5 shadow-xl border border-[#E6DCD5] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFE8E2]">
              <div>
                <h3 className="font-semibold text-sm text-[#1C1917]">
                  Konfirmasi Pembayaran Kasir
                </h3>
                <span className="text-xs text-[#78716C]">
                  Pesanan {selectedOrderForPayment.queue_code} — {selectedOrderForPayment.customer_name}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrderForPayment(null)}
                className="p-1 rounded text-[#78716C] hover:text-[#1C1917]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Total */}
            <div className="bg-[#FAF6F3] p-3.5 rounded-md border border-[#E6DCD5] flex items-center justify-between">
              <span className="text-xs text-[#57534E] font-medium">Total Tagihan</span>
              <span className="text-lg font-mono font-bold text-[#D9381E] tabular-nums">
                Rp {selectedOrderForPayment.total_amount.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Metode Bayar */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#44403C] block">Metode Pembayaran</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-2.5 rounded-md border text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                    paymentMethod === 'CASH'
                      ? 'border-[#D9381E] bg-[#FCEAE6] text-[#D9381E] font-semibold'
                      : 'border-[#DCD2CB] text-[#57534E]'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Tunai (Cash)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('QRIS')}
                  className={`p-2.5 rounded-md border text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                    paymentMethod === 'QRIS'
                      ? 'border-[#D9381E] bg-[#FCEAE6] text-[#D9381E] font-semibold'
                      : 'border-[#DCD2CB] text-[#57534E]'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>QRIS / Transfer</span>
                </button>
              </div>
            </div>

            {/* Nominal Uang Tunai */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-[#44403C] block">Uang Diterima</label>
                <input
                  type="number"
                  placeholder="Nominal uang"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[#DCD2CB] bg-[#FAF6F3] text-sm font-mono font-semibold tabular-nums focus:bg-white focus:outline-hidden focus:border-[#D9381E]"
                />
                <div className="flex justify-between items-center text-xs pt-1 px-1">
                  <span className="text-[#57534E]">Kembalian:</span>
                  <span className="font-mono font-bold text-sm text-emerald-600 tabular-nums">
                    Rp {cashChange.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedOrderForPayment(null)}
                className="px-3.5 py-2 rounded-md border border-[#DCD2CB] text-xs font-medium text-[#57534E]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingPayment}
                onClick={handleConfirmPayment}
                className="flex-1 bg-[#D9381E] hover:bg-[#C02E16] text-white font-semibold py-2 px-3 rounded-md text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isProcessingPayment ? 'Mencetak...' : 'Lunas & Cetak Struk'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KasirPage() {
  return (
    <StaffAuthGate role="kasir" title="Terminal Kasir">
      <KasirDashboardContent />
    </StaffAuthGate>
  );
}
