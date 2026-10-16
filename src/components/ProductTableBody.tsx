'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Edit2, Trash2, Star, Heart, GripVertical } from 'lucide-react';
import { deleteProduct, toggleBestSeller, toggleFavorite, updatePriorities } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { formatRupiah } from '@/lib/utils';

export interface ProductRow {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  discountPrice?: number | null;
  costPrice: number;
  priority?: number | null;
  isBestSeller?: boolean | null;
  isFavorite?: boolean | null;
  images?: Array<{ url: string }> | null;
}

export default function ProductTableBody({
  initialProducts,
  canReorder = true,
}: {
  initialProducts: ProductRow[];
  canReorder?: boolean;
}) {
  const [prevInitial, setPrevInitial] = useState(initialProducts);
  const [products, setProducts] = useState(initialProducts);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  if (initialProducts !== prevInitial) {
    setPrevInitial(initialProducts);
    setProducts(initialProducts);
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!canReorder) return;
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      const el = e.target as HTMLElement;
      if (el) el.style.opacity = '0.5';
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (!canReorder) return;
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
    if (!canReorder) return;
    e.preventDefault();
    setDraggedIdx(null);
    const target = e.target as HTMLElement;
    const row = target.closest('tr');
    if (row) row.style.opacity = '1';

    const maxPriority = Math.max(...products.map((p) => p.priority || 0), products.length);
    const updatedProducts = products.map((p, idx) => ({ ...p, priority: maxPriority - idx }));
    setProducts(updatedProducts);

    const orderedIds = updatedProducts.map((p) => p.id as number);
    const res = await updatePriorities(orderedIds);
    if (res?.error) window.alert(res.error);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIdx(null);
    const target = e.target as HTMLElement;
    if (target) target.style.opacity = '1';
  };

  return (
    <tbody className="divide-y divide-[#E5D5BC]/60">
      {products.map((product, index) => (
        <tr
          key={product.id}
          className={`hover:bg-[#FAF0DA]/40 transition-colors group ${
            canReorder ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
          draggable={canReorder}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        >
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <GripVertical className={`h-4 w-4 ${canReorder ? 'text-[#8E6D53]' : 'text-[#E5D5BC]'}`} />
              <span className="text-[#6B4227] font-bold text-center">{product.priority ?? 0}</span>
            </div>
          </td>
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-[#FAF0DA] rounded-lg overflow-hidden flex-shrink-0 border border-[#E5D5BC]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.images?.[0]?.url || '/placeholder.jpg'}
                  alt={product.name}
                  className="h-full w-full object-cover pointer-events-none"
                />
              </div>
              <div>
                <div className="font-semibold text-[#3F2311]">{product.name}</div>
                <div className="text-xs text-[#8E6D53] mt-0.5 truncate max-w-[200px]">
                  {product.description || '-'}
                </div>
              </div>
            </div>
          </td>
          <td className="px-5 py-3.5">
            {product.discountPrice ? (
              <div>
                <div className="text-[#6B4227] font-bold">{formatRupiah(product.discountPrice)}</div>
                <div className="text-xs text-[#8E6D53] mt-0.5 line-through">{formatRupiah(product.price)}</div>
              </div>
            ) : (
              <div className="text-[#6B4227] font-bold">{formatRupiah(product.price)}</div>
            )}
            <div className="text-xs text-[#8E6D53] mt-0.5">Cost: {formatRupiah(product.costPrice)}</div>
          </td>
          <td className="px-5 py-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <ActionForm action={toggleBestSeller}>
                <input type="hidden" name="id" value={product.id} />
                <input type="hidden" name="current" value={Boolean(product.isBestSeller).toString()} />
                <SubmitButton
                  pendingText="..."
                  className={`p-1.5 rounded-lg transition-colors ${
                    product.isBestSeller
                      ? 'bg-[#F3DBAA] text-[#3F2311] border border-[#C88A32]'
                      : 'text-[#8E6D53] hover:text-[#C88A32] hover:bg-[#FAF0DA]'
                  }`}
                  title="Best Seller"
                >
                  <Star className={`h-4 w-4 ${product.isBestSeller ? 'fill-[#C88A32] text-[#C88A32]' : ''}`} />
                </SubmitButton>
              </ActionForm>
              <ActionForm action={toggleFavorite}>
                <input type="hidden" name="id" value={product.id} />
                <input type="hidden" name="current" value={Boolean(product.isFavorite).toString()} />
                <SubmitButton
                  pendingText="..."
                  className={`p-1.5 rounded-lg transition-colors ${
                    product.isFavorite
                      ? 'bg-pink-100 text-pink-700 border border-pink-200'
                      : 'text-[#8E6D53] hover:text-pink-600 hover:bg-pink-50'
                  }`}
                  title="Favorite"
                >
                  <Heart className={`h-4 w-4 ${product.isFavorite ? 'fill-pink-500 text-pink-500' : ''}`} />
                </SubmitButton>
              </ActionForm>
            </div>
          </td>
          <td className="px-5 py-3.5 text-right">
            <div
              className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <Link
                href={`/products/${product.id}/edit`}
                className="p-1.5 text-[#8E6D53] hover:text-[#6B4227] hover:bg-[#FAF0DA] rounded-lg transition-colors"
                title="Edit Product"
              >
                <Edit2 className="h-4 w-4" />
              </Link>
              <ActionForm action={deleteProduct} confirmMessage="Are you sure you want to archive this product?">
                <input type="hidden" name="id" value={product.id} />
                <SubmitButton
                  pendingText="..."
                  className="p-1.5 text-[#8E6D53] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Archive Product"
                >
                  <Trash2 className="h-4 w-4" />
                </SubmitButton>
              </ActionForm>
            </div>
          </td>
        </tr>
      ))}

      {products.length === 0 && (
        <tr>
          <td colSpan={5} className="px-6 py-12 text-center text-[#8E6D53]">
            No products found.
          </td>
        </tr>
      )}
    </tbody>
  );
}
