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
  Coins,
  Lock,
  CheckCircle2,
  CheckSquare,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import { formatRupiah } from '@/lib/utils';
import {
  type BundleSlotRule,
  type BundlePricingMode,
  parseBundleConfig,
  serializeBundleConfig,
  calculateBundlePriceStats,
} from '@/lib/bundle-config';

interface CategoryOption {
  id: number;
  name: string;
}

interface ProductOption {
  id: number;
  name: string;
  price: number;
  discountPrice?: number | null;
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

function formatRange(min: number, max: number): string {
  if (min === max) return formatRupiah(min);
  return `${formatRupiah(min)} – ${formatRupiah(max)}`;
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

  // Parse initial bundle config when editing
  const parsedInitialConfig = useMemo(() => {
    if (!initialData) {
      return {
        slots: [] as BundleSlotRule[],
        pricingMode: 'FIXED' as BundlePricingMode,
        fixedPrice: undefined,
        discountAmount: undefined,
      };
    }
    return parseBundleConfig(initialData.availableVariants);
  }, [initialData]);

  const [slots, setSlots] = useState<BundleSlotRule[]>(parsedInitialConfig.slots);

  // Pricing Mode: 'FIXED' (Flat bundle price regardless of item chosen) or 'DISCOUNT' (Nominal Rp off chosen items)
  const [pricingMode, setPricingMode] = useState<BundlePricingMode>(() => {
    if (parsedInitialConfig.pricingMode) return parsedInitialConfig.pricingMode;
    if (typeof parsedInitialConfig.discountAmount === 'number') return 'DISCOUNT';
    return 'FIXED';
  });

  // Initial Fixed Selling Price (Rp)
  const [fixedPriceRaw, setFixedPriceRaw] = useState<string>(() => {
    if (typeof parsedInitialConfig.fixedPrice === 'number') {
      return String(parsedInitialConfig.fixedPrice);
    }
    if (initialData?.price) {
      const savedEffective =
        initialData.discountPrice && initialData.discountPrice > 0 && initialData.discountPrice < initialData.price
          ? initialData.discountPrice
          : initialData.price;
      return String(savedEffective);
    }
    return '';
  });
  const fixedPrice = Math.max(0, Math.round(Number(fixedPriceRaw) || 0));

  // Initial Nominal Discount Amount (Rp)
  const [discountAmountRaw, setDiscountAmountRaw] = useState<string>(() => {
    if (typeof parsedInitialConfig.discountAmount === 'number' && parsedInitialConfig.discountAmount > 0) {
      return String(parsedInitialConfig.discountAmount);
    }
    return '';
  });
  const discountAmount = Math.max(0, Math.round(Number(discountAmountRaw) || 0));

  // Exact Min-Max Price, Cost (HPP), and Profit Calculation
  const stats = useMemo(() => {
    return calculateBundlePriceStats(
      slots,
      {
        pricingMode,
        fixedPrice,
        discountAmount,
      },
      availableProducts
    );
  }, [slots, pricingMode, fixedPrice, discountAmount, availableProducts]);

  // Add Slot Form State (stored as raw strings so inputs can be freely cleared with backspace)
  const [newSlotMode, setNewSlotMode] = useState<'PRODUCT' | 'CUSTOM_OPTIONS' | 'CATEGORY'>('PRODUCT');
  const [newCategoryName, setNewCategoryName] = useState<string>(validCategories[0]?.name || '');
  const [newQuotaRaw, setNewQuotaRaw] = useState<string>('1');
  const newQuota = Math.max(1, parseInt(newQuotaRaw, 10) || 1);
  const [newCustomLabel, setNewCustomLabel] = useState<string>('');
  const [selectedCustomProducts, setSelectedCustomProducts] = useState<string[]>([]);
  const [newProductName, setNewProductName] = useState<string>(availableProducts[0]?.name || '');
  const [newQuantityRaw, setNewQuantityRaw] = useState<string>('1');
  const newQuantity = Math.max(1, parseInt(newQuantityRaw, 10) || 1);
  const [isAddingSlot, setIsAddingSlot] = useState<boolean>(false);

  // Previews for the new slot form (exact min-max ranges, never misleading averages)
  const previewCategoryInfo = useMemo(() => {
    const catProds = availableProducts.filter(
      (p) => p.type?.name?.trim().toLowerCase() === newCategoryName?.trim().toLowerCase()
    );
    const q = Math.max(1, newQuota);
    if (catProds.length > 0) {
      const costs = catProds.map((p) => p.costPrice || 0);
      const prices = catProds.map((p) => p.price || 0);
      return {
        minCost: Math.min(...costs) * q,
        maxCost: Math.max(...costs) * q,
        minPrice: Math.min(...prices) * q,
        maxPrice: Math.max(...prices) * q,
        count: catProds.length,
      };
    }
    return { minCost: 0, maxCost: 0, minPrice: 0, maxPrice: 0, count: 0 };
  }, [newCategoryName, newQuota, availableProducts]);

  const previewCustomOptionsInfo = useMemo(() => {
    const allowedSet = new Set(selectedCustomProducts.map((n) => n.trim().toLowerCase()));
    const customProds = availableProducts.filter((p) =>
      allowedSet.has(p.name.trim().toLowerCase())
    );
    const q = Math.max(1, newQuota);
    if (customProds.length > 0) {
      const costs = customProds.map((p) => p.costPrice || 0);
      const prices = customProds.map((p) => p.price || 0);
      return {
        minCost: Math.min(...costs) * q,
        maxCost: Math.max(...costs) * q,
        minPrice: Math.min(...prices) * q,
        maxPrice: Math.max(...prices) * q,
        count: customProds.length,
      };
    }
    return { minCost: 0, maxCost: 0, minPrice: 0, maxPrice: 0, count: 0 };
  }, [selectedCustomProducts, newQuota, availableProducts]);

  const previewProductInfo = useMemo(() => {
    const prod = availableProducts.find(
      (p) => p.name.trim().toLowerCase() === newProductName?.trim().toLowerCase()
    );
    const unitCost = prod?.costPrice ?? 0;
    const unitPrice = prod?.price ?? 0;
    const q = Math.max(1, newQuantity);
    return {
      unitCost,
      unitPrice,
      totalCost: unitCost * q,
      totalPrice: unitPrice * q,
    };
  }, [newProductName, newQuantity, availableProducts]);

  const toggleCustomProduct = (prodName: string) => {
    setSelectedCustomProducts((prev) =>
      prev.includes(prodName) ? prev.filter((n) => n !== prodName) : [...prev, prodName]
    );
  };

  const handleAddSlot = () => {
    if (newSlotMode === 'CATEGORY') {
      if (!newCategoryName) return;
      const addQuota = Math.max(1, newQuota);
      setSlots((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          type: 'CATEGORY',
          categoryName: newCategoryName,
          quota: addQuota,
        },
      ]);
    } else if (newSlotMode === 'CUSTOM_OPTIONS') {
      if (selectedCustomProducts.length === 0) return;
      const addQuota = Math.max(1, newQuota);
      const defaultLabel =
        newCustomLabel.trim() ||
        selectedCustomProducts
          .map((n) => n.replace(/^Salt Bread\s+/i, ''))
          .join(' / ');
      setSlots((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          type: 'CATEGORY',
          categoryName: defaultLabel,
          quota: addQuota,
          allowedProductNames: [...selectedCustomProducts],
        },
      ]);
      setSelectedCustomProducts([]);
      setNewCustomLabel('');
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
    setNewQuantityRaw('1');
    setNewQuotaRaw('1');
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
    return serializeBundleConfig({
      slots,
      pricingMode,
      ...(pricingMode === 'FIXED' ? { fixedPrice } : { discountAmount }),
    });
  }, [slots, pricingMode, fixedPrice, discountAmount]);

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
              Configure bundle items and choose between Fixed Package Price (flat price) or Nominal Discount off items.
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
        {/* Minimum starting bundle price & minimum HPP stored on Product record */}
        <input type="hidden" name="price" value={stats.minFinalPrice} />
        <input type="hidden" name="costPrice" value={stats.minCostPrice} />
        <input type="hidden" name="discountPrice" value="" />

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

            {/* Card 2: Bundle Components (Fixed Product, Custom Product Options, or Full Category) */}
            <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5D5BC]/60 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#C88A32]" strokeWidth={1.5} />
                  <div>
                    <h2 className="font-semibold text-sm text-[#3F2311]">Bundle Components &amp; Choice Slots</h2>
                    <p className="text-[11px] text-[#8E6D53] font-light">
                      Add Fixed Items, Specific Product Options (e.g. Choco or Cheese), or Full Category Choices.
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setNewSlotMode('PRODUCT')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        newSlotMode === 'PRODUCT'
                          ? 'bg-[#FFFDF8] border-[#6B4227] ring-2 ring-[#6B4227]/20 shadow-xs'
                          : 'bg-[#FAF0DA]/50 border-[#E5D5BC] text-[#8E6D53]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.5} />
                        <span className="text-xs font-semibold text-[#3F2311]">Fixed Item</span>
                      </div>
                      <span className="text-[10px] text-[#8E6D53] block font-light leading-relaxed">
                        Specific product automatically included (e.g. 1x Original).
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewSlotMode('CUSTOM_OPTIONS')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        newSlotMode === 'CUSTOM_OPTIONS'
                          ? 'bg-[#FFFDF8] border-[#6B4227] ring-2 ring-[#6B4227]/20 shadow-xs'
                          : 'bg-[#FAF0DA]/50 border-[#E5D5BC] text-[#8E6D53]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <CheckSquare className="h-3.5 w-3.5 text-[#C88A32]" strokeWidth={1.5} />
                        <span className="text-xs font-semibold text-[#3F2311]">Specific Options</span>
                      </div>
                      <span className="text-[10px] text-[#8E6D53] block font-light leading-relaxed">
                        Customer chooses from checked products (e.g. Choco or Cheese).
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewSlotMode('CATEGORY')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        newSlotMode === 'CATEGORY'
                          ? 'bg-[#FFFDF8] border-[#6B4227] ring-2 ring-[#6B4227]/20 shadow-xs'
                          : 'bg-[#FAF0DA]/50 border-[#E5D5BC] text-[#8E6D53]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Layers className="h-3.5 w-3.5 text-[#6B4227]" strokeWidth={1.5} />
                        <span className="text-xs font-semibold text-[#3F2311]">Full Category</span>
                      </div>
                      <span className="text-[10px] text-[#8E6D53] block font-light leading-relaxed">
                        Customer chooses from all products in a category.
                      </span>
                    </button>
                  </div>

                  {newSlotMode === 'PRODUCT' && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-[#8E6D53] mb-1">
                            Select Fixed Product:
                          </label>
                          <select
                            value={newProductName}
                            onChange={(e) => setNewProductName(e.target.value)}
                            className="w-full px-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs font-medium text-[#3F2311] focus:ring-2 focus:ring-[#6B4227]/15 cursor-pointer"
                          >
                            {availableProducts.map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.name} {p.type?.name ? `(${p.type.name})` : ''} — Sell: {formatRupiah(p.price)} | HPP: {formatRupiah(p.costPrice)}
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
                            value={newQuantityRaw}
                            onChange={(e) => setNewQuantityRaw(e.target.value)}
                            min={1}
                            max={20}
                            placeholder="Enter item quantity"
                            className="w-full px-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs font-semibold text-[#6B4227] focus:ring-2 focus:ring-[#6B4227]/15"
                          />
                        </div>
                      </div>

                      <div className="p-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs flex items-center justify-between">
                        <span className="text-[#8E6D53]">Normal Price / Actual HPP:</span>
                        <span className="font-semibold text-emerald-800">
                          Sell: {formatRupiah(previewProductInfo.totalPrice)} • HPP: {formatRupiah(previewProductInfo.totalCost)}
                        </span>
                      </div>
                    </div>
                  )}

                  {newSlotMode === 'CUSTOM_OPTIONS' && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-[#8E6D53] mb-1">
                            Slot Title (Optional):
                          </label>
                          <input
                            type="text"
                            value={newCustomLabel}
                            onChange={(e) => setNewCustomLabel(e.target.value)}
                            placeholder="Enter choice slot label"
                            maxLength={60}
                            className="w-full px-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs font-medium text-[#3F2311] placeholder-[#9E826B] focus:ring-2 focus:ring-[#6B4227]/15"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[#8E6D53] mb-1">
                            Customer Choice Quota:
                          </label>
                          <input
                            type="number"
                            value={newQuotaRaw}
                            onChange={(e) => setNewQuotaRaw(e.target.value)}
                            min={1}
                            max={20}
                            placeholder="Enter choice quota"
                            className="w-full px-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs font-semibold text-[#6B4227] focus:ring-2 focus:ring-[#6B4227]/15"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-medium text-[#8E6D53]">
                            Check Allowed Products for This Slot ({selectedCustomProducts.length} selected):
                          </label>
                          {selectedCustomProducts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedCustomProducts([])}
                              className="text-[10px] font-semibold text-[#6B4227] hover:underline cursor-pointer"
                            >
                              Clear selection
                            </button>
                          )}
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-[#E5D5BC]/60 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg">
                          {availableProducts.map((p) => {
                            const checked = selectedCustomProducts.includes(p.name);
                            return (
                              <label
                                key={p.id}
                                className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                                  checked ? 'bg-[#FAF0DA]/90 font-semibold' : 'hover:bg-[#FAF0DA]/30'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleCustomProduct(p.name)}
                                    className="rounded border-[#E5D5BC] text-[#6B4227] focus:ring-[#6B4227] cursor-pointer"
                                  />
                                  <span className="text-[#3F2311]">{p.name}</span>
                                  {p.type?.name && (
                                    <span className="text-[10px] text-[#8E6D53] bg-[#FAF0DA] px-1.5 py-0.2 rounded border border-[#E5D5BC]">
                                      {p.type.name}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-[#8E6D53]">
                                  Sell: <strong className="text-[#6B4227]">{formatRupiah(p.price)}</strong> • HPP:{' '}
                                  <strong className="text-emerald-800">{formatRupiah(p.costPrice)}</strong>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="p-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[#8E6D53]">
                          Slot Range ({previewCustomOptionsInfo.count} allowed options):
                        </span>
                        <span className="font-semibold text-[#6B4227]">
                          Sell: {formatRange(previewCustomOptionsInfo.minPrice, previewCustomOptionsInfo.maxPrice)} • Actual HPP:{' '}
                          <span className="text-emerald-800">
                            {formatRange(previewCustomOptionsInfo.minCost, previewCustomOptionsInfo.maxCost)}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                  {newSlotMode === 'CATEGORY' && (
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
                            value={newQuotaRaw}
                            onChange={(e) => setNewQuotaRaw(e.target.value)}
                            min={1}
                            max={20}
                            placeholder="Enter choice quota"
                            className="w-full px-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs font-semibold text-[#6B4227] focus:ring-2 focus:ring-[#6B4227]/15"
                          />
                        </div>
                      </div>

                      <div className="p-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[#8E6D53]">
                          Category Range ({previewCategoryInfo.count} products):
                        </span>
                        <span className="font-semibold text-[#6B4227]">
                          Sell: {formatRange(previewCategoryInfo.minPrice, previewCategoryInfo.maxPrice)} • Actual HPP:{' '}
                          <span className="text-emerald-800">
                            {formatRange(previewCategoryInfo.minCost, previewCategoryInfo.maxCost)}
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
                      disabled={newSlotMode === 'CUSTOM_OPTIONS' && selectedCustomProducts.length === 0}
                      className="px-4 py-1.5 bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] disabled:opacity-40 rounded-lg text-xs font-medium cursor-pointer shadow-xs"
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
                    const detail = stats.slotDetails[idx];
                    const hasCustomList = Boolean(s.allowedProductNames && s.allowedProductNames.length > 0);

                    return (
                      <div
                        key={s.id || idx}
                        className="p-3.5 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-semibold text-xs shrink-0 ${
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
                                  {hasCustomList ? 'Specific Choice:' : 'Category Choice:'}{' '}
                                  <span className="font-semibold text-[#6B4227]">{s.categoryName}</span>{' '}
                                  (Choose {s.quota}x)
                                </p>
                                {hasCustomList && (
                                  <p className="text-[11px] text-[#6B4227] font-medium mt-0.5">
                                    Options: {s.allowedProductNames?.join(' / ')}
                                  </p>
                                )}
                                <p className="text-[11px] text-[#8E6D53] font-light mt-0.5">
                                  Normal Price:{' '}
                                  <strong className="text-[#3F2311] font-semibold">
                                    {detail ? formatRange(detail.minTotalPrice, detail.maxTotalPrice) : formatRupiah(0)}
                                  </strong>{' '}
                                  • Actual HPP:{' '}
                                  <strong className="text-emerald-800 font-semibold">
                                    {detail ? formatRange(detail.minTotalCost, detail.maxTotalCost) : formatRupiah(0)}
                                  </strong>
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-xs font-medium text-[#3F2311] flex items-center gap-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.5} />
                                  <span>
                                    Fixed Item:{' '}
                                    <strong className="font-semibold text-[#3F2311]">
                                      {s.productName}
                                    </strong>{' '}
                                    ({s.quantity}x)
                                  </span>
                                </p>
                                <p className="text-[11px] text-emerald-800 font-light mt-0.5">
                                  Normal Price:{' '}
                                  <strong className="text-[#3F2311] font-semibold">
                                    {detail ? formatRupiah(detail.minTotalPrice) : formatRupiah(0)}
                                  </strong>{' '}
                                  • Actual HPP:{' '}
                                  <strong className="text-emerald-900 font-semibold">
                                    {detail ? formatRupiah(detail.minTotalCost) : formatRupiah(0)}
                                  </strong>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
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
                    Customer Choices: <strong className="text-[#6B4227]">{totalCategoryQuota} item(s)</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Fixed Items: <strong className="text-emerald-800">{totalFixedCount} item(s)</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[#8E6D53]">Actual HPP Range:</span>
                  <span className="font-bold text-[#6B4227] text-sm">
                    {formatRange(stats.minCostPrice, stats.maxCostPrice)}
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-medium ml-1">
                    Exact Per Choice
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Bundle Pricing Mode (Fixed Price vs Discount Off Items) */}
            <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5D5BC]/60 pb-3">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-[#C88A32]" strokeWidth={1.5} />
                  <div>
                    <h2 className="font-semibold text-sm text-[#3F2311]">Bundle Pricing &amp; Profit Calculation</h2>
                    <p className="text-[11px] text-[#8E6D53] font-light">
                      Choose between a Fixed Package Price (flat price regardless of choice) or Nominal Discount off items.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.5} />
                  <span className="text-[11px] font-medium">
                    {pricingMode === 'FIXED' ? 'Flat Package Price' : 'Dynamic Per Item'}
                  </span>
                </div>
              </div>

              {/* Pricing Mode Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPricingMode('FIXED')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    pricingMode === 'FIXED'
                      ? 'bg-[#FFFDF8] border-[#6B4227] ring-2 ring-[#6B4227]/20 shadow-xs'
                      : 'bg-[#FAF0DA]/40 border-[#E5D5BC] text-[#8E6D53]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Coins className="h-4 w-4 text-[#6B4227]" strokeWidth={1.5} />
                    <span className="text-xs font-semibold text-[#3F2311]">
                      Fixed Package Price (Harga Fix)
                    </span>
                  </div>
                  <span className="text-[11px] text-[#8E6D53] block font-light leading-relaxed">
                    Flat bundle price (e.g. Rp 60.000) with +Rp 0 upcharge regardless of which flavors customer selects.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPricingMode('DISCOUNT')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    pricingMode === 'DISCOUNT'
                      ? 'bg-[#FFFDF8] border-[#6B4227] ring-2 ring-[#6B4227]/20 shadow-xs'
                      : 'bg-[#FAF0DA]/40 border-[#E5D5BC] text-[#8E6D53]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="h-4 w-4 text-[#C88A32]" strokeWidth={1.5} />
                    <span className="text-xs font-semibold text-[#3F2311]">
                      Discount Off Items (Potongan Harga)
                    </span>
                  </div>
                  <span className="text-[11px] text-[#8E6D53] block font-light leading-relaxed">
                    Customer pays the total normal price of their chosen items minus a nominal bundle discount (Rp).
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* 1. Normal Combined Selling Price (Read-Only) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#8E6D53] flex items-center gap-1">
                      <Lock className="h-3 w-3 text-[#8E6D53]" strokeWidth={1.5} />
                      <span>Normal Item Total</span>
                    </label>
                    <span className="text-[10px] font-medium text-[#6B4227] bg-[#FAF0DA] px-1.5 py-0.2 rounded border border-[#E5D5BC]">
                      Auto
                    </span>
                  </div>
                  <div className="w-full px-3.5 py-2.5 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#3F2311] flex items-center justify-between select-none">
                    <span>{formatRange(stats.minNormalPrice, stats.maxNormalPrice)}</span>
                  </div>
                  <p className="text-[10px] text-[#8E6D53] mt-1 font-light">
                    Sum of normal prices if bought separately
                  </p>
                </div>

                {/* 2. Fixed Selling Price OR Nominal Discount Input */}
                {pricingMode === 'FIXED' ? (
                  <div>
                    <label className="block text-xs font-medium text-[#8E6D53] mb-1.5">
                      Fixed Bundle Price (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={fixedPriceRaw}
                      onChange={(e) => setFixedPriceRaw(e.target.value)}
                      min={1}
                      required
                      placeholder="Enter fixed bundle price"
                      className="w-full px-3.5 py-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#6B4227] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all"
                    />
                    <p className="text-[10px] text-[#8E6D53] mt-1 font-light">
                      Flat price for all valid customer choices
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-[#8E6D53] mb-1.5">
                      Bundle Discount (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={discountAmountRaw}
                      onChange={(e) => setDiscountAmountRaw(e.target.value)}
                      min={0}
                      placeholder="Enter discount amount"
                      className="w-full px-3.5 py-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#C88A32] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all"
                    />
                    <p className="text-[10px] text-[#8E6D53] mt-1 font-light">
                      Nominal discount subtracted from selected items
                    </p>
                  </div>
                )}

                {/* 3. Actual HPP Range (Read-Only) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#8E6D53] flex items-center gap-1">
                      <Lock className="h-3 w-3 text-[#8E6D53]" strokeWidth={1.5} />
                      <span>Actual HPP (Modal)</span>
                    </label>
                    <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      100% Real
                    </span>
                  </div>
                  <div className="w-full px-3.5 py-2.5 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl text-sm font-semibold text-emerald-800 flex items-center justify-between select-none">
                    <span>{formatRange(stats.minCostPrice, stats.maxCostPrice)}</span>
                  </div>
                  <p className="text-[10px] text-[#8E6D53] mt-1 font-light">
                    Reports record exact HPP of customer&apos;s picked items
                  </p>
                </div>
              </div>

              {/* Real-time Selling Price & Profit Margin Preview */}
              <div className="p-4 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#8E6D53] block font-medium">
                    {pricingMode === 'FIXED'
                      ? 'Fixed Customer Bundle Price (All Options +Rp 0):'
                      : 'Final Bundle Selling Price (After Discount):'}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-base font-bold text-[#6B4227]">
                      {formatRange(stats.minFinalPrice, stats.maxFinalPrice)}
                    </span>
                    {pricingMode === 'DISCOUNT' && discountAmount > 0 && (
                      <span className="text-xs text-[#8E6D53] line-through font-normal">
                        {formatRange(stats.minNormalPrice, stats.maxNormalPrice)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#8E6D53] block mt-0.5">
                    {pricingMode === 'FIXED'
                      ? 'Customer pays this exact flat price regardless of which flavors they choose'
                      : `Customer pays: Total Price of Selected Items − ${formatRupiah(discountAmount)}`}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className={`px-3.5 py-1.5 rounded-xl border text-right ${
                      stats.minProfit > 0
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <span
                      className={`text-[11px] font-semibold block ${
                        stats.minProfit > 0 ? 'text-emerald-800' : 'text-red-700'
                      }`}
                    >
                      Gross Profit: {formatRange(stats.minProfit, stats.maxProfit)}
                    </span>
                    <span
                      className={`text-[10px] font-normal ${
                        stats.minProfit > 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {pricingMode === 'FIXED'
                        ? `Fixed (${formatRupiah(fixedPrice)}) − Actual HPP (${formatRange(stats.minCostPrice, stats.maxCostPrice)})`
                        : 'Exact margin across all choices'}
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
