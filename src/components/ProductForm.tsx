'use client';

import { useState } from 'react';
import { createProduct, updateProduct, deleteProductImage } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import {
  ArrowLeft,
  Save,
  Image as ImageIcon,
  X,
  Package,
  Percent,
  Layers,
  Coins,
} from 'lucide-react';
import Link from 'next/link';
import { formatRupiah } from '@/lib/utils';

interface CategoryOption {
  id: number;
  name: string;
}

type Product = {
  id?: number;
  name?: string;
  type?: { name: string } | null;
  variant?: { name: string } | null;
  description?: string | null;
  images?: { id: number; url: string }[];
  costPrice?: number;
  price?: number;
  discountPrice?: number | null;
  stock?: number;
};

export default function ProductForm({
  initialData,
  categories = [],
}: {
  initialData?: Product;
  categories?: CategoryOption[];
}) {
  const isEditing = !!initialData?.id;

  // Basic Information
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type?.name || categories[0]?.name || 'Saltbread');
  const [description, setDescription] = useState(initialData?.description || '');

  // Pricing & Real-time Discount Calculation
  const [costPrice, setCostPrice] = useState<number>(initialData?.costPrice ?? 7000);
  const [price, setPrice] = useState<number>(initialData?.price ?? 15000);

  const initialDiscountPercent = (() => {
    if (initialData?.discountPrice && initialData?.price && initialData.discountPrice < initialData.price) {
      return Math.round(((initialData.price - initialData.discountPrice) / initialData.price) * 100);
    }
    return 0;
  })();
  const [discountPercent, setDiscountPercent] = useState<number>(initialDiscountPercent);

  // Live computed final price and savings
  const finalDiscountPrice =
    discountPercent > 0 && price > 0 ? Math.round(price * (1 - discountPercent / 100)) : null;
  const effectivePrice = finalDiscountPrice ?? price;
  const savings = finalDiscountPrice ? price - finalDiscountPrice : 0;

  // Physical Stock on Hand
  const [stock, setStock] = useState<number>(initialData?.stock ?? 10);

  const handleDeleteImage = async (imageId: number) => {
    if (!initialData?.id) return;
    if (!window.confirm('Delete this product image?')) return;
    const fd = new FormData();
    fd.set('id', String(initialData.id));
    fd.set('imageId', String(imageId));
    const res = await deleteProductImage(fd);
    if (res?.error) window.alert(res.error);
  };

  const defaultCategoryPills = categories.length > 0
    ? categories.map((c) => c.name)
    : ['Saltbread', 'Beverage', 'Coffee', 'Tea', 'Snack', 'Other'];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <Link
            href="/products"
            className="p-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-[#8E6D53] hover:text-[#6B4227] hover:bg-[#FAF0DA] transition-colors shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-[#3F2311] tracking-tight">
              {isEditing ? 'Edit Product' : 'Add New Product'}
            </h1>
            <p className="text-xs text-[#8E6D53] mt-0.5 font-normal">
              Configure product details, stock on hand, and selling prices.
            </p>
          </div>
        </div>
      </div>

      <ActionForm action={isEditing ? updateProduct : createProduct} className="space-y-6">
        {isEditing && <input type="hidden" name="id" value={initialData.id} />}
        {/* Strictly a single product: isBundle is always false */}
        <input type="hidden" name="isBundle" value="false" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info (Left 2 Columns) */}
          <div className="md:col-span-2 space-y-5">
            {/* Card 1: Basic Information */}
            <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="font-semibold text-sm text-[#3F2311] border-b border-[#E5D5BC]/60 pb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-[#C88A32]" strokeWidth={1.5} />
                <span>Product Information</span>
              </h2>

              <div>
                <label className="block text-xs font-medium text-[#8E6D53] mb-1.5">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter product name"
                  required
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm font-medium text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E6D53] mb-1.5 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#C88A32]" strokeWidth={1.5} />
                  <span>Category</span>
                </label>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {defaultCategoryPills.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setType(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        type.toLowerCase() === cat.toLowerCase()
                          ? 'bg-[#6B4227] text-[#FAF0DA] border-[#6B4227]'
                          : 'bg-[#FAF0DA]/50 text-[#6B4227] border-[#E5D5BC] hover:bg-[#FAF0DA]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                  maxLength={50}
                  placeholder="Enter category name"
                  className="w-full px-3.5 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-xs text-[#3F2311] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E6D53] mb-1.5">Description (Optional)</label>
                <textarea
                  name="description"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  placeholder="Enter product description"
                  className="w-full px-3.5 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-xs text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all font-normal"
                />
              </div>

              {/* Physical Stock on Hand */}
              <div className="pt-2 border-t border-[#E5D5BC]/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-medium text-[#3F2311]">
                      Physical Stock on Hand (Pcs) <span className="text-red-500">*</span>
                    </label>
                    <p className="text-[11px] text-[#8E6D53] mt-0.5 font-light">
                      Current available units at the booth.
                    </p>
                  </div>
                  <input
                    type="number"
                    name="stock"
                    value={stock}
                    onChange={(e) => setStock(Math.max(0, Number(e.target.value)))}
                    min={0}
                    required
                    className="w-32 px-3.5 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#6B4227] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all text-center"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Pricing & Discount */}
            <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="font-semibold text-sm text-[#3F2311] border-b border-[#E5D5BC]/60 pb-3 flex items-center gap-2">
                <Coins className="h-4 w-4 text-[#C88A32]" strokeWidth={1.5} />
                <span>Pricing & Margins</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#8E6D53] mb-1.5">
                    Cost Price (HPP) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="costPrice"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Math.max(0, Number(e.target.value)))}
                    min={0}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm font-medium text-[#3F2311] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8E6D53] mb-1.5">
                    Regular Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={price}
                    onChange={(e) => setPrice(Math.max(1, Number(e.target.value)))}
                    min={1}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#3F2311] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8E6D53] mb-1.5 flex items-center justify-between">
                    <span>Discount (%)</span>
                    <span className="text-[11px] text-[#8E6D53] font-light">Optional</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="discountPercent"
                      value={discountPercent || ''}
                      onChange={(e) => {
                        const val = Math.min(99, Math.max(0, Number(e.target.value)));
                        setDiscountPercent(val);
                      }}
                      min={0}
                      max={99}
                      placeholder="0"
                      className="w-full px-3.5 py-2.5 pr-8 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#C88A32] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all"
                    />
                    <Percent className="h-3.5 w-3.5 text-[#8E6D53] absolute right-3 top-3 pointer-events-none" strokeWidth={1.5} />
                  </div>
                </div>
              </div>

              {/* Hidden serialized discount price */}
              <input type="hidden" name="discountPrice" value={finalDiscountPrice ?? ''} />

              {/* Live Preview Card */}
              <div className="p-4 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#8E6D53] block font-medium">Customer Selling Price:</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base font-bold text-[#6B4227]">
                      {formatRupiah(effectivePrice)}
                    </span>
                    {finalDiscountPrice && (
                      <span className="text-xs text-[#8E6D53] line-through font-normal">
                        {formatRupiah(price)}
                      </span>
                    )}
                  </div>
                </div>

                {finalDiscountPrice ? (
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-right">
                    <span className="text-xs font-semibold text-emerald-800 block">
                      {discountPercent}% OFF Active
                    </span>
                    <span className="text-[11px] text-emerald-700 font-normal">
                      Save {formatRupiah(savings)}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-[#8E6D53] font-medium bg-[#FFFDF8] px-3 py-1 rounded-lg border border-[#E5D5BC]">
                    Regular Price (No Discount)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Images & Submit */}
          <div className="space-y-5">
            <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="font-semibold text-sm text-[#3F2311] border-b border-[#E5D5BC]/60 pb-3 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[#C88A32]" strokeWidth={1.5} />
                <span>Product Photo</span>
              </h2>

              {initialData?.images && initialData.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {initialData.images.map((img) => (
                    <div
                      key={img.id}
                      className="relative aspect-square rounded-xl overflow-hidden bg-[#FAF0DA] border border-[#E5D5BC] group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="Product" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        className="absolute top-1.5 right-1.5 p-1 bg-red-600/80 hover:bg-red-700 text-white rounded-full transition-colors shadow-xs cursor-pointer"
                        title="Delete photo"
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#8E6D53] mb-1.5">
                  {initialData?.images?.length ? 'Add More Photos' : 'Upload Photos'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  name="images"
                  multiple
                  className="w-full px-3 py-2 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl text-xs text-[#8E6D53] focus:outline-none file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#6B4227] file:text-[#FAF0DA] hover:file:bg-[#54311B] file:cursor-pointer"
                />
                <p className="text-[11px] text-[#8E6D53] mt-1.5 font-light">
                  Up to 4 images (JPG, PNG, WebP • max 3 MB each).
                </p>
              </div>
            </div>

            <SubmitButton
              pendingText="Saving..."
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#6B4227] text-[#FAF0DA] rounded-xl font-medium text-sm hover:bg-[#54311B] transition-colors shadow-xs cursor-pointer"
            >
              <Save className="h-4 w-4" strokeWidth={1.5} />
              <span>{isEditing ? 'Save Changes' : 'Create Product'}</span>
            </SubmitButton>
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
