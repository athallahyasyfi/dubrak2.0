import { Order } from '@/types';

// Global singleton in-memory store for dev/testing when Supabase env is not configured yet
declare global {
  var __GLOBAL_ORDERS__: Order[] | undefined;
  var __GLOBAL_DAILY_COUNTER__: { date: string; counter: number } | undefined;
}

if (!global.__GLOBAL_ORDERS__) {
  global.__GLOBAL_ORDERS__ = [];
}

if (!global.__GLOBAL_DAILY_COUNTER__) {
  global.__GLOBAL_DAILY_COUNTER__ = {
    date: new Date().toISOString().split('T')[0],
    counter: 0,
  };
}

export function getLocalOrders(): Order[] {
  return global.__GLOBAL_ORDERS__ || [];
}

export function saveLocalOrder(order: Order): Order {
  if (!global.__GLOBAL_ORDERS__) global.__GLOBAL_ORDERS__ = [];
  global.__GLOBAL_ORDERS__.unshift(order);
  return order;
}

export function updateLocalOrderStatus(
  id: string,
  status: Order['status'],
  paymentMethod?: 'CASH' | 'QRIS'
): Order | null {
  if (!global.__GLOBAL_ORDERS__) return null;
  const order = global.__GLOBAL_ORDERS__.find((o) => o.id === id);
  if (!order) return null;

  order.status = status;
  if (paymentMethod) {
    order.payment_method = paymentMethod;
    order.paid_at = new Date().toISOString();
  }
  return order;
}

export function deleteLocalOrder(id: string): boolean {
  if (!global.__GLOBAL_ORDERS__) return false;
  const initialLength = global.__GLOBAL_ORDERS__.length;
  global.__GLOBAL_ORDERS__ = global.__GLOBAL_ORDERS__.filter((o) => o.id !== id);
  return global.__GLOBAL_ORDERS__.length < initialLength;
}

export function generateLocalDailyQueueCode(): { queueNumber: number; queueCode: string } {
  // Nomor pesanan acak/random 3-digit (contoh: #DB-482, #DB-719)
  const randomNum = Math.floor(100 + Math.random() * 900);
  const queueCode = `#DB-${randomNum}`;

  return {
    queueNumber: randomNum,
    queueCode,
  };
}
