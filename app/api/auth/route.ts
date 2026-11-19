import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  StaffRole,
  verifyStaffCredentials,
  updateStaffCredentials,
  getStaffPublicInfo,
  createSignedSessionToken,
  getServerSession,
  SESSION_COOKIE_NAME,
} from '@/lib/security/auth-store';
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginFailures,
} from '@/lib/security/rate-limit';

const loginSchema = z.object({
  action: z.literal('login'),
  role: z.enum(['kasir', 'admin']),
  username: z.string().min(1, 'Username wajib diisi').max(60),
  password: z.string().min(1, 'Password wajib diisi').max(120),
  rememberMe: z.boolean().optional().default(true),
});

const updateCredentialsSchema = z.object({
  role: z.enum(['kasir', 'admin']),
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newUsername: z.string().min(3, 'Username baru minimal 3 karakter').max(50),
  newPassword: z.string().min(6, 'Password baru minimal 6 karakter').max(100),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requiredRole = searchParams.get('role') as StaffRole | null;

  const session = await getServerSession();
  const roleInfo = requiredRole ? getStaffPublicInfo(requiredRole) : null;

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      accountInfo: roleInfo,
    });
  }

  // Admin memiliki akses ke halaman admin maupun kasir; kasir hanya ke halaman kasir
  const hasAccess =
    !requiredRole ||
    session.role === requiredRole ||
    session.role === 'admin';

  return NextResponse.json({
    authenticated: hasAccess,
    sessionRole: session.role,
    username: session.username,
    accountInfo: roleInfo,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === 'logout') {
      const response = NextResponse.json({ success: true });
      response.cookies.set(SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
      return response;
    }

    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const rateLimit = checkLoginRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 });
    }

    const parsed = loginSchema.parse(body);

    // Cek apakah login menggunakan akun role yang diminta, atau akun admin
    let check = verifyStaffCredentials(parsed.role, parsed.username, parsed.password);
    let grantedRole: StaffRole = parsed.role;

    if (!check.valid && parsed.role === 'kasir') {
      // Admin juga boleh login di terminal kasir
      const adminCheck = verifyStaffCredentials('admin', parsed.username, parsed.password);
      if (adminCheck.valid) {
        check = adminCheck;
        grantedRole = 'admin';
      }
    }

    if (!check.valid || !check.account) {
      recordLoginFailure(clientIp);
      return NextResponse.json(
        { error: 'Username atau password tidak sesuai.' },
        { status: 401 }
      );
    }

    resetLoginFailures(clientIp);

    const token = createSignedSessionToken(
      grantedRole,
      check.account.username,
      parsed.rememberMe
    );

    const maxAgeSec = parsed.rememberMe ? 7 * 24 * 60 * 60 : 12 * 60 * 60;

    const response = NextResponse.json({
      authenticated: true,
      role: grantedRole,
      username: check.account.username,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: maxAgeSec,
    });

    return response;
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Gagal memproses autentikasi.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Sesi tidak valid. Silakan login terlebih dahulu.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = updateCredentialsSchema.parse(body);

    // Kasir hanya boleh mengubah kredensial kasir, Admin boleh mengubah admin & kasir
    if (session.role !== 'admin' && session.role !== parsed.role) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses untuk mengubah akun ini.' },
        { status: 403 }
      );
    }

    const result = updateStaffCredentials(
      parsed.role,
      parsed.currentPassword,
      parsed.newUsername,
      parsed.newPassword
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Perbarui token cookie jika mengubah akun yang sedang aktif
    const response = NextResponse.json({
      success: true,
      username: result.username,
      message: 'Kredensial akun berhasil diperbarui dan disimpan.',
    });

    if (session.role === parsed.role && result.username) {
      const newToken = createSignedSessionToken(session.role, result.username, true);
      response.cookies.set(SESSION_COOKIE_NAME, newToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Gagal menyimpan pengaturan akun.' },
      { status: 500 }
    );
  }
}
