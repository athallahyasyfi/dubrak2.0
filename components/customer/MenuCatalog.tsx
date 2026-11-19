'use client';

import React, { useState, useEffect } from 'react';
import { Category, MenuItem } from '@/types';
import { useCart } from '@/context/CartContext';
import { MenuItemModal } from './MenuItemModal';
import { CartDrawer } from './CartDrawer';
import { ShoppingBag, MapPin, Plus } from 'lucide-react';

export function MenuCatalog() {
  const { totalCount, totalAmount, addItem } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeItemForModal, setActiveItemForModal] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sync dengan menu terbaru dari database/admin
  useEffect(() => {
    fetch('/api/menu')
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) setCategories(data.categories);
        if (data.menuItems) setMenuItems(data.menuItems);
      })
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter((item) => item.category_id === selectedCategory);

  return (
    <div className="min-h-screen bg-[#FAF6F3] text-[#1C1917] pb-32">
      {/* Header Form Kios */}
      <header className="bg-white border-b border-[#E6DCD5] px-4 sm:px-6 py-4 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#1C1917] tracking-tight">
              Ayam Dubrak!
            </h1>
            <div className="flex items-start gap-1.5 text-xs text-[#78716C] mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#D9381E] shrink-0 mt-0.5" />
              <span className="leading-tight">Perumahan Bukit Alam Permai No.1 blok D4, Langkapura, Kec. Langkapura, Kota Bandar Lampung, Lampung 35144</span>
            </div>
          </div>

          {/* Tombol Keranjang */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative px-3.5 py-2 rounded-md bg-[#1C1917] text-white hover:bg-[#292524] transition flex items-center gap-2 text-xs font-medium"
            title="Lihat Keranjang Pesanan"
          >
            <ShoppingBag className="w-4 h-4 text-[#D9381E]" />
            <span>Keranjang</span>
            {totalCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[#D9381E] text-white text-[11px] font-mono font-semibold tabular-nums">
                {totalCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Filter Kategori */}
      <div className="sticky top-[69px] z-20 bg-[#FAF6F3]/95 backdrop-blur-xs border-b border-[#E6DCD5] py-2.5 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${selectedCategory === 'all'
              ? 'bg-[#D9381E] text-white font-semibold'
              : 'bg-white text-[#57534E] hover:bg-[#F5EFEA] border border-[#DCD2CB]'
              }`}
          >
            Semua Menu
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${isSelected
                  ? 'bg-[#D9381E] text-white font-semibold'
                  : 'bg-white text-[#57534E] hover:bg-[#F5EFEA] border border-[#DCD2CB]'
                  }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Daftar Menu */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-5">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-semibold text-[#1C1917]">
            Pilihan Menu Tersedia
          </h2>
          <span className="text-xs font-mono text-[#78716C]">
            {loading ? 'Memuat...' : `${filteredItems.length} menu`}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="animate-pulse bg-white rounded-lg p-4 border border-[#E6DCD5] h-56"
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg p-8 border border-[#E6DCD5] text-center text-xs text-[#78716C]">
            Belum ada menu di kategori ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg p-4 border border-[#E6DCD5] hover:border-[#D9381E]/50 transition flex flex-col justify-between"
              >
                <div>
                  {/* Foto Piring Melingkar Sesuai Referensi, Kontras dengan Card Sudut Tegas */}
                  <div className="flex justify-center mb-3">
                    <div className="w-24 h-24 rounded-full p-1 border-2 border-[#D9381E] bg-[#FAF6F3] overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-[#FCEAE6] flex items-center justify-center font-semibold text-xs text-[#D9381E]">
                          Dubrak
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Judul & Deskripsi */}
                  <h3 className="font-semibold text-sm text-[#1C1917] text-center line-clamp-1">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-[#78716C] text-center mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Harga & Tombol Pilih */}
                <div className="mt-4 pt-3 border-t border-[#EFE8E2] flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-[#78716C] block leading-none">Harga</span>
                    <span className="text-sm font-mono font-semibold text-[#1C1917] tabular-nums mt-1 block">
                      Rp {item.base_price.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!item.is_available}
                    onClick={() => setActiveItemForModal(item)}
                    className="px-3.5 py-2 rounded-md bg-[#D9381E] hover:bg-[#C02E16] disabled:bg-stone-200 disabled:text-stone-500 text-white font-semibold text-xs flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{item.is_available ? 'Pilih' : 'Habis'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bar Checkout Mengambang */}
      {totalCount > 0 && (
        <div className="fixed bottom-4 inset-x-0 z-40 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full bg-[#1C1917] hover:bg-[#292524] text-white p-3.5 rounded-lg shadow-lg border border-[#292524] flex items-center justify-between transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded bg-[#D9381E] text-white text-xs font-mono font-semibold flex items-center justify-center tabular-nums">
                  {totalCount}
                </span>
                <div className="text-left">
                  <span className="text-[11px] text-stone-400 block leading-tight">Total Sementara</span>
                  <span className="text-sm font-mono font-semibold tabular-nums">
                    Rp {totalAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div className="font-semibold text-xs bg-[#D9381E] text-white px-3.5 py-2 rounded-md">
                Lanjut Checkout
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Modal Kustomisasi Sambal & Add-ons */}
      <MenuItemModal
        item={activeItemForModal}
        onClose={() => setActiveItemForModal(null)}
        onAddToCart={addItem}
      />

      {/* Drawer Form Checkout */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />
    </div>
  );
}
