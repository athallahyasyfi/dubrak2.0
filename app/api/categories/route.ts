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

      if (!error && dbCategories) {
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
      const supabase = createAdminClient();
      const { error } = await supabase
        .from('categories')
        .insert({
          id: newCategory.id,
          name: newCategory.name,
          sort_order: newCategory.sort_order,
        });
      if (error) {
        return NextResponse.json({ error: `Gagal menyimpan kategori ke Supabase: ${error.message}` }, { status: 500 });
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

    let supaUpdated = false;
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from('categories')
        .update({
          name: name.trim(),
          ...(sort_order !== undefined ? { sort_order } : {}),
        })
        .eq('id', id);
      if (error) {
        return NextResponse.json({ error: `Gagal mengubah kategori di Supabase: ${error.message}` }, { status: 500 });
      }
      supaUpdated = true;
    }

    const updated = updateLocalCategory(id, name.trim(), sort_order);
    if (!updated && !supaUpdated) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ category: updated || { id, name: name.trim(), ...(sort_order !== undefined ? { sort_order } : {}) } });
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

    let supaDeleted = false;
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = createAdminClient();
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) {
        return NextResponse.json({ error: `Gagal menghapus kategori di Supabase: ${error.message}` }, { status: 500 });
      }
      supaDeleted = true;
    }

    const deleted = deleteLocalCategory(id);
    return NextResponse.json({ success: supaDeleted || deleted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus kategori' }, { status: 500 });
  }
}
