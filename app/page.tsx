import { Suspense } from 'react';
import { MenuCatalog } from '@/components/customer/MenuCatalog';
import { CartProvider } from '@/context/CartContext';

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF6F3]" />}>
      <CartProvider>
        <MenuCatalog />
      </CartProvider>
    </Suspense>
  );
}
