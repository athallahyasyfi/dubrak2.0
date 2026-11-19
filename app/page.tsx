import { Suspense } from 'react';
import { getLocalCategories, getLocalMenuItems } from '@/lib/store/menu-store';
import { MenuCatalog } from '@/components/customer/MenuCatalog';
import { CartProvider } from '@/context/CartContext';

export default function Home() {
  const categories = getLocalCategories();
  const menuItems = getLocalMenuItems();

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF6F3]" />}>
      <CartProvider>
        <MenuCatalog
          categories={categories}
          menuItems={menuItems}
        />
      </CartProvider>
    </Suspense>
  );
}
