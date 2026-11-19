import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';

export type StaffRole = 'kasir' | 'admin';

export interface StaffAccountRecord {
  role: StaffRole;
  username: string;
  passwordHash: string;
  salt: string;
  updatedAt: string;
}

interface CredentialsFileSchema {
  secretKey: string;
  accounts: Record<StaffRole, StaffAccountRecord>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'staff-credentials.json');
export const SESSION_COOKIE_NAME = 'dubrak_staff_session';

function hashPasswordWithSalt(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha256').toString('hex');
}

function createAccountRecord(role: StaffRole, username: string, rawPassword: string): StaffAccountRecord {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    role,
    username: username.trim().toLowerCase(),
    passwordHash: hashPasswordWithSalt(rawPassword, salt),
    salt,
    updatedAt: new Date().toISOString(),
  };
}

function ensureStoreInitialized(): CredentialsFileSchema {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as CredentialsFileSchema;
      if (parsed && parsed.accounts && parsed.accounts.kasir && parsed.accounts.admin && parsed.secretKey) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Re-initializing staff credentials store:', err);
  }

  const initialKasirUser = process.env.KASIR_USERNAME || 'kasir';
  const initialKasirPass = process.env.KASIR_PASSWORD || 'kasir123';
  const initialAdminUser = process.env.ADMIN_USERNAME || 'admin';
  const initialAdminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const secretKey = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');

  const initialData: CredentialsFileSchema = {
    secretKey,
    accounts: {
      kasir: createAccountRecord('kasir', initialKasirUser, initialKasirPass),
      admin: createAccountRecord('admin', initialAdminUser, initialAdminPass),
    },
  };

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write credentials file to disk, using in-memory fallback:', err);
  }

  return initialData;
}

let memoryStoreCache: CredentialsFileSchema | null = null;

function getStore(): CredentialsFileSchema {
  if (memoryStoreCache) {
    return memoryStoreCache;
  }
  memoryStoreCache = ensureStoreInitialized();
  return memoryStoreCache;
}

function getSigningSecret(): string {
  const envSecret = process.env.AUTH_SECRET?.trim();
  if (envSecret) {
    return envSecret;
  }
  return getStore().secretKey;
}

function saveStore(store: CredentialsFileSchema): void {
  memoryStoreCache = store;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to persist credentials file:', err);
  }
}

export function verifyStaffCredentials(
  role: StaffRole,
  usernameInput: string,
  passwordInput: string
): { valid: boolean; account?: StaffAccountRecord } {
  const store = getStore();
  const account = store.accounts[role];
  if (!account) return { valid: false };

  const normalizedUser = usernameInput.trim().toLowerCase();
  if (normalizedUser !== account.username) {
    return { valid: false };
  }

  const computedHash = hashPasswordWithSalt(passwordInput, account.salt);
  const a = Buffer.from(computedHash, 'hex');
  const b = Buffer.from(account.passwordHash, 'hex');

  if (a.length !== b.length) return { valid: false };
  const isMatch = crypto.timingSafeEqual(a, b);
  return isMatch ? { valid: true, account } : { valid: false };
}

export function updateStaffCredentials(
  role: StaffRole,
  currentPassword: string,
  newUsername: string,
  newPassword: string
): { success: boolean; error?: string; username?: string } {
  const store = getStore();
  const existing = store.accounts[role];
  if (!existing) {
    return { success: false, error: 'Akun peran tidak ditemukan.' };
  }

  // Verifikasi password lama terlebih dahulu
  const computedCurrent = hashPasswordWithSalt(currentPassword, existing.salt);
  const a = Buffer.from(computedCurrent, 'hex');
  const b = Buffer.from(existing.passwordHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { success: false, error: 'Password saat ini tidak sesuai.' };
  }

  const cleanUsername = newUsername.trim().toLowerCase();
  if (cleanUsername.length < 3) {
    return { success: false, error: 'Username minimal 3 karakter.' };
  }
  if (newPassword.length < 6) {
    return { success: false, error: 'Password baru minimal 6 karakter.' };
  }

  const updatedRecord = createAccountRecord(role, cleanUsername, newPassword);
  store.accounts[role] = updatedRecord;
  saveStore(store);

  return { success: true, username: updatedRecord.username };
}

export function getStaffPublicInfo(role: StaffRole): { role: StaffRole; username: string; updatedAt: string } {
  const store = getStore();
  const acc = store.accounts[role];
  return {
    role,
    username: acc.username,
    updatedAt: acc.updatedAt,
  };
}

export interface SessionPayload {
  role: StaffRole;
  username: string;
  exp: number;
}

export function createSignedSessionToken(role: StaffRole, username: string, rememberMe: boolean): string {
  const secret = getSigningSecret();
  const ttlMs = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000; // 7 hari atau 12 jam
  const payload: SessionPayload = {
    role,
    username,
    exp: Date.now() + ttlMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifySignedSessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const secret = getSigningSecret();
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8')) as SessionPayload;
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return verifySignedSessionToken(token);
  } catch {
    return null;
  }
}
