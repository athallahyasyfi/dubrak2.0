import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

const ROOT = process.cwd();

// Minimal ESM resolver & type-stub loader so Node 24 can import Next.js TypeScript modules directly in tests
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/headers' || specifier === 'next/server') {
      return nextResolve(`${specifier}.js`, context);
    }
    if (specifier.startsWith('@/')) {
      const base = path.join(ROOT, specifier.slice(2));
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/types/index.ts')) {
      const src = fs.readFileSync(new URL(url), 'utf8');
      const stubs = [...src.matchAll(/^export (?:type|interface) (\w+)/gm)].map(
        (m) => `export const ${m[1]} = undefined;`
      );
      return { format: 'module', shortCircuit: true, source: stubs.join('\n') };
    }
    return nextLoad(url, context);
  },
});

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
process.env.AUTH_SECRET = 'test-secret-key-for-hmac-verification-123456';
process.env.ADMIN_USERNAME = 'admin_test';
process.env.ADMIN_PASSWORD = 'secret_admin_pass';

// Seed in-memory catalog before menu-store initializes so disk files are never touched
global.__GLOBAL_CATEGORIES__ = [{ id: 'cat-1', name: 'Paket', sort_order: 1 }];
global.__GLOBAL_MENU_ITEMS__ = [
  {
    id: 'menu-test-1',
    category_id: 'cat-1',
    name: 'Ayam Dubrak Test',
    description: null,
    base_price: 20000,
    image_url: null,
    is_available: true,
    modifier_groups: [
      {
        id: 'grp-sambal',
        menu_item_id: 'menu-test-1',
        title: 'Pilihan Sambal',
        is_required: true,
        min_selection: 1,
        max_selection: 1,
        options: [
          { id: 'opt-s1', group_id: 'grp-sambal', name: 'Sambal Pedas', price: 0, is_available: true },
        ],
      },
      {
        id: 'grp-addon',
        menu_item_id: 'menu-test-1',
        title: 'Extra Add-ons',
        is_required: false,
        min_selection: 0,
        max_selection: 10,
        options: [
          { id: 'opt-a1', group_id: 'grp-addon', name: 'Extra Keju', price: 5000, is_available: true },
        ],
      },
    ],
  },
];

const auth = await import('../lib/security/auth-store.ts');
const ordersApi = await import('../app/api/orders/route.ts');

test('HMAC session token: valid, tampered, and expired checks', () => {
  const token = auth.createSignedSessionToken('admin', 'admin_test', true);
  const verified = auth.verifySignedSessionToken(token);
  assert.equal(verified?.role, 'admin');
  assert.equal(verified?.username, 'admin_test');

  const [payloadPart, sigPart] = token.split('.');
  const tamperedToken = `${payloadPart}.${sigPart.slice(0, -1)}X`;
  assert.equal(auth.verifySignedSessionToken(tamperedToken), null);

  const expiredPayload = Buffer.from(
    JSON.stringify({ role: 'kasir', username: 'kasir', exp: Date.now() - 1000 })
  ).toString('base64url');
  const expiredSig = crypto
    .createHmac('sha256', process.env.AUTH_SECRET)
    .update(expiredPayload)
    .digest('base64url');
  assert.equal(auth.verifySignedSessionToken(`${expiredPayload}.${expiredSig}`), null);

  assert.equal(auth.verifyStaffCredentials('admin', 'admin_test', 'secret_admin_pass').valid, true);
  assert.equal(auth.verifyStaffCredentials('admin', 'admin_test', 'wrong').valid, false);
});

test('POST /api/orders recalculates total on server and enforces required modifiers', async () => {
  // Missing required sambal -> 400
  const missingReqRes = await ordersApi.POST(
    new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.1', 'content-type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Budi',
        customer_phone: '081234567890',
        pickup_type: 'AMBIL_SENDIRI',
        is_asap: true,
        payment_method: 'QRIS',
        items: [
          {
            menu_item_id: 'menu-test-1',
            item_name: 'Ayam Dubrak Test',
            base_price: 1,
            quantity: 2,
            subtotal: 2,
            modifiers: [],
          },
        ],
      }),
    })
  );
  assert.equal(missingReqRes.status, 400);

  // Valid order with tampered client prices -> server computes (20000 + 2 * 5000) * 2 = 60000
  const okRes = await ordersApi.POST(
    new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.2', 'content-type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Budi',
        customer_phone: '081234567890',
        pickup_type: 'AMBIL_SENDIRI',
        is_asap: true,
        payment_method: 'CASH',
        items: [
          {
            menu_item_id: 'menu-test-1',
            item_name: 'Ayam Dubrak Test',
            base_price: 1,
            quantity: 2,
            subtotal: 1,
            modifiers: [
              { group_title: 'Pilihan Sambal', option_name: 'Sambal Pedas', price: 0, quantity: 1 },
              { group_title: 'Extra Add-ons', option_name: 'Extra Keju', price: 1, quantity: 2 },
            ],
          },
        ],
      }),
    })
  );
  assert.equal(okRes.status, 201);
  const okBody = await okRes.json();
  assert.equal(okBody.order.total_amount, 60000);
  assert.equal(okBody.order.items[0].subtotal, 60000);

  // Unauthenticated GET /api/orders without id -> 401
  const listRes = await ordersApi.GET(new Request('http://localhost/api/orders'));
  assert.equal(listRes.status, 401);

  // Public customer GET /api/orders?id=... -> 200
  const detailRes = await ordersApi.GET(new Request(`http://localhost/api/orders?id=${okBody.order.id}`));
  assert.equal(detailRes.status, 200);
});
