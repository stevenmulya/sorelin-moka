'use client';

import { useState, useMemo } from 'react';
import { X, Check, Plus, Minus, Package, Sparkles, Layers } from 'lucide-react';
import { formatRupiah, effectivePrice } from '@/lib/utils';
import { parseBundleConfig } from '@/lib/bundle-config';

export interface ProductVariantItem {
  id: number;
  productId: number;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  bundleUpcharge: number;
  priority: number;
  isActive: boolean;
}

export interface CustomizableProduct {
  id: number;
  name: string;
  price: number;
  discountPrice?: number | null;
  stock: number;
  type?: { name: string } | null;
  variant?: { name: string } | null;
  availableVariants?: string | null;
  isBundle?: boolean;
  bundleQuota?: number | null;
  images?: Array<{ url: string }> | null;
  variants?: ProductVariantItem[];
}

export interface CustomizationResult {
  product: CustomizableProduct;
  quantity: number;
  variantOptionId?: number | null;
  selectedVariant: string | null;
  selectedPrice: number;
  isBundle: boolean;
  bundleContents: string | null;
  notes: string | null;
}

const DEFAULT_FLAVORS = [
  'Original Sea Salt',
  'Garlic Butter',
  'Double Cheese Melt',
  'Dark Chocolate Melt',
  'Truffle Ham & Cheese',
];

