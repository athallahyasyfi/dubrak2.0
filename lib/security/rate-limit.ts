// Rate limiter sederhana in-memory untuk membatasi frekuensi pembuatan pesanan (Anti-Spam)
interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
  lastRequestTime: number;
}

const ipOrderHistory = new Map<string, RateLimitRecord>();

export function checkOrderRateLimit(ip: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  for (const [key, rec] of ipOrderHistory.entries()) {
    if (now - rec.lastRequestTime > 10 * 60 * 1000) {
      ipOrderHistory.delete(key);
    }
  }
  const WINDOW_MS = 60 * 1000; // 1 menit
  const MAX_ORDERS_PER_WINDOW = 5; // Maksimal 5 pesanan per menit
  const MIN_INTERVAL_MS = 5 * 1000; // Minimal jeda 5 detik antar pesanan

  const record = ipOrderHistory.get(ip);

  if (!record) {
    ipOrderHistory.set(ip, {
      count: 1,
      firstRequestTime: now,
      lastRequestTime: now,
    });
    return { allowed: true };
  }

  // 1. Anti-spam jeda kilat (kurang dari 5 detik)
  if (now - record.lastRequestTime < MIN_INTERVAL_MS) {
    return {
      allowed: false,
      message: 'Mohon tunggu beberapa detik sebelum mengirim pesanan baru.',
    };
  }

  // 2. Sliding window check
  if (now - record.firstRequestTime < WINDOW_MS) {
    if (record.count >= MAX_ORDERS_PER_WINDOW) {
      return {
        allowed: false,
        message: 'Batas frekuensi pesanan tercapai. Mohon tunggu 1 menit sebelum memesan kembali.',
      };
    }
    record.count += 1;
    record.lastRequestTime = now;
    return { allowed: true };
  }

  // Reset window
  ipOrderHistory.set(ip, {
    count: 1,
    firstRequestTime: now,
    lastRequestTime: now,
  });
  return { allowed: true };
}

const ipLoginHistory = new Map<string, { fails: number; blockedUntil: number; lastAttempt: number }>();

export function checkLoginRateLimit(ip: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  for (const [key, rec] of ipLoginHistory.entries()) {
    if (now - rec.lastAttempt > 10 * 60 * 1000 && rec.blockedUntil <= now) {
      ipLoginHistory.delete(key);
    }
  }
  const record = ipLoginHistory.get(ip);

  if (record && record.blockedUntil > now) {
    const remainingSec = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      message: `Terlalu banyak percobaan login gagal. Coba lagi dalam ${remainingSec} detik.`,
    };
  }

  return { allowed: true };
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const WINDOW_MS = 5 * 60 * 1000; // 5 menit
  const BLOCK_MS = 3 * 60 * 1000; // Blokir 3 menit jika 5x salah
  const record = ipLoginHistory.get(ip);

  if (!record || now - record.lastAttempt > WINDOW_MS) {
    ipLoginHistory.set(ip, { fails: 1, blockedUntil: 0, lastAttempt: now });
    return;
  }

  const newFails = record.fails + 1;
  ipLoginHistory.set(ip, {
    fails: newFails,
    blockedUntil: newFails >= 5 ? now + BLOCK_MS : 0,
    lastAttempt: now,
  });
}

export function resetLoginFailures(ip: string): void {
  ipLoginHistory.delete(ip);
}
