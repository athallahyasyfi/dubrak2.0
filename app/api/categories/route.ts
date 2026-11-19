import { NextResponse } from 'next/server';
import {
  getLocalCategories,
  addLocalCategory,
  updateLocalCategory,
  deleteLocalCategory,
} from '@/lib/store/menu-store';
import { createAdminClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/security/auth-store';
import { Category } from '@/types';

export async function GET() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = createAdminClient();
      const { data: dbCategories, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && dbCategories && dbCategories.length > 0) {
        return NextResponse.json({ categories: dbCategories });
      }
    } catch (e) {
      console.warn('Supabase categories fetch failed, falling back to local store:', e);
    }
  }

  return NextResponse.json({ categories: getLocalCategories() });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 401 });
    }

    const body = await request.json();
    const { name, sort_order } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 });
    }

    const newCategory = addLocalCategory(name.trim(), sort_order);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createAdminClient();
        await supabase
          .from('categories')
          .insert({
            id: newCategory.id,
            name: newCategory.name,
            sort_order: newCategory.sort_order,
          });
      } catch (err) {
        console.warn('Supabase category insert failed:', err);
      }
    }

    return NextResponse.json({ category: newCategory }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menambahkan kategori' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, sort_order } = body;

    if (!id || !name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'ID dan nama kategori wajib diisi' }, { status: 400 });
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createAdminClient();
        await supabase
          .from('categories')
          .update({
            name: name.trim(),
            ...(sort_order !== undefined ? { sort_order } : {}),
          })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase category update failed:', err);
      }
    }

    const updated = updateLocalCategory(id, name.trim(), sort_order);
    if (!updated) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ category: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengubah kategori' }, { status: 500 });
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
      return NextResponse.json({ error: 'ID kategori diperlukan' }, { status: 400 });
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createAdminClient();
        await supabase.from('categories').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase category delete failed:', err);
      }
    }

    const deleted = deleteLocalCategory(id);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus kategori' }, { status: 500 });
  }
}