export default function ItemCustomizerModal({
  product,
  maxAvailableStock,
  allAvailableVariants,
  allProducts,
  onClose,
  onConfirm,
}: {
  product: CustomizableProduct | null;
  maxAvailableStock: number;
  allAvailableVariants?: ProductVariantItem[];
  allProducts?: CustomizableProduct[];
  onClose: () => void;
  onConfirm: (result: CustomizationResult) => void;
}) {
  const isBundle = Boolean(product?.isBundle);
  const bundleQuota = product?.bundleQuota || 3;

  // Parse structured Universal Bundle Config
  const bundleConfig = useMemo(() => {
    return parseBundleConfig(product?.availableVariants);
  }, [product]);

  const categorySlots = useMemo(() => {
    return bundleConfig.slots.filter((s) => s.type === 'CATEGORY');
  }, [bundleConfig]);

  const fixedSlots = useMemo(() => {
    return bundleConfig.slots.filter((s) => s.type === 'PRODUCT');
  }, [bundleConfig]);

  const hasConfiguredSlots = categorySlots.length > 0;

  // Single item flavors
  const singleProductVariants = useMemo(() => {
    if (product?.variants && product.variants.length > 0) {
      return product.variants.filter((v) => v.isActive);
    }
    return [];
  }, [product]);

  // Fallback string variants for products without ProductVariantItem records
  const fallbackStringVariants = useMemo(() => {
    if (!product?.availableVariants) return DEFAULT_FLAVORS;
    const list = product.availableVariants
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    return list.length > 0 ? list : DEFAULT_FLAVORS;
  }, [product]);

  // Initial single variant name
  const [selectedVariantName, setSelectedVariantName] = useState<string>(() => {
    if (singleProductVariants.length > 0) {
      const inStock = singleProductVariants.find((v) => v.stock > 0);
      return inStock ? inStock.name : singleProductVariants[0].name;
    }
    return fallbackStringVariants[0] || 'Original Sea Salt';
  });
  const [singleQty, setSingleQty] = useState<number>(1);

  // Legacy Bundle flavor pool
  const legacyBundleFlavorList = useMemo(() => {
    if (allAvailableVariants && allAvailableVariants.length > 0) {
      return allAvailableVariants.filter((v) => v.isActive);
    }
    if (product?.variants && product.variants.length > 0) {
      return product.variants.filter((v) => v.isActive);
    }
    return [];
  }, [allAvailableVariants, product]);

  // State for legacy bundle: map of flavor name -> quantity
  const [legacyBundleCounts, setLegacyBundleCounts] = useState<Record<string, number>>({});

  // State for Slot-based Bundle: map of slotId -> (map of itemName -> count)
  const [slotSelections, setSlotSelections] = useState<Record<string, Record<string, number>>>({});
  const [notes, setNotes] = useState<string>('');

  const legacyFixedDrink = useMemo(() => {
    if (!product?.isBundle) return null;
    const raw = product?.availableVariants?.trim();
    if (!raw || raw.toUpperCase() === 'NONE') return null;
    return raw.replace(/^(include|termasuk)\s*:?\s*/i, '').trim() || 'Air Mineral';
  }, [product]);

  if (!product) return null;

  // Single mode variant option lookup
  const selectedVariantOption = singleProductVariants.find((v) => v.name === selectedVariantName);
  const unitPrice = selectedVariantOption ? selectedVariantOption.price : effectivePrice(product);
  const effectiveMaxStock = selectedVariantOption
    ? Math.max(0, selectedVariantOption.stock)
    : Math.max(0, maxAvailableStock);

  // Bundle calculations
  const bundleBasePrice = effectivePrice(product);

  // Map of category name (lowercase) -> min price among standalone products in that category
  const categoryMinPrices = useMemo(() => {
    const map = new Map<string, number>();
    (allProducts || []).forEach((p) => {
      if (!p.isBundle && p.type?.name) {
        const cat = p.type.name.trim().toLowerCase();
        const eff = effectivePrice(p);
        const curr = map.get(cat);
        if (curr === undefined || eff < curr) {
          map.set(cat, eff);
        }
      }
    });
    return map;
  }, [allProducts]);

  // Dynamic slot upcharge calculation based on selected items
  const totalSlotUpcharge = useMemo(() => {
    if (!hasConfiguredSlots) return 0;
    let sum = 0;
    for (const slot of categorySlots) {
      const catKey = slot.categoryName ? slot.categoryName.trim().toLowerCase() : '';
      const minCatPrice = categoryMinPrices.get(catKey) ?? 0;
      const matchingProducts = (allProducts || []).filter(
        (p) => p.type?.name?.trim().toLowerCase() === catKey && !p.isBundle
      );
      const items = slotSelections[slot.id] || {};
      for (const [name, count] of Object.entries(items)) {
        if (count > 0) {
          const prod = matchingProducts.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
          if (prod) {
            const upcharge = minCatPrice > 0 ? Math.max(0, effectivePrice(prod) - minCatPrice) : 0;
            sum += upcharge * count;
          }
        }
      }
    }
    return sum;
  }, [hasConfiguredSlots, categorySlots, categoryMinPrices, allProducts, slotSelections]);

  const totalLegacyUpcharge = useMemo(() => {
    if (hasConfiguredSlots) return 0;
    let sum = 0;
    for (const [flavorName, count] of Object.entries(legacyBundleCounts)) {
      if (count > 0) {
        const v = legacyBundleFlavorList.find((item) => item.name.toLowerCase() === flavorName.toLowerCase());
        if (v?.bundleUpcharge) {
          sum += v.bundleUpcharge * count;
        }
      }
    }
    return sum;
  }, [hasConfiguredSlots, legacyBundleCounts, legacyBundleFlavorList]);

  const totalBundleUpcharges = hasConfiguredSlots ? totalSlotUpcharge : totalLegacyUpcharge;
  const liveBundlePrice = bundleBasePrice + totalBundleUpcharges;

  // Slot helper functions
  const getSlotCount = (slotId: string) => {
    const items = slotSelections[slotId] || {};
    return Object.values(items).reduce((sum, n) => sum + (n || 0), 0);
  };

  const isSlotReady = (slotId: string, quota?: number) => {
    if (!quota) return true;
    return getSlotCount(slotId) === quota;
  };

  const isSlotBasedReady = hasConfiguredSlots
    ? categorySlots.every((s) => isSlotReady(s.id, s.quota))
    : false;

  const totalLegacyBundleItems = Object.values(legacyBundleCounts).reduce((sum, n) => sum + (n || 0), 0);
  const isLegacyReady = totalLegacyBundleItems === bundleQuota;

  const isBundleReady = hasConfiguredSlots ? isSlotBasedReady : isLegacyReady;
  const isFormReady = isBundle ? isBundleReady : (effectiveMaxStock > 0 && singleQty > 0 && singleQty <= effectiveMaxStock);

  const handleSlotIncrement = (slotId: string, quota: number, itemName: string, stock: number) => {
    const currentTotal = getSlotCount(slotId);
    if (currentTotal >= quota) return;
    const currentItemCount = slotSelections[slotId]?.[itemName] || 0;
    if (currentItemCount >= stock) return;

    setSlotSelections((prev) => ({
      ...prev,
      [slotId]: {
        ...(prev[slotId] || {}),
        [itemName]: currentItemCount + 1,
      },
    }));
  };

  const handleSlotDecrement = (slotId: string, itemName: string) => {
    const currentItemCount = slotSelections[slotId]?.[itemName] || 0;
    if (currentItemCount <= 0) return;

    setSlotSelections((prev) => {
      const nextSlot = { ...(prev[slotId] || {}) };
      if (nextSlot[itemName] <= 1) {
        delete nextSlot[itemName];
      } else {
        nextSlot[itemName] -= 1;
      }
      return {
        ...prev,
        [slotId]: nextSlot,
      };
    });
  };

  const handleLegacyIncrement = (flavorName: string) => {
    if (totalLegacyBundleItems >= bundleQuota) return;
    setLegacyBundleCounts((prev) => ({
      ...prev,
      [flavorName]: (prev[flavorName] || 0) + 1,
    }));
  };

  const handleLegacyDecrement = (flavorName: string) => {
    if (!legacyBundleCounts[flavorName] || legacyBundleCounts[flavorName] <= 0) return;
    setLegacyBundleCounts((prev) => {
      const next = { ...prev };
      if (next[flavorName] <= 1) delete next[flavorName];
      else next[flavorName] -= 1;
      return next;
    });
  };

  const handleConfirm = () => {
    if (isBundle) {
      if (!isBundleReady) return;

      const parts: string[] = [];

      if (hasConfiguredSlots) {
        // Collect items from category slots
        for (const slot of categorySlots) {
          const catKey = slot.categoryName ? slot.categoryName.trim().toLowerCase() : '';
          const minCatPrice = categoryMinPrices.get(catKey) ?? 0;
          const matchingProducts = (allProducts || []).filter(
            (p) => p.type?.name?.trim().toLowerCase() === catKey && !p.isBundle
          );
          const items = slotSelections[slot.id] || {};
          for (const [name, count] of Object.entries(items)) {
            if (count > 0) {
              const prod = matchingProducts.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
              const upcharge = prod && minCatPrice > 0 ? Math.max(0, effectivePrice(prod) - minCatPrice) : 0;
              if (upcharge > 0) {
                parts.push(`${count}x ${name} (+${formatRupiah(upcharge)})`);
              } else {
                parts.push(`${count}x ${name}`);
              }
            }
          }
        }
        // Collect fixed product slots
        for (const fixed of fixedSlots) {
          if (fixed.productName && fixed.quantity) {
            parts.push(`${fixed.quantity}x ${fixed.productName}`);
          }
        }
      } else {
        // Legacy bundle confirmation
        for (const [flavor, count] of Object.entries(legacyBundleCounts)) {
          if (count > 0) {
            const v = legacyBundleFlavorList.find((item) => item.name.toLowerCase() === flavor.toLowerCase());
            if (v?.bundleUpcharge && v.bundleUpcharge > 0) {
              parts.push(`${count}x ${flavor} (+${formatRupiah(v.bundleUpcharge)})`);
            } else {
              parts.push(`${count}x ${flavor}`);
            }
          }
        }
        if (legacyFixedDrink) {
          parts.push(`1x ${legacyFixedDrink}`);
        }
      }

      const summary = parts.join(', ');

      onConfirm({
        product,
        quantity: 1,
        variantOptionId: null,
        selectedVariant: null,
        selectedPrice: liveBundlePrice,
        isBundle: true,
        bundleContents: summary,
        notes: notes.trim() || null,
      });
    } else {
      onConfirm({
        product,
        quantity: singleQty,
        variantOptionId: selectedVariantOption?.id || null,
        selectedVariant: selectedVariantName || null,
        selectedPrice: unitPrice,
        isBundle: false,
        bundleContents: null,
        notes: notes.trim() || null,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3F2311]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-[#E5D5BC] bg-[#FAF0DA]/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#C88A32]" strokeWidth={1.5} />
            <div>
              <h3 className="font-semibold text-sm text-[#3F2311] leading-tight">
                {isBundle ? `Customize: ${product.name}` : `Customize: ${product.name}`}
              </h3>
              <p className="text-[11px] text-[#8E6D53]">
                {isBundle
                  ? 'Select your preferred flavors and view included items.'
                  : 'Choose your preferred flavor and quantity.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8E6D53] hover:text-[#3F2311] hover:bg-[#FAF0DA] rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 kiosk-scrollbar">
          {/* BUNDLING VIEW */}
          {isBundle ? (
            <div className="space-y-4">
              {hasConfiguredSlots ? (
                /* UNIVERSAL BUNDLE SLOTS VIEW */
                <div className="space-y-4">
                  {categorySlots.map((slot) => {
                    const slotCount = getSlotCount(slot.id);
                    const slotQuota = slot.quota || 1;
                    const slotReady = slotCount === slotQuota;

                    // Match products from allProducts where category name matches slot.categoryName
                    const matchingProducts = (allProducts || []).filter(
                      (p) =>
                        p.type?.name?.toLowerCase() === slot.categoryName?.toLowerCase() &&
                        !p.isBundle
                    );

                    // Fallback to legacy variants if no standalone products in category
                    const displayItems =
                      matchingProducts.length > 0
                        ? matchingProducts
                        : legacyBundleFlavorList.length > 0
                        ? legacyBundleFlavorList
                        : fallbackStringVariants.map((name) => ({ id: 0, name, stock: 99 }));

                    return (
                      <div
                        key={slot.id}
                        className="bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Layers className="h-4 w-4 text-[#6B4227]" strokeWidth={1.5} />
                            <span className="text-xs font-semibold text-[#3F2311]">
                              Choose {slotQuota}x: {slot.categoryName}
                            </span>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${
                              slotReady
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-[#FFFDF8] text-[#6B4227] border-[#E5D5BC]'
                            }`}
                          >
                            {slotCount} / {slotQuota} Selected
                          </span>
                        </div>

                        <div className="divide-y divide-[#E5D5BC]/60 border border-[#E5D5BC] rounded-xl overflow-hidden bg-[#FFFDF8]">
                          {displayItems.map((item) => {
                            const count = slotSelections[slot.id]?.[item.name] || 0;
                            const itemStock = 'stock' in item && typeof item.stock === 'number' ? item.stock : 99;
                            const isOutOfStock = itemStock <= 0;
                            const isMaxStock = count >= itemStock;
                            const catKey = slot.categoryName ? slot.categoryName.trim().toLowerCase() : '';
                            const minCatPrice = categoryMinPrices.get(catKey) ?? 0;
                            const itemPrice = 'price' in item && typeof item.price === 'number' ? effectivePrice(item as CustomizableProduct) : 0;
                            const upcharge = minCatPrice > 0 ? Math.max(0, itemPrice - minCatPrice) : ('bundleUpcharge' in item ? (item.bundleUpcharge as number) || 0 : 0);

                            return (
                              <div
                                key={item.name}
                                className={`px-3.5 py-2.5 flex items-center justify-between transition-colors ${
                                  isOutOfStock ? 'bg-stone-100/60 opacity-60' : 'hover:bg-[#FAF0DA]/30'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`text-xs font-semibold ${
                                        isOutOfStock ? 'text-stone-500 line-through' : 'text-[#3F2311]'
                                      }`}
                                    >
                                      {item.name}
                                    </span>
                                    {upcharge > 0 ? (
                                      <span className="text-[10px] font-bold text-[#6B4227] bg-[#FAF0DA] px-1.5 py-0.2 rounded border border-[#6B4227]/30">
                                        +{formatRupiah(upcharge)}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                        Bebas Pilih (+Rp 0)
                                      </span>
                                    )}
                                  </div>
                                  {isOutOfStock ? (
                                    <span className="ml-0 text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-200 inline-block mt-0.5">
                                      Sold Out
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-[#8E6D53] inline-block mt-0.5">
                                      ({itemStock} left)
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSlotDecrement(slot.id, item.name)}
                                    disabled={count <= 0}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#FAF0DA] text-[#6B4227] border border-[#E5D5BC] hover:bg-[#F2E6CF] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                                  >
                                    <Minus className="h-3 w-3" strokeWidth={1.5} />
                                  </button>
                                  <span className="w-5 text-center text-xs font-semibold text-[#3F2311]">
                                    {count}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSlotIncrement(slot.id, slotQuota, item.name, itemStock)
                                    }
                                    disabled={slotCount >= slotQuota || isOutOfStock || isMaxStock}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                                  >
                                    <Plus className="h-3 w-3" strokeWidth={1.5} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Fixed Products in this bundle */}
                  {fixedSlots.length > 0 && (
                    <div className="space-y-2">
                      {fixedSlots.map((fixed, fIdx) => (
                        <div
                          key={fIdx}
                          className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-emerald-950">
                                Includes: {fixed.quantity}x {fixed.productName}
                              </p>
                              <p className="text-[11px] text-emerald-800/80">
                                Automatically included with this package
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                            Included
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* LEGACY BUNDLE VIEW */
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-[#FAF0DA] rounded-xl border border-[#E5D5BC]">
                    <div>
                      <span className="text-xs font-bold text-[#3F2311] block">
                        Choose {bundleQuota} Flavors for This Bundle
                      </span>
                      <span className="text-[11px] text-[#8E6D53]">
                        Mix and match flavors up to the quota.
                      </span>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                        isLegacyReady
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-[#FFFDF8] text-[#6B4227] border-[#E5D5BC]'
                      }`}
                    >
                      {totalLegacyBundleItems} / {bundleQuota} Selected
                    </div>
                  </div>

                  <div className="divide-y divide-[#E5D5BC]/60 border border-[#E5D5BC] rounded-xl overflow-hidden bg-[#FFFDF8]">
                    {(legacyBundleFlavorList.length > 0
                      ? legacyBundleFlavorList
                      : fallbackStringVariants.map((name) => ({ id: 0, name, stock: 99 }))
                    ).map((flavor) => {
                      const count = legacyBundleCounts[flavor.name] || 0;
                      const hasStockTracking = 'stock' in flavor && typeof flavor.stock === 'number';
                      const isOutOfStock = hasStockTracking && flavor.stock <= 0;
                      const isMaxTrayReached = hasStockTracking && count >= flavor.stock;

                      return (
                        <div
                          key={flavor.name}
                          className={`px-4 py-3 flex items-center justify-between transition-colors ${
                            isOutOfStock ? 'bg-stone-100/60 opacity-60' : 'hover:bg-[#FAF0DA]/30'
                          }`}
                        >
                          <div>
                            <span
                              className={`text-xs font-semibold ${
                                isOutOfStock ? 'text-stone-500 line-through' : 'text-[#3F2311]'
                              }`}
                            >
                              {flavor.name}
                            </span>
                            {isOutOfStock ? (
                              <span className="ml-1.5 text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                                Sold Out
                              </span>
                            ) : hasStockTracking ? (
                              <span className="ml-1.5 text-[10px] text-[#8E6D53]">
                                ({flavor.stock} left)
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleLegacyDecrement(flavor.name)}
                              disabled={count <= 0}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#FAF0DA] text-[#6B4227] border border-[#E5D5BC] hover:bg-[#F2E6CF] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                            >
                              <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                            <span className="w-6 text-center text-xs font-semibold text-[#3F2311]">
                              {count}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleLegacyIncrement(flavor.name)}
                              disabled={totalLegacyBundleItems >= bundleQuota || isOutOfStock || isMaxTrayReached}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {legacyFixedDrink && (
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                          <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-emerald-950">
                            Bonus: 1x {legacyFixedDrink}
                          </p>
                          <p className="text-[11px] text-emerald-800/80">
                            Automatically included with this package
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                        Included
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* SINGLE ITEM VARIANT VIEW */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8E6D53] mb-2">Select Flavor:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {singleProductVariants.length > 0 ? (
                    singleProductVariants.map((flavor) => {
                      const isSelected = selectedVariantName === flavor.name;
                      const isOutOfStock = flavor.stock <= 0;

                      return (
                        <button
                          key={flavor.id}
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => {
                            if (!isOutOfStock) {
                              setSelectedVariantName(flavor.name);
                              setSingleQty((q) => Math.min(Math.max(1, flavor.stock), q));
                            }
                          }}
                          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-[#6B4227] text-[#FAF0DA] border-[#6B4227] shadow-xs'
                              : isOutOfStock
                              ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed line-through'
                              : 'bg-[#FFFDF8] text-[#6B4227] border-[#E5D5BC] hover:bg-[#FAF0DA]'
                          }`}
                        >
                          <span>{flavor.name}</span>
                          {isOutOfStock ? (
                            <span className="text-[9px] font-semibold text-red-500 bg-red-50 px-1 py-0.2 rounded border border-red-200 no-underline">
                              Sold Out
                            </span>
                          ) : (
                            isSelected && <Check className="h-4 w-4" strokeWidth={1.5} />
                          )}
                        </button>
                      );
                    })
                  ) : (
                    fallbackStringVariants.map((flavor) => {
                      const isSelected = selectedVariantName === flavor;
                      return (
                        <button
                          key={flavor}
                          type="button"
                          onClick={() => setSelectedVariantName(flavor)}
                          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#6B4227] text-[#FAF0DA] border-[#6B4227] shadow-xs'
                              : 'bg-[#FFFDF8] text-[#6B4227] border-[#E5D5BC] hover:bg-[#FAF0DA]'
                          }`}
                        >
                          <span>{flavor}</span>
                          {isSelected && <Check className="h-4 w-4" strokeWidth={1.5} />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center justify-between p-3.5 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl">
                <div>
                  <span className="text-xs font-semibold text-[#3F2311] block">Order Quantity</span>
                  <span className="text-[11px] text-[#8E6D53]">
                    Available stock: {effectiveMaxStock}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSingleQty((q) => Math.max(1, q - 1))}
                    disabled={singleQty <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#FFFDF8] text-[#6B4227] border border-[#E5D5BC] hover:bg-[#FAF0DA] disabled:opacity-30 cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-[#3F2311]">{singleQty}</span>
                  <button
                    type="button"
                    onClick={() => setSingleQty((q) => Math.min(effectiveMaxStock, q + 1))}
                    disabled={singleQty >= effectiveMaxStock || effectiveMaxStock <= 0}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] disabled:opacity-30 cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notes field */}
          <div>
            <label className="block text-xs font-semibold text-[#8E6D53] mb-1">Special Instructions (Optional):</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Warm up, pack separately, extra napkins..."
              maxLength={150}
              className="w-full px-3.5 py-2.5 bg-[#FAF0DA]/40 border border-[#E5D5BC] rounded-xl text-xs text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:bg-[#FFFDF8] transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E5D5BC] bg-[#FAF0DA]/60 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-[#8E6D53] block">Subtotal:</span>
            <span className="text-base font-bold text-[#6B4227]">
              {formatRupiah(isBundle ? liveBundlePrice : unitPrice * singleQty)}
            </span>
            {isBundle && totalBundleUpcharges > 0 && (
              <span className="text-[10px] text-[#8E6D53] block">
                Termasuk tambahan tier +{formatRupiah(totalBundleUpcharges)}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!isFormReady}
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            {isBundle
              ? isBundleReady
                ? 'Add Bundle to Order'
                : 'Select Required Items'
              : effectiveMaxStock <= 0
                ? 'Sold Out'
                : 'Add to Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
