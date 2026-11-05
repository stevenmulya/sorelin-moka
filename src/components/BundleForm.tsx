'use client';

import { useState, useMemo } from 'react';
import { createProduct, updateProduct, deleteProductImage } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import {
  ArrowLeft,
  Save,
  Image as ImageIcon,
  X,
  Plus,
  Trash2,
  Package,
  Layers,
  Sparkles,
  Percent,
  Coins,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { formatRupiah } from '@/lib/utils';
import {
  type BundleSlotRule,
  parseBundleConfig,
  serializeBundleConfig,
} from '@/lib/bundle-config';

interface CategoryOption {
  id: number;
  name: string;
}

interface ProductOption {
  id: number;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  type?: { name: string } | null;
}

interface BundleProductData {
  id?: number;
  name?: string;
  description?: string | null;
  images?: { id: number; url: string }[];
  costPrice?: number;
  price?: number;
  discountPrice?: number | null;
  availableVariants?: string | null;
  bundleQuota?: number | null;
}

export default function BundleForm({
  initialData,
  categories,
  availableProducts,
}: {
  initialData?: BundleProductData;
  categories: CategoryOption[];
  availableProducts: ProductOption[];
}) {
  const isEditing = !!initialData?.id;

  // Basic Information
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');

  // Accurate non-bundle categories synced with actual products
  const validCategories = useMemo(() => {
    const map = new Map<string, { id: number; name: string; count: number }>();
    for (const c of categories) {
      const clean = c.name.trim();
      if (!clean || clean.toLowerCase() === 'bundle' || clean.toLowerCase() === 'bundling') continue;
      const count = availableProducts.filter(
        (p) => p.type?.name?.trim().toLowerCase() === clean.toLowerCase()
      ).length;
      map.set(clean.toLowerCase(), { id: c.id, name: clean, count });
    }
    for (const p of availableProducts) {
      const catName = p.type?.name?.trim();
      if (!catName || catName.toLowerCase() === 'bundle' || catName.toLowerCase() === 'bundling') continue;
      const key = catName.toLowerCase();
      if (!map.has(key)) {
        const count = availableProducts.filter(
          (ap) => ap.type?.name?.trim().toLowerCase() === key
        ).length;
        map.set(key, { id: map.size + 1000, name: catName, count });
      }
    }
    return Array.from(map.values());
  }, [categories, availableProducts]);

  // Bundle Slot Rules: empty when creating a new bundle, loaded from config when editing
  const initialSlots = useMemo(() => {
    if (!initialData) return [];
    const config = parseBundleConfig(initialData.availableVariants);
    return config.slots;
  }, [initialData]);

  const [slots, setSlots] = useState<BundleSlotRule[]>(initialSlots);

  // Helper: compute individual slot cost and metadata
  const getSlotCostInfo = (slot: BundleSlotRule) => {
    if (slot.type === 'PRODUCT') {
      const prod = availableProducts.find(
        (p) => p.name.trim().toLowerCase() === slot.productName?.trim().toLowerCase()
      );
      const unitCost = prod?.costPrice ?? 0;
      const unitPrice = prod?.price ?? 0;
      const qty = slot.quantity || 1;
      return {
        unitCost,
        unitPrice,
        totalCost: unitCost * qty,
        productName: prod?.name || slot.productName,
      };
    } else {
      const catProds = availableProducts.filter(
        (p) => p.type?.name?.trim().toLowerCase() === slot.categoryName?.trim().toLowerCase()
      );
      if (catProds.length > 0) {
        const avgCost = Math.round(
          catProds.reduce((sum, p) => sum + (p.costPrice || 0), 0) / catProds.length
        );
        const avgPrice = Math.round(
          catProds.reduce((sum, p) => sum + (p.price || 0), 0) / catProds.length
        );
        const quota = slot.quota || 1;
        return {
          unitCost: avgCost,
          unitPrice: avgPrice,
          totalCost: avgCost * quota,
          productCount: catProds.length,
        };
      }
      return {
        unitCost: 0,
        unitPrice: 0,
        totalCost: 0,
        productCount: 0,
      };
    }
  };

  // Strictly Derived Cost Price (HPP) - cannot be edited manually
  const derivedCostPrice = slots.reduce((total, s) => {
    const info = getSlotCostInfo(s);
    return total + info.totalCost;
  }, 0);

  // Selling Price & Discount %
  const [priceRaw, setPriceRaw] = useState<string>(
    initialData?.price !== undefined ? String(initialData.price) : ''
  );
  const price = Number(priceRaw) || 0;

  const initialDiscountPercent = (() => {
    if (initialData?.discountPrice && initialData?.price && initialData.discountPrice < initialData.price) {
      return Math.round(((initialData.price - initialData.discountPrice) / initialData.price) * 100);
    }
    return 0;
  })();
  const [discountPercent, setDiscountPercent] = useState<number>(initialDiscountPercent);

  const finalDiscountPrice =
    discountPercent > 0 && price > 0 ? Math.round(price * (1 - discountPercent / 100)) : null;
  const effectivePrice = finalDiscountPrice ?? price;
  const savings = finalDiscountPrice ? price - finalDiscountPrice : 0;

  // Real-time Profit Margin Calculation based on Derived Cost Price
  const estimatedProfit = effectivePrice - derivedCostPrice;
  const profitMarginPercent = effectivePrice > 0 ? Math.round((estimatedProfit / effectivePrice) * 100) : 0;

  // Add Slot Form State
  const [newSlotType, setNewSlotType] = useState<'CATEGORY' | 'PRODUCT'>('CATEGORY');
  const [newCategoryName, setNewCategoryName] = useState<string>(validCategories[0]?.name || '');
  const [newQuota, setNewQuota] = useState<number>(1);
  const [newProductName, setNewProductName] = useState<string>(availableProducts[0]?.name || '');
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [isAddingSlot, setIsAddingSlot] = useState<boolean>(false);

  // Previews for the new slot form
  const previewCategoryInfo = useMemo(() => {
    const catProds = availableProducts.filter(
      (p) => p.type?.name?.trim().toLowerCase() === newCategoryName?.trim().toLowerCase()
    );
    if (catProds.length > 0) {
      const avgCost = Math.round(
        catProds.reduce((sum, p) => sum + (p.costPrice || 0), 0) / catProds.length
      );
      return {
        avgCost,
        totalEstCost: avgCost * Math.max(1, newQuota),
        count: catProds.length,
      };
    }
    return { avgCost: 0, totalEstCost: 0, count: 0 };
  }, [newCategoryName, newQuota, availableProducts]);

  const previewProductInfo = useMemo(() => {
    const prod = availableProducts.find(
      (p) => p.name.trim().toLowerCase() === newProductName?.trim().toLowerCase()
    );
    const unitCost = prod?.costPrice ?? 0;
    return {
      unitCost,
      totalCost: unitCost * Math.max(1, newQuantity),
      price: prod?.price ?? 0,
    };
  }, [newProductName, newQuantity, availableProducts]);

  const handleAddSlot = () => {
    if (newSlotType === 'CATEGORY') {
      if (!newCategoryName) return;
      const addQuota = Math.max(1, newQuota);
      setSlots((prev) => {
        const existingIdx = prev.findIndex(
          (s) =>
            s.type === 'CATEGORY' &&
            s.categoryName?.trim().toLowerCase() === newCategoryName.trim().toLowerCase()
        );
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quota: (updated[existingIdx].quota || 1) + addQuota,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            type: 'CATEGORY',
            categoryName: newCategoryName,
            quota: addQuota,
          },
        ];
      });
    } else {
      if (!newProductName) return;
      const addQty = Math.max(1, newQuantity);
      const matchedProd = availableProducts.find(
        (p) => p.name.trim().toLowerCase() === newProductName.trim().toLowerCase()
      );
      setSlots((prev) => {
        const existingIdx = prev.findIndex(
          (s) =>
            s.type === 'PRODUCT' &&
            s.productName?.trim().toLowerCase() === newProductName.trim().toLowerCase()
        );
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: (updated[existingIdx].quantity || 1) + addQty,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            type: 'PRODUCT',
            productId: matchedProd?.id,
            productName: matchedProd?.name || newProductName,
            quantity: addQty,
          },
        ];
      });
    }
    setIsAddingSlot(false);
  };

  const handleUpdateSlotCount = (id: string, delta: number) => {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (s.type === 'CATEGORY') {
          return { ...s, quota: Math.max(1, (s.quota || 1) + delta) };
        }
        return { ...s, quantity: Math.max(1, (s.quantity || 1) + delta) };
      })
    );
  };

  const handleRemoveSlot = (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const totalCategoryQuota = useMemo(() => {
    return slots
      .filter((s) => s.type === 'CATEGORY')
      .reduce((sum, s) => sum + (s.quota || 0), 0);
  }, [slots]);

  const totalFixedCount = useMemo(() => {
    return slots
      .filter((s) => s.type === 'PRODUCT')
      .reduce((sum, s) => sum + (s.quantity || 0), 0);
  }, [slots]);

  const serializedConfig = useMemo(() => {
    return serializeBundleConfig({ slots });
  }, [slots]);

  const handleDeleteImage = async (imageId: number) => {
    if (!initialData?.id) return;
    if (!window.confirm('Delete this bundle image?')) return;
    const fd = new FormData();
    fd.set('id', String(initialData.id));
    fd.set('imageId', String(imageId));
    const res = await deleteProductImage(fd);
    if (res?.error) window.alert(res.error);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <Link
            href="/bundles"
            className="p-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-[#8E6D53] hover:text-[#6B4227] hover:bg-[#FAF0DA] transition-colors shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-[#3F2311] tracking-tight">
              {isEditing ? 'Edit Bundle' : 'Create New Bundle'}
            </h1>
            <p className="text-xs text-[#8E6D53] mt-0.5 font-normal">
              Bundle cost price is automatically derived from included products and categories.
            </p>
          </div>
        </div>
      </div>

      <ActionForm action={isEditing ? updateProduct : createProduct} className="space-y-6">
        {isEditing && <input type="hidden" name="id" value={initialData.id} />}
        <input type="hidden" name="isBundle" value="true" />
        <input type="hidden" name="type" value="" />
        <input type="hidden" name="bundleQuota" value={Math.max(1, totalCategoryQuota + totalFixedCount)} />
        <input type="hidden" name="availableVariants" value={serializedConfig} />
        {/* Strictly Derived Cost Price - Submitted directly to database */}
        <input type="hidden" name="costPrice" value={derivedCostPrice} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info (Left 2 Columns) */}
          <div className="md:col-span-2 space-y-5">
            {/* Card 1: Basic Information */}
            <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="font-semibold text-sm text-[#3F2311] border-b border-[#E5D5BC]/60 pb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-[#C88A32]" strokeWidth={1.5} />
                <span>Package Information</span>
              </h2>

              <div>
                <label className="block text-xs font-medium text-[#8E6D53] mb-1.5">
                  Bundle Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter bundle name"
                  required
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm font-medium text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E6D53] mb-1.5">Description</label>
                <textarea
                  name="description"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  placeholder="Enter bundle description"
                  className="w-full px-3.5 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-xs text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all font-normal"
                />
              </div>
            </div>

            {/* Card 2: Bundle Components (By Category or By Product) */}
            <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5D5BC]/60 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#C88A32]" strokeWidth={1.5} />
                  <div>
                    <h2 className="font-semibold text-sm text-[#3F2311]">Bundle Components & Rules</h2>
                    <p className="text-[11px] text-[#8E6D53] font-light">
                      Add components either *By Category* (customer choices) or *By Product Item* (fixed includes).
                    </p>
                  </div>
                </div>

                {!isAddingSlot && (
                  <button
                    type="button"
                    onClick={() => setIsAddingSlot(true)}
                    className="px-3.5 py-1.5 bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] rounded-xl text-xs font-medium transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>Add Component</span>
                  </button>
                )}
              </div>

              {/* Add Slot Form */}
              {isAddingSlot && (
                <div className="p-4 bg-[#FAF0DA]/80 border-2 border-[#6B4227]/30 rounded-xl space-y-3.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#3F2311]">Select Component Type</p>
                    <button
                      type="button"
                      onClick={() => setIsAddingSlot(false)}
                      className="p-1 text-[#8E6D53] hover:text-[#3F2311] rounded-lg cursor-pointer"
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewSlotType('CATEGORY')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        newSlotType === 'CATEGORY'
                          ? 'bg-[#FFFDF8] border-[#6B4227] ring-2 ring-[#6B4227]/20 shadow-xs'
                          : 'bg-[#FAF0DA]/50 border-[#E5D5BC] text-[#8E6D53]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Layers className="h-3.5 w-3.5 text-[#6B4227]" strokeWidth={1.5} />
                        <span className="text-xs font-semibold text-[#3F2311]">By Category</span>
                      </div>
                      <span className="text-[10px] text-[#8E6D53] block font-light leading-relaxed">
                        Customer chooses flavor options from this category.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewSlotType('PRODUCT')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        newSlotType === 'PRODUCT'
                          ? 'bg-[#FFFDF8] border-[#6B4227] ring-2 ring-[#6B4227]/20 shadow-xs'
                          : 'bg-[#FAF0DA]/50 border-[#E5D5BC] text-[#8E6D53]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.5} />
                        <span className="text-xs font-semibold text-[#3F2311]">By Product Item</span>
                      </div>
                      <span className="text-[10px] text-[#8E6D53] block font-light leading-relaxed">
                        Specific product automatically included in the package.
                      </span>
                    </button>
                  </div>

                  {newSlotType === 'CATEGORY' ? (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-[#8E6D53] mb-1">
                            Select Category:
                          </label>
                          <select
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="w-full px-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs font-medium text-[#3F2311] focus:ring-2 focus:ring-[#6B4227]/15 cursor-pointer"
                          >
                            {validCategories.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name} ({c.count} products)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[#8E6D53] mb-1">
                            Customer Choice Quota:
                          </label>
                          <input
                            type="number"
                            value={newQuota}
                            onChange={(e) => setNewQuota(Math.max(1, Number(e.target.value)))}
                            min={1}
                            max={20}
                            placeholder="Enter choice quota"
                            className="w-full px-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs font-semibold text-[#6B4227] focus:ring-2 focus:ring-[#6B4227]/15"
                          />
                        </div>
                      </div>

                      {/* Real-time Category Cost Preview */}
                      <div className="p-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs flex items-center justify-between">
                        <span className="text-[#8E6D53]">
                          Est. Cost ({previewCategoryInfo.count} products in category):
                        </span>
                        <span className="font-semibold text-[#6B4227]">
                          {formatRupiah(previewCategoryInfo.totalEstCost)}{' '}
                          <span className="text-[10px] text-[#8E6D53] font-normal">
                            ({formatRupiah(previewCategoryInfo.avgCost)}/choice avg.)
                          </span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-[#8E6D53] mb-1">
                            Select Product:
                          </label>
                          <select
                            value={newProductName}
                            onChange={(e) => setNewProductName(e.target.value)}
                            className="w-full px-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs font-medium text-[#3F2311] focus:ring-2 focus:ring-[#6B4227]/15 cursor-pointer"
                          >
                            {availableProducts.map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.name} {p.type?.name ? `(${p.type.name})` : ''} — Sell: {formatRupiah(p.price)} | Cost: {formatRupiah(p.costPrice)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[#8E6D53] mb-1">
                            Quantity Included:
                          </label>
                          <input
                            type="number"
                            value={newQuantity}
                            onChange={(e) => setNewQuantity(Math.max(1, Number(e.target.value)))}
                            min={1}
                            max={20}
                            placeholder="Enter item quantity"
                            className="w-full px-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs font-semibold text-[#6B4227] focus:ring-2 focus:ring-[#6B4227]/15"
                          />
                        </div>
                      </div>

                      {/* Real-time Product Cost Preview */}
                      <div className="p-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs flex items-center justify-between">
                        <span className="text-[#8E6D53]">Component Cost (HPP):</span>
                        <span className="font-semibold text-emerald-800">
                          {formatRupiah(previewProductInfo.totalCost)}{' '}
                          <span className="text-[10px] text-[#8E6D53] font-normal">
                            ({formatRupiah(previewProductInfo.unitCost)}/unit)
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingSlot(false)}
                      className="px-3 py-1.5 bg-[#FFFDF8] text-[#8E6D53] border border-[#E5D5BC] rounded-lg text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddSlot}
                      className="px-4 py-1.5 bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] rounded-lg text-xs font-medium cursor-pointer shadow-xs"
                    >
                      Add to Bundle
                    </button>
                  </div>
                </div>
              )}

              {/* Slot Rules List */}
              <div className="space-y-2">
                {slots.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#8E6D53] border border-dashed border-[#E5D5BC] rounded-xl bg-[#FAF0DA]/30 font-light">
                    No components added yet. Click &quot;Add Component&quot; above to configure your bundle.
                  </div>
                ) : (
                  slots.map((s, idx) => {
                    const slotCost = getSlotCostInfo(s);

                    return (
                      <div
                        key={s.id || idx}
                        className="p-3.5 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-semibold text-xs ${
                              s.type === 'CATEGORY'
                                ? 'bg-[#6B4227] text-[#FAF0DA]'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div>
                            {s.type === 'CATEGORY' ? (
                              <div>
                                <p className="text-xs font-medium text-[#3F2311]">
                                  By Category:{' '}
                                  <span className="font-semibold text-[#6B4227]">{s.categoryName}</span>{' '}
                                  ({s.quota} Choices)
                                </p>
                                <p className="text-[11px] text-[#8E6D53] font-light mt-0.5">
                                  Customers choose {s.quota} flavor option(s) • Est. Cost:{' '}
                                  <strong className="text-[#6B4227] font-semibold">
                                    {formatRupiah(slotCost.totalCost)}
                                  </strong>{' '}
                                  ({formatRupiah(slotCost.unitCost)}/choice)
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-xs font-medium text-[#3F2311] flex items-center gap-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.5} />
                                  <span>
                                    By Product Item:{' '}
                                    <strong className="font-semibold text-[#3F2311]">
                                      {s.productName}
                                    </strong>{' '}
                                    ({s.quantity}x)
                                  </span>
                                </p>
                                <p className="text-[11px] text-emerald-800 font-light mt-0.5">
                                  Automatically included in bundle • Cost:{' '}
                                  <strong className="text-emerald-900 font-semibold">
                                    {formatRupiah(slotCost.totalCost)}
                                  </strong>{' '}
                                  ({formatRupiah(slotCost.unitCost)}/unit)
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleUpdateSlotCount(s.id, -1)}
                              className="px-2 py-1 text-xs font-bold text-[#6B4227] hover:bg-[#FAF0DA] transition-colors cursor-pointer"
                              title="Decrease quantity"
                            >
                              -
                            </button>
                            <span className="px-2 py-1 text-xs font-semibold text-[#3F2311] border-x border-[#E5D5BC]">
                              {s.type === 'CATEGORY' ? s.quota : s.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateSlotCount(s.id, 1)}
                              className="px-2 py-1 text-xs font-bold text-[#6B4227] hover:bg-[#FAF0DA] transition-colors cursor-pointer"
                              title="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSlot(s.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Composition Summary Banner */}
              <div className="p-3.5 bg-[#FAF0DA]/80 rounded-xl border border-[#E5D5BC] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3 text-[#5C3A21]">
                  <span>
                    Choices: <strong className="text-[#6B4227]">{totalCategoryQuota} item(s)</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Fixed: <strong className="text-emerald-800">{totalFixedCount} item(s)</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[#8E6D53]">Derived Cost Price (HPP):</span>
                  <span className="font-bold text-[#6B4227] text-sm">
                    {formatRupiah(derivedCostPrice)}
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-medium ml-1">
                    Auto-Derived
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Pricing & Discounts (Cost Price Strictly Non-Editable) */}
            <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5D5BC]/60 pb-3">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-[#C88A32]" strokeWidth={1.5} />
                  <div>
                    <h2 className="font-semibold text-sm text-[#3F2311]">Pricing & Profit Calculation</h2>
                    <p className="text-[11px] text-[#8E6D53] font-light">
                      Cost price is automatically derived. Set your selling price and promo discount.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.5} />
                  <span className="text-[11px] font-medium">Auto-Calculated Cost</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Derived Cost Price - LOCKED / READ-ONLY */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#8E6D53] flex items-center gap-1">
                      <Lock className="h-3 w-3 text-[#8E6D53]" strokeWidth={1.5} />
                      <span>Cost Price (HPP)</span>
                    </label>
                    <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Locked
                    </span>
                  </div>
                  <div className="w-full px-3.5 py-2.5 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#6B4227] flex items-center justify-between select-none">
                    <span>{formatRupiah(derivedCostPrice)}</span>
                    <span className="text-[10px] text-[#8E6D53] font-normal">Derived</span>
                  </div>
                  <p className="text-[10px] text-[#8E6D53] mt-1 font-light">
                    Follows component cost prices automatically
                  </p>
                </div>

                {/* Selling Price */}
                <div>
                  <label className="block text-xs font-medium text-[#8E6D53] mb-1.5">
                    Selling Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={priceRaw}
                    onChange={(e) => setPriceRaw(e.target.value)}
                    min={1}
                    required
                    placeholder="Enter selling price"
                    className="w-full px-3.5 py-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#6B4227] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all"
                  />
                  <p className="text-[10px] text-[#8E6D53] mt-1 font-light">
                    Regular customer price before discount
                  </p>
                </div>

                {/* Discount (%) */}
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
                      placeholder="Enter discount percentage"
                      className="w-full px-3.5 py-2.5 pr-8 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#C88A32] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all"
                    />
                    <Percent className="h-3.5 w-3.5 text-[#8E6D53] absolute right-3 top-3 pointer-events-none" strokeWidth={1.5} />
                  </div>
                  <p className="text-[10px] text-[#8E6D53] mt-1 font-light">
                    Promotional discount (0 for none)
                  </p>
                </div>
              </div>

              {/* Hidden serialized discount price */}
              <input type="hidden" name="discountPrice" value={finalDiscountPrice ?? ''} />

              {/* Real-time Selling Price & Profit Margin Preview */}
              <div className="p-4 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#8E6D53] block font-medium">Final Customer Price:</span>
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

                <div className="flex items-center gap-2 flex-wrap">
                  {finalDiscountPrice && (
                    <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-right">
                      <span className="text-[11px] font-semibold text-amber-800 block">
                        {discountPercent}% OFF Active
                      </span>
                      <span className="text-[10px] text-amber-700 font-normal">
                        Save {formatRupiah(savings)}
                      </span>
                    </div>
                  )}

                  <div
                    className={`px-3.5 py-1.5 rounded-xl border text-right ${
                      estimatedProfit >= 0
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <span
                      className={`text-[11px] font-semibold block ${
                        estimatedProfit >= 0 ? 'text-emerald-800' : 'text-red-700'
                      }`}
                    >
                      Est. Profit: {formatRupiah(estimatedProfit)} ({profitMarginPercent}%)
                    </span>
                    <span
                      className={`text-[10px] font-normal ${
                        estimatedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      Price ({formatRupiah(effectivePrice)}) - Cost ({formatRupiah(derivedCostPrice)})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Images & Submit */}
          <div className="space-y-5">
            <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="font-semibold text-sm text-[#3F2311] border-b border-[#E5D5BC]/60 pb-3 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[#C88A32]" strokeWidth={1.5} />
                <span>Bundle Image</span>
              </h2>

              {initialData?.images && initialData.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {initialData.images.map((img) => (
                    <div
                      key={img.id}
                      className="relative aspect-square rounded-xl overflow-hidden bg-[#FAF0DA] border border-[#E5D5BC] group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="Bundle" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        className="absolute top-1.5 right-1.5 p-1 bg-red-600/80 hover:bg-red-700 text-white rounded-full transition-colors shadow-xs cursor-pointer"
                        title="Delete image"
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
              <span>{isEditing ? 'Save Bundle Changes' : 'Create Bundle'}</span>
            </SubmitButton>
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
