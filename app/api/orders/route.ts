import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getLocalMenuItems } from '@/lib/store/menu-store';
import { MenuItem, Order, OrderItem } from '@/types';
import { generateLocalDailyQueueCode, saveLocalOrder, getLocalOrders, updateLocalOrderStatus, deleteLocalOrder } from '@/lib/store/order-store';
import { createAdminClient } from '@/lib/supabase/server';
import { checkOrderRateLimit } from '@/lib/security/rate-limit';
import { sanitizeInput } from '@/lib/security/sanitize';
import { getServerSession } from '@/lib/security/auth-store';

// Zod Schema untuk validasi & sanitasi input (OWASP Compliance)
const orderItemModifierSchema = z.object({
  group_title: z.string().max(100),
  option_name: z.string().max(100),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive().optional().default(1),
});

const orderItemSchema = z.object({
  menu_item_id: z.string().min(1),
  item_name: z.string().max(120),
  base_price: z.number().nonnegative(),
  quantity: z.number().int().positive().max(50),
  notes: z.string().max(250).nullable().optional(),
  subtotal: z.number().nonnegative(),
  modifiers: z.array(orderItemModifierSchema).optional(),
});

const createOrderSchema = z.object({
  customer_name: z.string().min(2, 'Nama minimal 2 karakter').max(50),
  customer_phone: z.string().min(8, 'Nomor HP tidak valid').max(20),
  table_number: z.string().max(20).nullable().optional(),
  pickup_type: z.enum(['AMBIL_SENDIRI', 'DRIVER_OJOL']),
  is_asap: z.boolean(),
  pickup_scheduled_time: z.string().nullable().optional(),
  payment_method: z.enum(['CASH', 'QRIS']).optional().default('QRIS'),
  notes: z.string().max(300).nullable().optional(),
  items: z.array(orderItemSchema).min(1, 'Pesanan minimal memiliki 1 menu'),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const date = searchParams.get('date');
  const isValidDate = Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date));

  // Coba ambil dari Supabase jika env terisi
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = createAdminClient();
      if (id) {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return NextResponse.json({ order: data });
      } else {
        let query = supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (isValidDate) {
          query = query
            .gte('created_at', `${date}T00:00:00+07:00`)
            .lte('created_at', `${date}T23:59:59.999+07:00`);
        } else {
          query = query.limit(500);
        }

        const { data, error } = await query;
        if (!error && data) return NextResponse.json({ orders: data });
      }
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to local store:', e);
    }
  }

  // Fallback ke local store
  const localOrders = getLocalOrders();
  if (id) {
    const found = localOrders.find((o) => o.id === id);
    if (!found) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ order: found });
  }

  const filteredLocal = isValidDate
    ? localOrders.filter(
        (o) => new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) === date
      )
    : localOrders;

  return NextResponse.json({ orders: filteredLocal });
}

async function getActiveCatalog(): Promise<MenuItem[]> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = createAdminClient();
      const { data: dbMenus, error } = await supabase.from('menus').select('*');
      if (!error && Array.isArray(dbMenus) && dbMenus.length > 0) {
        return dbMenus.map((m: any) => ({
          id: m.id,
          name: m.name,
          category_id: m.category || '',
          description: m.description,
          base_price: m.price,
          image_url: m.image_url,
          is_available: m.is_available ?? true,
          modifier_groups: m.modifier_groups || [],
        }));
      }
    } catch (err) {
      console.warn('Supabase catalog fetch failed, falling back to local catalog:', err);
    }
  }
  return getLocalMenuItems();
}

