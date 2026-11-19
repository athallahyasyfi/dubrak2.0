import crypto from 'crypto';
import { cookies } from 'next/headers';

export type StaffRole = 'kasir' | 'admin';

export interface StaffAccountRecord {
  role: StaffRole;
  username: string;
}

export const SESSION_COOKIE_NAME = 'dubrak_staff_session';
const FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string {
  return process.env.AUTH_SECRET?.trim() || FALLBACK_SECRET;
}

function getExpectedCredentials(role: StaffRole): { username: string; password: string } {
  if (role === 'admin') {
    return {
      username: (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase(),
      password: process.env.ADMIN_PASSWORD || 'admin123',
    };
  }
  return {
    username: (process.env.KASIR_USERNAME || 'kasir').trim().toLowerCase(),
    password: process.env.KASIR_PASSWORD || 'kasir123',
  };
}

function timingSafeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function verifyStaffCredentials(
  role: StaffRole,
  usernameInput: string,
  passwordInput: string
): { valid: boolean; account?: StaffAccountRecord } {
  const expected = getExpectedCredentials(role);
  const normalizedUser = usernameInput.trim().toLowerCase();
  const userMatch = timingSafeCompare(normalizedUser, expected.username);
  const passMatch = timingSafeCompare(passwordInput, expected.password);

  if (!userMatch || !passMatch) {
    return { valid: false };
  }
  return { valid: true, account: { role, username: expected.username } };
}

export function getStaffPublicInfo(role: StaffRole): { role: StaffRole; username: string } {
  const expected = getExpectedCredentials(role);
  return { role, username: expected.username };
}

export interface SessionPayload {
  role: StaffRole;
  username: string;
  exp: number;
}

export function createSignedSessionToken(role: StaffRole, username: string, rememberMe: boolean): string {
  const secret = getSigningSecret();
  const ttlMs = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
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
