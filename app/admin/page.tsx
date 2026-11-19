'use client';

import React, { useState, useEffect } from 'react';
import { MenuItem, Category, Order, ModifierGroup, ModifierOption } from '@/types';
import { ArrowLeft, Plus, Edit2, Trash2, X, Check, Layers, Tag, Banknote, CreditCard, Upload } from 'lucide-react';
import Link from 'next/link';
import { StaffAuthGate } from '@/components/auth/StaffAuthGate';

function AdminDashboardContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'laporan' | 'menu'>('menu');
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CASH' | 'QRIS'>('ALL');

  // Modal CRUD State Menu
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Category CRUD State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [showInlineAddCategory, setShowInlineAddCategory] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState('');

  // Form Fields Menu
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formModifierGroups, setFormModifierGroups] = useState<ModifierGroup[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar yang valid (JPG/JPEG/PNG).');
      return;
    }

    setImageProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        setImageProcessing(false);
        return;
      }

      const img = new Image();
      img.onload = () => {
        // Otomatis kompres & resize gambar agar hemat storage & cepat dimuat
        const maxDim = 800;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setFormImageUrl(compressed);
        } else {
          setFormImageUrl(result);
        }
        setImageProcessing(false);
      };
      img.onerror = () => {
        setFormImageUrl(result);
        setImageProcessing(false);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const fetchMenuData = async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setMenuItems(data.menuItems || []);
        if (data.categories?.length > 0 && !formCategory) {
          setFormCategory(data.categories[0].id);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat menu:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (data.orders) setOrders(data.orders);
      }
    } catch (err) {
      console.warn(err);
    }
  };

  useEffect(() => {
    fetchMenuData();
    fetchOrders();
  }, []);

  // Category Handlers
  const handleAddCategory = async (name: string) => {
    if (!name.trim()) return null;
    setCategoryLoading(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewCategoryName('');
        await fetchMenuData();
        return data.category;
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menambahkan kategori');
        return null;
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menambahkan kategori');
      return null;
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleUpdateCategory = async (id: string, name: string) => {
    if (!name.trim()) return;
    setCategoryLoading(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: name.trim() }),
      });
      if (res.ok) {
        setEditingCategoryId(null);
        await fetchMenuData();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal mengubah kategori');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat mengubah kategori');
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string, catName: string) => {
    const count = menuItems.filter((m) => m.category_id === id).length;
    const msg = count > 0
      ? `Kategori "${catName}" memiliki ${count} menu. Yakin ingin menghapus kategori ini?`
      : `Hapus kategori "${catName}"?`;
    if (!confirm(msg)) return;

    setCategoryLoading(true);
    try {
      const res = await fetch(`/api/categories?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (formCategory === id) {
          setFormCategory(categories.find((c) => c.id !== id)?.id || '');
        }
        await fetchMenuData();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menghapus kategori');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menghapus kategori');
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineCategoryName.trim()) return;
    const newCat = await handleAddCategory(inlineCategoryName);
    if (newCat) {
      setFormCategory(newCat.id);
      setInlineCategoryName('');
      setShowInlineAddCategory(false);
    }
  };

  // Menu Modal Openers
  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategory(categories[0]?.id || '');
    setFormPrice('');
    setFormDescription('');
    setFormImageUrl('');
    setShowUrlInput(false);
    setShowInlineAddCategory(categories.length === 0);

    const sambalGroupId = `grp-sambal-${Date.now()}`;
    const addonGroupId = `grp-addon-${Date.now() + 1}`;
    setFormModifierGroups([
      {
        id: sambalGroupId,
        menu_item_id: '',
        title: 'Pilihan Sambal',
        is_required: true,
        min_selection: 1,
        max_selection: 1,
        options: [
          { id: `opt-s1-${Date.now()}`, group_id: sambalGroupId, name: 'Sambal Korek Bawang', price: 0, is_available: true },
          { id: `opt-s2-${Date.now() + 1}`, group_id: sambalGroupId, name: 'Sambal Matah Bali', price: 0, is_available: true },
          { id: `opt-s3-${Date.now() + 2}`, group_id: sambalGroupId, name: 'Sambal Ijo Gurih', price: 0, is_available: true },
        ],
      },
      {
        id: addonGroupId,
        menu_item_id: '',
        title: 'Extra Add-ons',
        is_required: false,
        min_selection: 0,
        max_selection: 10,
        options: [
          { id: `opt-a1-${Date.now()}`, group_id: addonGroupId, name: 'Extra Keju Mozarella', price: 5000, is_available: true },
          { id: `opt-a2-${Date.now() + 1}`, group_id: addonGroupId, name: 'Extra Kol Goreng', price: 3000, is_available: true },
          { id: `opt-a3-${Date.now() + 2}`, group_id: addonGroupId, name: 'Extra Telur Dadar Crispy', price: 4000, is_available: true },
        ],
      },
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category_id);
    setFormPrice(item.base_price.toString());
    setFormDescription(item.description || '');
    setFormImageUrl(item.image_url || '');
    setShowUrlInput(false);
    setFormModifierGroups(item.modifier_groups ? JSON.parse(JSON.stringify(item.modifier_groups)) : []);
    setIsModalOpen(true);
  };

  // Helper Group Modifier Form
  const addModifierGroup = (type: 'sambal' | 'addon') => {
    const newGroupId = `grp-${Date.now()}`;
    const newGroup: ModifierGroup = {
      id: newGroupId,
      menu_item_id: editingItem?.id || '',
      title: type === 'sambal' ? 'Pilihan Sambal' : 'Extra Add-ons',
      is_required: type === 'sambal',
      min_selection: type === 'sambal' ? 1 : 0,
      max_selection: type === 'sambal' ? 1 : 10,
      options: [
        {
          id: `opt-${Date.now()}`,
          group_id: newGroupId,
          name: type === 'sambal' ? 'Sambal Korek' : 'Extra Keju Mozarella',
          price: type === 'sambal' ? 0 : 5000,
          is_available: true,
        },
      ],
    };
    setFormModifierGroups((prev) => [...prev, newGroup]);
  };

  const removeModifierGroup = (groupId: string) => {
    setFormModifierGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const updateModifierGroupTitle = (groupId: string, title: string) => {
    setFormModifierGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, title } : g))
    );
  };

  const addModifierOption = (groupId: string) => {
    const newOption: ModifierOption = {
      id: `opt-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      group_id: groupId,
      name: '',
      price: 0,
      is_available: true,
    };
    setFormModifierGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, options: [...g.options, newOption] } : g))
    );
  };

  const removeModifierOption = (groupId: string, optionId: string) => {
    setFormModifierGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, options: g.options.filter((opt) => opt.id !== optionId) }
          : g
      )
    );
  };

  const updateModifierOption = (
    groupId: string,
    optionId: string,
    name: string,
    price: number
  ) => {
    setFormModifierGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: g.options.map((opt) =>
                opt.id === optionId ? { ...opt, name, price } : opt
              ),
            }
          : g
      )
    );
  };

  // Simpan Menu
  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPrice) {
      alert('Nama dan harga menu wajib diisi');
      return;
    }

    const cleanedGroups: ModifierGroup[] = formModifierGroups.map((g) => ({
      ...g,
      options: g.options.filter((opt) => opt.name && opt.name.trim() !== ''),
    }));

    setIsSubmitting(true);
    try {
      if (editingItem) {
        const res = await fetch('/api/menu', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            name: formName,
            category_id: formCategory,
            base_price: Number(formPrice),
            description: formDescription,
            image_url: formImageUrl,
            modifier_groups: cleanedGroups,
          }),
        });

        if (res.ok) {
          setIsModalOpen(false);
          await fetchMenuData();
        } else {
          const err = await res.json();
          alert(err.error || 'Gagal mengubah menu');
        }
      } else {
        const res = await fetch('/api/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            category_id: formCategory,
            base_price: Number(formPrice),
            description: formDescription,
            image_url: formImageUrl,
            modifier_groups: cleanedGroups,
          }),
        });

        if (res.ok) {
          setIsModalOpen(false);
          await fetchMenuData();
        } else {
          const err = await res.json();
          alert(err.error || 'Gagal menambahkan menu');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleItemAvailability = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          is_available: !currentStatus,
        }),
      });

      if (res.ok) {
        setMenuItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, is_available: !currentStatus } : item))
        );
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const handleDeleteMenu = async (id: string, name: string) => {
    if (!confirm(`Hapus menu "${name}"?`)) return;

    try {
      const res = await fetch(`/api/menu?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMenuItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert('Gagal menghapus menu');
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const handleDeleteOrder = async (orderId: string, queueCode: string, customerName: string) => {
    if (!confirm(`Hapus transaksi pesanan ${queueCode} (${customerName})?`)) return;
    try {
      const res = await fetch(`/api/orders?id=${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menghapus transaksi');
      }
    } catch (e: any) {
      alert(`Terjadi kesalahan: ${e.message}`);
    }
  };

  // Metrik Keuangan
  const paidOrders = orders.filter((o) => ['DIPROSES', 'SIAP_DIAMBIL', 'SELESAI'].includes(o.status));
  const totalOmzet = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const cashOmzet = paidOrders.filter((o) => o.payment_method === 'CASH').reduce((sum, o) => sum + o.total_amount, 0);
  const qrisOmzet = paidOrders.filter((o) => o.payment_method === 'QRIS').reduce((sum, o) => sum + o.total_amount, 0);

  const filteredReportOrders = orders.filter((o) => {
    if (paymentFilter === 'CASH') return o.payment_method === 'CASH';
    if (paymentFilter === 'QRIS') return o.payment_method === 'QRIS';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FAF6F3] text-[#1C1917] flex flex-col">
      {/* Header Admin */}
      <header className="bg-white border-b border-[#E6DCD5] px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-md bg-[#FAF6F3] border border-[#E6DCD5] hover:bg-[#EFE8E2] transition text-[#1C1917]"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-bold text-base text-[#1C1917] tracking-tight">
                Admin Kios — Ayam Dubrak!
              </h1>
              <p className="text-xs text-[#78716C]">
                Kelola menu, kustomisasi sambal & add-on, dan laporan omzet harian.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-[#FAF6F3] p-1 rounded-md border border-[#E6DCD5]">
              <button
                onClick={() => setActiveTab('menu')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  activeTab === 'menu'
                    ? 'bg-white text-[#1C1917] font-semibold shadow-2xs border border-[#E6DCD5]'
                    : 'text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                Menu Kios
              </button>
              <button
                onClick={() => setActiveTab('laporan')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  activeTab === 'laporan'
                    ? 'bg-white text-[#1C1917] font-semibold shadow-2xs border border-[#E6DCD5]'
                    : 'text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                Laporan Penjualan
              </button>
            </div>

            {activeTab === 'menu' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="bg-white hover:bg-[#FAF6F3] text-[#44403C] border border-[#DCD2CB] px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Tag className="w-3.5 h-3.5 text-[#D9381E]" />
                  <span>Kelola Kategori ({categories.length})</span>
                </button>
                <button
                  onClick={openAddModal}
                  className="bg-[#D9381E] hover:bg-[#C02E16] text-white px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Menu</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto w-full p-6 flex-1 pb-20">
        {activeTab === 'menu' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1C1917]">Daftar Menu Kios ({menuItems.length})</h2>
            </div>

            {/* Grid Menu Items */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg p-4 border border-[#E6DCD5] flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-[#FAF6F3] border border-[#E6DCD5] shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-semibold text-xs text-[#D9381E]">
                            Dubrak
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-medium text-[#78716C] block">
                          {categories.find((c) => c.id === item.category_id)?.name || 'Tanpa Kategori'}
                        </span>
                        <h3 className="font-semibold text-sm text-[#1C1917] line-clamp-1">{item.name}</h3>
                        <span className="text-sm font-mono font-semibold text-[#D9381E] tabular-nums block mt-0.5">
                          Rp {item.base_price.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-xs text-[#57534E] line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    {/* Breakdown Modifiers (Sambal & Add-ons) */}
                    {item.modifier_groups && item.modifier_groups.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-[#EFE8E2]">
                        {item.modifier_groups.map((g) => (
                          <div key={g.id} className="text-[11px] text-[#57534E]">
                            <div className="flex items-center justify-between font-semibold text-[#1C1917]">
                              <span>{g.title}</span>
                              <span className="text-[10px] text-[#78716C] font-mono">
                                {g.is_required ? 'Wajib (1)' : 'Opsional'} · {g.options.length} opsi
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {g.options.map((opt) => (
                                <span
                                  key={opt.id}
                                  className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                    opt.is_available !== false
                                      ? 'bg-[#FAF6F3] text-[#44403C] border-[#E6DCD5]'
                                      : 'bg-stone-100 text-stone-400 border-stone-200 line-through'
                                  }`}
                                >
                                  {opt.name} {opt.price > 0 && `(+${opt.price / 1000}k)`}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 mt-3 border-t border-[#EFE8E2] flex items-center justify-between text-xs">
                    <button
                      onClick={() => toggleItemAvailability(item.id, item.is_available)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition border ${
                        item.is_available
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {item.is_available ? 'Aktif' : 'Non-aktif'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 rounded text-[#78716C] hover:text-[#1C1917] hover:bg-[#FAF6F3] transition"
                        title="Edit Menu & Kustomisasi"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMenu(item.id, item.name)}
                        className="p-1.5 rounded text-red-600 hover:text-red-700 hover:bg-red-50 transition"
                        title="Hapus Menu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* TAB LAPORAN */
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border border-[#E6DCD5] space-y-1">
                <span className="text-xs font-medium text-[#78716C] block">
                  Total Omzet Hari Ini
                </span>
                <div className="text-xl font-mono font-bold text-[#D9381E] tabular-nums">
                  Rp {totalOmzet.toLocaleString('id-ID')}
                </div>
                <p className="text-[11px] text-[#78716C]">Semua pesanan yang terbayar</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#E6DCD5] space-y-1">
                <span className="text-xs font-medium text-[#78716C] block">
                  Penerimaan Kasir (Tunai)
                </span>
                <div className="text-xl font-mono font-bold text-emerald-700 tabular-nums">
                  Rp {cashOmzet.toLocaleString('id-ID')}
                </div>
                <p className="text-[11px] text-[#78716C]">Pembayaran cash di meja kasir</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#E6DCD5] space-y-1">
                <span className="text-xs font-medium text-[#78716C] block">
                  Penerimaan QRIS
                </span>
                <div className="text-xl font-mono font-bold text-blue-600 tabular-nums">
                  Rp {qrisOmzet.toLocaleString('id-ID')}
                </div>
                <p className="text-[11px] text-[#78716C]">Pembayaran non-tunai</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#E6DCD5] space-y-1">
                <span className="text-xs font-medium text-[#78716C] block">
                  Total Pesanan Masuk
                </span>
                <div className="text-xl font-mono font-bold text-[#1C1917] tabular-nums">{orders.length}</div>
                <p className="text-[11px] text-[#78716C]">Seluruh antrean hari ini</p>
              </div>
            </div>

            {/* Riwayat Table */}
            <div className="bg-white rounded-lg border border-[#E6DCD5] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#EFE8E2] flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-sm text-[#1C1917]">Riwayat Transaksi Pesanan</h3>
                <div className="flex items-center gap-1 bg-[#FAF6F3] p-1 rounded-md border border-[#E6DCD5]">
                  <button
                    onClick={() => setPaymentFilter('ALL')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      paymentFilter === 'ALL'
                        ? 'bg-white text-[#1C1917] font-semibold shadow-2xs border border-[#E6DCD5]'
                        : 'text-[#78716C] hover:text-[#1C1917]'
                    }`}
                  >
                    Semua ({orders.length})
                  </button>
                  <button
                    onClick={() => setPaymentFilter('CASH')}
                    className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                      paymentFilter === 'CASH'
                        ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                        : 'text-[#78716C] hover:text-[#1C1917]'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Cash ({orders.filter((o) => o.payment_method === 'CASH').length})</span>
                  </button>
                  <button
                    onClick={() => setPaymentFilter('QRIS')}
                    className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                      paymentFilter === 'QRIS'
                        ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                        : 'text-[#78716C] hover:text-[#1C1917]'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>QRIS ({orders.filter((o) => o.payment_method === 'QRIS').length})</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#FAF6F3] text-[#57534E] font-semibold border-b border-[#EFE8E2]">
                    <tr>
                      <th className="py-2.5 px-4">No. Pesanan</th>
                      <th className="py-2.5 px-4">Waktu</th>
                      <th className="py-2.5 px-4">Pelanggan</th>
                      <th className="py-2.5 px-4">Jam Pickup</th>
                      <th className="py-2.5 px-4">Total</th>
                      <th className="py-2.5 px-4">Metode</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE8E2]">
                    {filteredReportOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[#78716C]">
                          Belum ada transaksi dengan metode pembayaran ini.
                        </td>
                      </tr>
                    ) : (
                      filteredReportOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-[#FAF6F3]/60">
                          <td className="py-2.5 px-4 font-mono font-semibold text-[#D9381E] tabular-nums">{o.queue_code}</td>
                          <td className="py-2.5 px-4 font-mono text-[#78716C] tabular-nums">
                            {new Date(o.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-[#1C1917]">
                            {o.customer_name} <span className="text-[#78716C] font-mono">({o.customer_phone})</span>
                          </td>
                          <td className="py-2.5 px-4 font-medium text-[#1C1917]">
                            {o.is_asap ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                                Langsung Dimasak
                              </span>
                            ) : (
                              <span className="font-mono text-[#D9381E] bg-[#FCEAE6] px-2 py-0.5 rounded border border-[#F5D0C8] text-[11px]">
                                Jam {o.pickup_scheduled_time}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-semibold text-[#1C1917] tabular-nums">
                            Rp {o.total_amount.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-4 font-medium">{o.payment_method || '-'}</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#FCEAE6] text-[#D9381E]">
                              {o.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => handleDeleteOrder(o.id, o.queue_code, o.customer_name)}
                              className="p-1 rounded text-red-600 hover:text-red-700 hover:bg-red-50 transition"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL TAMBAH & EDIT MENU DENGAN CRUD SAMBAL & ADD-ON */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-5 shadow-xl border border-[#E6DCD5] space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFE8E2]">
              <h3 className="font-semibold text-base text-[#1C1917]">
                {editingItem ? 'Edit Menu' : 'Tambah Menu'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded text-[#78716C] hover:text-[#1C1917]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMenu} className="space-y-4 text-xs">
              {/* Bagian 1: Data Pokok Menu */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="font-medium text-[#44403C] block">Nama Menu *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama menu"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-[#DCD2CB] bg-[#FAF6F3] focus:bg-white focus:outline-hidden focus:border-[#D9381E] text-xs font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-[#44403C] block">Kategori *</label>
                      <button
                        type="button"
                        onClick={() => setShowInlineAddCategory(!showInlineAddCategory)}
                        className="text-[11px] font-semibold text-[#D9381E] hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Kategori Baru</span>
                      </button>
                    </div>

                    {categories.length === 0 || showInlineAddCategory ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Nama kategori baru"
                          value={inlineCategoryName}
                          onChange={(e) => setInlineCategoryName(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 rounded-md border border-[#D9381E] bg-white text-xs font-medium focus:outline-hidden"
                          autoFocus={categories.length === 0}
                        />
                        <button
                          type="button"
                          onClick={handleQuickAddCategory}
                          disabled={categoryLoading || !inlineCategoryName.trim()}
                          className="bg-[#D9381E] hover:bg-[#C02E16] text-white px-2.5 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50 transition"
                        >
                          Simpan
                        </button>
                        {categories.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowInlineAddCategory(false);
                              setInlineCategoryName('');
                            }}
                            className="p-1.5 text-[#78716C] hover:text-[#1C1917]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-[#DCD2CB] bg-[#FAF6F3] focus:bg-white focus:outline-hidden focus:border-[#D9381E] text-xs font-medium"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-[#44403C] block">Harga Dasar (Rp) *</label>
                    <input
                      type="number"
                      required
                      placeholder="Harga"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-[#DCD2CB] bg-[#FAF6F3] focus:bg-white focus:outline-hidden focus:border-[#D9381E] text-xs font-mono font-semibold tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[#44403C] block">Deskripsi Menu</label>
                  <textarea
                    rows={2}
                    placeholder="Deskripsi"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-[#DCD2CB] bg-[#FAF6F3] focus:bg-white focus:outline-hidden focus:border-[#D9381E] text-xs"
                  />
                </div>

                {/* Input Foto Menu JPG */}
                <div className="space-y-1.5">
                  <label className="font-medium text-[#44403C] block text-xs">
                    Foto Menu (Format JPG / JPEG / PNG)
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageFileChange}
                  />

                  {formImageUrl ? (
                    <div className="space-y-2">
                      <div className="relative rounded-md overflow-hidden border border-[#E6DCD5] bg-[#FAF6F3] aspect-video max-h-48 flex items-center justify-center">
                        <img
                          src={formImageUrl}
                          alt="Preview Menu"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormImageUrl('')}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md transition"
                          title="Hapus foto"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#DCD2CB] bg-white hover:bg-stone-50 text-xs font-semibold text-[#1C1917] transition"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#D9381E]" />
                          <span>Pilih Foto JPG Lain</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormImageUrl('')}
                          className="text-[11px] text-[#D9381E] hover:underline font-medium"
                        >
                          Hapus Foto
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) processImageFile(file);
                      }}
                      className="border-2 border-dashed border-[#DCD2CB] hover:border-[#D9381E] bg-[#FAF6F3] hover:bg-[#FCEAE6]/30 rounded-lg p-5 text-center cursor-pointer transition space-y-2"
                    >
                      <div className="w-10 h-10 rounded-full bg-white border border-[#E6DCD5] mx-auto flex items-center justify-center text-[#D9381E]">
                        {imageProcessing ? (
                          <div className="w-5 h-5 border-2 border-[#D9381E] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-xs text-[#1C1917]">
                          {imageProcessing ? 'Memproses foto JPG...' : 'Klik atau Tarik Foto JPG ke Sini'}
                        </p>
                        <p className="text-[11px] text-[#78716C]">
                          Mendukung JPG, JPEG, PNG (otomatis dikompres & dioptimasi)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Toggle untuk input URL alternatif */}
                  <div className="pt-1">
                    {!showUrlInput ? (
                      <button
                        type="button"
                        onClick={() => setShowUrlInput(true)}
                        className="text-[11px] text-[#78716C] hover:text-[#D9381E] transition underline"
                      >
                        Atau masukkan URL link gambar
                      </button>
                    ) : (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-medium text-[#78716C]">
                            URL Link Gambar
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowUrlInput(false)}
                            className="text-[10px] text-[#78716C] hover:text-[#1C1917]"
                          >
                            Tutup
                          </button>
                        </div>
                        <input
                          type="url"
                          placeholder="https://..."
                          value={formImageUrl}
                          onChange={(e) => setFormImageUrl(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-md border border-[#DCD2CB] bg-white focus:outline-hidden focus:border-[#D9381E] text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bagian 2: CRUD Kustomisasi Pilihan Sambal & Add-ons */}
              <div className="pt-3 border-t border-[#EFE8E2] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold text-xs text-[#1C1917] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#D9381E]" />
                    <span>Pilihan Sambal & Add-on</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addModifierGroup('sambal')}
                      className="text-[11px] font-semibold text-[#D9381E] bg-[#FCEAE6] hover:bg-[#F5D0C8] px-2 py-1 rounded border border-[#F5D0C8] flex items-center gap-1 transition"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Grup Sambal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addModifierGroup('addon')}
                      className="text-[11px] font-semibold text-[#44403C] bg-[#FAF6F3] hover:bg-[#EFE8E2] px-2 py-1 rounded border border-[#E6DCD5] flex items-center gap-1 transition"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Grup Add-on</span>
                    </button>
                  </div>
                </div>

                {formModifierGroups.length === 0 ? (
                  <div className="p-3 text-center rounded border border-dashed border-[#E6DCD5] text-[11px] text-[#78716C]">
                    Belum ada pilihan sambal atau extra add-on untuk menu ini.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formModifierGroups.map((group) => (
                      <div
                        key={group.id}
                        className="bg-[#FAF6F3] p-3 rounded-lg border border-[#E6DCD5] space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={group.title}
                              onChange={(e) => updateModifierGroupTitle(group.id, e.target.value)}
                              className="font-semibold text-xs text-[#1C1917] bg-white px-2 py-1 rounded border border-[#DCD2CB] focus:border-[#D9381E] focus:outline-hidden"
                            />
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                                group.is_required
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-stone-100 text-stone-600 border-stone-200'
                              }`}
                            >
                              {group.is_required ? 'Wajib (1 Opsi)' : 'Opsional (Topping)'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeModifierGroup(group.id)}
                            className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Hapus Grup"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Opsi di dalam grup */}
                        <div className="space-y-1.5 pl-2 border-l-2 border-[#D9381E]/30">
                          {group.options.map((opt) => (
                            <div key={opt.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Nama opsi"
                                value={opt.name}
                                onChange={(e) =>
                                  updateModifierOption(group.id, opt.id, e.target.value, opt.price)
                                }
                                className="flex-1 bg-white px-2 py-1 rounded border border-[#DCD2CB] text-xs focus:border-[#D9381E] focus:outline-hidden"
                              />
                              <div className="flex items-center gap-1 w-28">
                                <span className="text-[11px] text-[#78716C] font-mono">Rp</span>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={opt.price === 0 ? '' : opt.price}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateModifierOption(
                                      group.id,
                                      opt.id,
                                      opt.name,
                                      val === '' ? 0 : Number(val)
                                    );
                                  }}
                                  className="w-full bg-white px-2 py-1 rounded border border-[#DCD2CB] text-xs font-mono tabular-nums focus:border-[#D9381E] focus:outline-hidden"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeModifierOption(group.id, opt.id)}
                                className="p-1 text-[#78716C] hover:text-red-600"
                                title="Hapus Opsi"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => addModifierOption(group.id)}
                            className="text-[11px] font-semibold text-[#D9381E] hover:underline flex items-center gap-1 mt-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Tambah Opsi</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tombol Simpan */}
              <div className="pt-3 border-t border-[#EFE8E2] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-md border border-[#DCD2CB] font-medium text-[#57534E] hover:bg-[#FAF6F3]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#D9381E] hover:bg-[#C02E16] text-white font-semibold py-2 px-4 rounded-md transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Tambah Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KELOLA KATEGORI */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 shadow-xl border border-[#E6DCD5] space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFE8E2]">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#D9381E]" />
                <h3 className="font-semibold text-base text-[#1C1917]">Kelola Kategori Menu</h3>
              </div>
              <button
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCategoryId(null);
                }}
                className="p-1 rounded text-[#78716C] hover:text-[#1C1917]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Tambah Kategori */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleAddCategory(newCategoryName);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Nama kategori baru"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md border border-[#DCD2CB] bg-[#FAF6F3] focus:bg-white focus:outline-hidden focus:border-[#D9381E] text-xs font-medium"
              />
              <button
                type="submit"
                disabled={categoryLoading || !newCategoryName.trim()}
                className="bg-[#D9381E] hover:bg-[#C02E16] text-white px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah</span>
              </button>
            </form>

            {/* List Kategori */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {categories.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#78716C]">
                  Belum ada kategori. Silakan tambahkan kategori di atas.
                </div>
              ) : (
                categories.map((c) => {
                  const itemCount = menuItems.filter((m) => m.category_id === c.id).length;
                  const isEditing = editingCategoryId === c.id;

                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3 rounded-md border border-[#EFE8E2] bg-[#FAF6F3]/60 hover:bg-[#FAF6F3] transition"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <input
                            type="text"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            className="flex-1 px-2.5 py-1 rounded border border-[#D9381E] bg-white text-xs font-medium focus:outline-hidden"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateCategory(c.id, editingCategoryName)}
                            disabled={categoryLoading || !editingCategoryName.trim()}
                            className="p-1.5 text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 transition"
                            title="Simpan"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategoryId(null)}
                            className="p-1.5 text-[#78716C] hover:text-[#1C1917] rounded"
                            title="Batal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-xs text-[#1C1917]">{c.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#78716C] border border-[#E6DCD5]">
                            {itemCount} menu
                          </span>
                        </div>
                      )}

                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryId(c.id);
                              setEditingCategoryName(c.name);
                            }}
                            className="p-1.5 text-[#78716C] hover:text-[#1C1917] rounded hover:bg-white transition"
                            title="Ubah Nama"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(c.id, c.name)}
                            className="p-1.5 text-red-600 hover:text-red-700 rounded hover:bg-red-50 transition"
                            title="Hapus Kategori"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-[#EFE8E2] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCategoryId(null);
                }}
                className="px-4 py-2 rounded-md border border-[#DCD2CB] text-xs font-semibold text-[#57534E] hover:bg-[#FAF6F3] transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <StaffAuthGate role="admin" title="Login Admin">
      <AdminDashboardContent />
    </StaffAuthGate>
  );
}