export async function POST(request: Request) {
  try {
    // Rate Limiting Anti-Spam (OWASP Guideline)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     request.headers.get('x-real-ip') ||
                     '127.0.0.1';

    const rateLimitCheck = checkOrderRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ error: rateLimitCheck.message }, { status: 429 });
    }

    const rawBody = await request.json();
    const validated = createOrderSchema.parse(rawBody);

    // Sanitasi input string (Anti-XSS)
    const sanitizedName = sanitizeInput(validated.customer_name);
    const sanitizedNotes = validated.notes ? sanitizeInput(validated.notes) : null;

    // Hitung ulang harga di sisi server (Anti-Tampering)
    let calculatedTotal = 0;
    const validatedItems: OrderItem[] = [];
    const currentCatalog = await getActiveCatalog();

    for (const item of validated.items) {
      const originalMenu = currentCatalog.find((m) => m.id === item.menu_item_id);
      if (!originalMenu) {
        return NextResponse.json(
          { error: `Menu "${item.item_name}" tidak ditemukan.` },
          { status: 400 }
        );
      }
      if (originalMenu.is_available === false) {
        return NextResponse.json(
          { error: `Menu "${originalMenu.name}" sedang habis.` },
          { status: 400 }
        );
      }

      const basePrice = originalMenu.base_price;
      let modifierTotal = 0;
      const validModifiers: any[] = [];

      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          const modQty = mod.quantity || 1;
          let foundOpt = undefined;
          if (originalMenu.modifier_groups) {
            for (const grp of originalMenu.modifier_groups) {
              const opt = grp.options.find((o) => o.name === mod.option_name);
              if (opt) {
                foundOpt = opt;
                break;
              }
            }
          }
          if (!foundOpt) {
            return NextResponse.json(
              { error: `Opsi "${mod.option_name}" pada menu "${originalMenu.name}" tidak ditemukan.` },
              { status: 400 }
            );
          }
          if (foundOpt.is_available === false) {
            return NextResponse.json(
              { error: `Opsi "${foundOpt.name}" sedang habis.` },
              { status: 400 }
            );
          }

          const verifiedPrice = foundOpt.price;
          modifierTotal += verifiedPrice * modQty;
          validModifiers.push({
            id: `mod-${Math.random().toString(36).substr(2, 6)}`,
            group_title: mod.group_title,
            option_name: foundOpt.name,
            price: verifiedPrice,
            quantity: modQty,
          });
        }
      }

      const itemSubtotal = (basePrice + modifierTotal) * item.quantity;
      calculatedTotal += itemSubtotal;

      validatedItems.push({
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        order_id: '',
        menu_item_id: item.menu_item_id,
        item_name: originalMenu.name,
        base_price: basePrice,
        quantity: item.quantity,
        notes: item.notes || null,
        subtotal: itemSubtotal,
        modifiers: validModifiers,
      });
    }

    const orderId = `order-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const { queueNumber, queueCode } = generateLocalDailyQueueCode();

    const newOrder: Order = {
      id: orderId,
      daily_queue_number: queueNumber,
      queue_code: queueCode,
      table_number: validated.table_number || null,
      customer_name: sanitizedName,
      customer_phone: validated.customer_phone,
      pickup_type: validated.pickup_type,
      is_asap: validated.is_asap,
      pickup_scheduled_time: validated.pickup_scheduled_time || null,
      notes: sanitizedNotes,
      status: 'MENUNGGU_BAYAR',
      total_amount: calculatedTotal,
      payment_method: validated.payment_method || 'QRIS',
      paid_at: null,
      created_at: new Date().toISOString(),
      items: validatedItems.map((i) => ({ ...i, order_id: orderId })),
    };

    // Jika Supabase terkoneksi, simpan ke Postgres
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createAdminClient();
        const { data: dbOrder, error: orderErr } = await supabase
          .from('orders')
          .insert({
            queue_code: newOrder.queue_code,
            customer_name: newOrder.customer_name,
            customer_phone: newOrder.customer_phone,
            table_number: newOrder.table_number,
            pickup_type: newOrder.pickup_type,
            is_asap: newOrder.is_asap,
            pickup_scheduled_time: newOrder.pickup_scheduled_time,
            payment_method: newOrder.payment_method,
            notes: newOrder.notes,
            status: 'MENUNGGU_BAYAR',
            total_amount: calculatedTotal,
            items: validatedItems,
          })
          .select()
          .single();

        if (!orderErr && dbOrder) {
          return NextResponse.json({ order: dbOrder }, { status: 201 });
        }
      } catch (err) {
        console.warn('Supabase insert failed, continuing with local store:', err);
      }
    }

    // Simpan ke local store
    saveLocalOrder(newOrder);

    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }
    console.error('Order error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Endpoint untuk update status pesanan (Konfirmasi Bayar / Selesai / Siap)
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Akses ditolak. Silakan login sebagai kasir atau admin.' }, { status: 401 });
    }

    const { id, status, payment_method } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
    }

    // Jika Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createAdminClient();
        const updatePayload: any = { status };
        if (payment_method) {
          updatePayload.payment_method = payment_method;
          updatePayload.paid_at = new Date().toISOString();
        }
        const { data, error } = await supabase
          .from('orders')
          .update(updatePayload)
          .eq('id', id)
          .select('*')
          .single();
        if (!error && data) return NextResponse.json({ order: data });
      } catch (e) {
        console.warn('Supabase update failed:', e);
      }
    }

    const updated = updateLocalOrderStatus(id, status, payment_method);
    if (!updated) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json({ order: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Endpoint untuk menghapus transaksi pesanan (Khusus Admin)
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID transaksi pesanan diperlukan' }, { status: 400 });
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createAdminClient();
        await supabase.from('orders').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase order delete failed:', err);
      }
    }

    const deleted = deleteLocalOrder(id);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus pesanan' }, { status: 500 });
  }
}
