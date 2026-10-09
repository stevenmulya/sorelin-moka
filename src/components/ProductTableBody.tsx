'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Edit2, Trash2, Star, Heart, GripVertical } from 'lucide-react';
import { deleteProduct, toggleBestSeller, toggleFavorite, updatePriorities } from '@/app/actions';

export default function ProductTableBody({ initialProducts }: { initialProducts: any[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to let the browser generate the drag image correctly before we add opacity
    setTimeout(() => {
      const el = e.target as HTMLElement;
      if (el) el.style.opacity = '0.5';
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    
    const newProducts = [...products];
    const draggedItem = newProducts[draggedIdx];
    
    newProducts.splice(draggedIdx, 1);
    newProducts.splice(index, 0, draggedItem);
    
    setDraggedIdx(index);
    setProducts(newProducts);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedIdx(null);
    const target = e.target as HTMLElement;
    const row = target.closest('tr');
    if (row) row.style.opacity = '1';

    // Calculate new priorities (top item gets highest priority)
    // To make it simple, we just assign descending priorities starting from length
    const maxPriority = Math.max(...products.map(p => p.priority), products.length);
    const updates = products.map((p, idx) => ({ id: p.id, priority: maxPriority - idx }));
    
    // Optimistic update in UI
    const updatedProducts = products.map((p, idx) => ({ ...p, priority: maxPriority - idx }));
    setProducts(updatedProducts);

    await updatePriorities(updates);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIdx(null);
    const target = e.target as HTMLElement;
    if (target) target.style.opacity = '1';
  };

  return (
    <tbody className="divide-y divide-gray-100">
      {products.map((product, index) => (
        <tr 
          key={product.id} 
          className="hover:bg-gray-50 transition-colors group cursor-grab active:cursor-grabbing"
          draggable={true}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        >
          <td className="px-6 py-4">
            <div className="flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-gray-300" />
              <span className="text-gray-900 font-semibold text-center">{product.priority}</span>
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-100 rounded-md overflow-hidden flex-shrink-0 border border-gray-200">
                <img src={product.images[0]?.url || '/placeholder.jpg'} alt={product.name} className="h-full w-full object-cover pointer-events-none" />
              </div>
              <div>
                <div className="font-medium text-gray-900">{product.name}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{product.description || '-'}</div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4">
            {product.discountPrice ? (
              <div>
                <div className="text-gray-900 font-medium">Rp {product.discountPrice.toLocaleString('id-ID')}</div>
                <div className="text-xs text-gray-400 mt-0.5 line-through">Rp {product.price.toLocaleString('id-ID')}</div>
              </div>
            ) : (
              <div className="text-gray-900 font-medium">Rp {product.price.toLocaleString('id-ID')}</div>
            )}
            <div className="text-xs text-gray-500 mt-0.5">Modal: Rp {product.costPrice.toLocaleString('id-ID')}</div>
          </td>
          <td className="px-6 py-4 text-center">
            <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
              <form action={toggleBestSeller}>
                <input type="hidden" name="id" value={product.id} />
                <input type="hidden" name="current" value={product.isBestSeller.toString()} />
                <button type="submit" className={`p-1.5 rounded-md transition-colors ${product.isBestSeller ? 'bg-orange-100 text-orange-700' : 'text-gray-300 hover:text-orange-400 hover:bg-orange-50'}`} title="Best Seller">
                  <Star className={`h-4 w-4 ${product.isBestSeller ? 'fill-orange-500' : ''}`} />
                </button>
              </form>
              <form action={toggleFavorite}>
                <input type="hidden" name="id" value={product.id} />
                <input type="hidden" name="current" value={product.isFavorite.toString()} />
                <button type="submit" className={`p-1.5 rounded-md transition-colors ${product.isFavorite ? 'bg-pink-100 text-pink-700' : 'text-gray-300 hover:text-pink-400 hover:bg-pink-50'}`} title="Favorite">
                  <Heart className={`h-4 w-4 ${product.isFavorite ? 'fill-pink-500' : ''}`} />
                </button>
              </form>
            </div>
          </td>
          <td className="px-6 py-4 text-right">
            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
              <Link href={`/products/${product.id}/edit`} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                <Edit2 className="h-4 w-4" />
              </Link>
              <form action={deleteProduct}>
                <input type="hidden" name="id" value={product.id} />
                <button type="submit" className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </div>
          </td>
        </tr>
      ))}
      
      {products.length === 0 && (
        <tr>
          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
            No products found.
          </td>
        </tr>
      )}
    </tbody>
  );
}
