import { NextResponse } from 'next/server';
import {
  getLocalMenuItems,
  getLocalCategories,
  addLocalMenuItem,
  updateLocalMenuItem,
  deleteLocalMenuItem,
} from '@/lib/store/menu-store';
import { createAdminClient } from '@/lib/supabase/server';
import { MenuItem } from '@/types';
import { getServerSession } from '@/lib/security/auth-store';

export async function GET() {
  let categories = getLocalCategories();

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = createAdminClient();

      // Ambil kategori dari Supabase
      const { data: dbCategories } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (dbCategories && dbCategories.length > 0) {
        categories = dbCategories;
      }

      const { data: dbMenus, error } = await supabase
        .from('menus')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && dbMenus && dbMenus.length > 0) {
        // Map ke format MenuItem
        const mappedItems: MenuItem[] = dbMenus.map((m: any) => ({
          id: m.id,
          name: m.name,
          category_id: m.category || (categories[0]?.id ?? 'cat-paket'),
          description: m.description,
          base_price: m.price,
          image_url: m.image_url,
          is_available: m.is_available ?? true,
          modifier_groups: m.modifier_groups || [],
        }));

        return NextResponse.json({
          categories,
          menuItems: mappedItems,
        });
      }
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to local store:', e);
    }
  }

  return NextResponse.json({
    categories,
    menuItems: getLocalMenuItems(),
  });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 401 });
    }

    const body = await request.json();
    const { name, category_id, description, base_price, image_url, modifier_groups } = body;

    if (!name || !base_price || !category_id) {
      return NextResponse.json({ error: 'Nama, kategori, dan harga wajib diisi' }, { status: 400 });
    }

    const newItemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: MenuItem = {
      id: newItemId,
      name,
      category_id,
      description: description || null,
      base_price: Number(base_price),
      image_url: image_url || null,
      is_available: true,
      modifier_groups: modifier_groups || [],
    };

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createAdminClient();
        const { data: dbItem, error } = await supabase
          .from('menus')
          .insert({
            name: newItem.name,
            category: newItem.category_id,
            description: newItem.description,
            price: newItem.base_price,
            image_url: newItem.image_url,
            is_available: true,
            modifier_groups: newItem.modifier_groups,
          })
          .select()
          .single();

        if (!error && dbItem) {
          addLocalMenuItem({ ...newItem, id: dbItem.id });
          return NextResponse.json({ item: { ...newItem, id: dbItem.id } }, { status: 201 });
        }
      } catch (err) {
        console.warn('Supabase insert failed:', err);
      }
    }

    addLocalMenuItem(newItem);
    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menambahkan menu' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, category_id, description, base_price, image_url, is_available, modifier_groups } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID menu diperlukan' }, { status: 400 });
    }

    const updatePayload: Partial<MenuItem> = {};
    if (name !== undefined) updatePayload.name = name;
    if (category_id !== undefined) updatePayload.category_id = category_id;
    if (description !== undefined) updatePayload.description = description;
    if (base_price !== undefined) updatePayload.base_price = Number(base_price);
    if (image_url !== undefined) updatePayload.image_url = image_url;
    if (is_available !== undefined) updatePayload.is_available = is_available;
    if (modifier_groups !== undefined) updatePayload.modifier_groups = modifier_groups;

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createAdminClient();
        const supaPayload: any = {};
        if (updatePayload.name !== undefined) supaPayload.name = updatePayload.name;
        if (updatePayload.category_id !== undefined) supaPayload.category = updatePayload.category_id;
        if (updatePayload.description !== undefined) supaPayload.description = updatePayload.description;
        if (updatePayload.base_price !== undefined) supaPayload.price = updatePayload.base_price;
        if (updatePayload.image_url !== undefined) supaPayload.image_url = updatePayload.image_url;
        if (updatePayload.is_available !== undefined) supaPayload.is_available = updatePayload.is_available;
        if (updatePayload.modifier_groups !== undefined) supaPayload.modifier_groups = updatePayload.modifier_groups;

        await supabase
          .from('menus')
          .update(supaPayload)
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase update failed:', err);
      }
    }

    const updated = updateLocalMenuItem(id, updatePayload);
    if (!updated) {
      return NextResponse.json({ error: 'Menu tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ item: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengubah menu' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID menu diperlukan' }, { status: 400 });
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createAdminClient();
        await supabase.from('menus').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete failed:', err);
      }
    }

    const deleted = deleteLocalMenuItem(id);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus menu' }, { status: 500 });
  }
}
