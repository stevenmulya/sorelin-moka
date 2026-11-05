export type BundleSlotType = 'CATEGORY' | 'PRODUCT';

export interface BundleSlotRule {
  id: string;
  type: BundleSlotType;
  categoryName?: string;
  quota?: number;
  allowedProductNames?: string[];
  productId?: number;
  productName?: string;
  quantity?: number;
}

export interface BundleConfig {
  slots: BundleSlotRule[];
  discountAmount?: number;
}

export interface BundlePricingProduct {
  id?: number;
  name: string;
  price: number;
  discountPrice?: number | null;
  costPrice?: number;
  isBundle?: boolean;
  type?: { name: string } | null;
}

function getEffectiveItemPrice(p: { price: number; discountPrice?: number | null }): number {
  return p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price
    ? p.discountPrice
    : p.price;
}

/**
 * Parse bundle configuration from raw availableVariants string.
 * Supports structured JSON string with fallback to legacy single drink string.
 */
export function parseBundleConfig(raw?: string | null): BundleConfig {
  if (!raw || typeof raw !== 'string') {
    return { slots: [] };
  }

  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'NONE') {
    return { slots: [] };
  }

  // 1. Try parsing JSON format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as { slots?: unknown[]; discountAmount?: unknown };
      if (Array.isArray(parsed.slots)) {
        const slots: BundleSlotRule[] = [];
        for (const s of parsed.slots) {
          const item = (s ?? {}) as Partial<BundleSlotRule>;
          if (item.type === 'CATEGORY') {
            const allowedProductNames = Array.isArray(item.allowedProductNames)
              ? item.allowedProductNames
                  .map((n) => (typeof n === 'string' ? n.trim() : ''))
                  .filter(Boolean)
              : undefined;
            const catName = item.categoryName ? String(item.categoryName).trim() : '';
            if (catName || (allowedProductNames && allowedProductNames.length > 0)) {
              slots.push({
                id: item.id || Math.random().toString(36).substring(2, 9),
                type: 'CATEGORY',
                categoryName: catName || 'Custom Choice',
                quota: Math.max(1, Number(item.quota) || 1),
                ...(allowedProductNames && allowedProductNames.length > 0
                  ? { allowedProductNames }
                  : {}),
              });
            }
          } else if (item.type === 'PRODUCT' && item.productName) {
            slots.push({
              id: item.id || Math.random().toString(36).substring(2, 9),
              type: 'PRODUCT',
              productId: typeof item.productId === 'number' ? item.productId : undefined,
              productName: String(item.productName).trim(),
              quantity: Math.max(1, Number(item.quantity) || 1),
            });
          }
        }
        const discountAmount =
          typeof parsed.discountAmount === 'number' &&
          !Number.isNaN(parsed.discountAmount) &&
          parsed.discountAmount >= 0
            ? Math.round(parsed.discountAmount)
            : undefined;
        return {
          slots,
          ...(discountAmount !== undefined ? { discountAmount } : {}),
        };
      }
    } catch {
      // JSON parse error, continue to fallback
    }
  }

  // 2. Fallback: treat string as a single fixed product (e.g. "Air Mineral")
  const cleanName = trimmed.replace(/^(include|termasuk)\s*:?\s*/i, '').trim();
  if (cleanName) {
    return {
      slots: [
        {
          id: 'legacy-fixed-drink',
          type: 'PRODUCT',
          productName: cleanName,
          quantity: 1,
        },
      ],
    };
  }

  return { slots: [] };
}

export function serializeBundleConfig(config: BundleConfig): string {
  const validSlots = (config.slots ?? []).filter((s) => {
    if (s.type === 'CATEGORY') {
      const hasCat = Boolean(s.categoryName && s.categoryName.trim());
      const hasCustom = Boolean(s.allowedProductNames && s.allowedProductNames.length > 0);
      return (hasCat || hasCustom) && Boolean(s.quota && s.quota > 0);
    }
    if (s.type === 'PRODUCT') return Boolean(s.productName && s.quantity && s.quantity > 0);
    return false;
  });

  const payload: BundleConfig = {
    slots: validSlots,
    ...(typeof config.discountAmount === 'number' && !Number.isNaN(config.discountAmount)
      ? { discountAmount: Math.max(0, Math.round(config.discountAmount)) }
      : {}),
  };

  return JSON.stringify(payload);
}

/**
 * Resolve all non-bundle products that are eligible for a given bundle slot.
 * - For `PRODUCT` slots: returns the single matching product.
 * - For `CATEGORY` slots: if `allowedProductNames` is non-empty, returns only those specific products;
 *   otherwise returns all non-bundle products matching `categoryName`.
 */
export function getSlotCandidateProducts<
  T extends { name: string; isBundle?: boolean; type?: { name: string } | null }
>(slot: BundleSlotRule, allProducts: T[]): T[] {
  const safeProducts = (allProducts ?? []).filter((p) => p && !p.isBundle);
  if (slot.type === 'PRODUCT') {
    const target = (slot.productName ?? '').trim().toLowerCase();
    if (!target) return [];
    return safeProducts.filter((p) => (p.name ?? '').trim().toLowerCase() === target);
  }

  if (slot.allowedProductNames && slot.allowedProductNames.length > 0) {
    const allowedSet = new Set(
      slot.allowedProductNames.map((n) => (n ?? '').trim().toLowerCase()).filter(Boolean)
    );
    return safeProducts.filter((p) => allowedSet.has((p.name ?? '').trim().toLowerCase()));
  }

  const catTarget = (slot.categoryName ?? '').trim().toLowerCase();
  if (!catTarget) return [];
  return safeProducts.filter((p) => (p.type?.name ?? '').trim().toLowerCase() === catTarget);
}

/**
 * Compute exact Min–Max price, cost (HPP), and profit ranges for a bundle configuration.
 * Never uses misleading averages: every range reflects the exact minimum and maximum across
 * all valid customer choices.
 */
export function calculateBundlePriceStats(
  slots: BundleSlotRule[],
  discountAmount: number,
  allProducts: BundlePricingProduct[]
) {
  let minNormalPrice = 0;
  let maxNormalPrice = 0;
  let minCostPrice = 0;
  let maxCostPrice = 0;
  let minMarginBeforeDiscount = 0;
  let maxMarginBeforeDiscount = 0;

  const slotDetails = (slots ?? []).map((slot) => {
    const candidates = getSlotCandidateProducts(slot, allProducts ?? []);
    const count =
      slot.type === 'PRODUCT'
        ? Math.max(1, slot.quantity || 1)
        : Math.max(1, slot.quota || 1);

    if (candidates.length === 0) {
      return {
        slotId: slot.id,
        count,
        candidateCount: 0,
        candidateNames: [] as string[],
        minUnitCost: 0,
        maxUnitCost: 0,
        minTotalCost: 0,
        maxTotalCost: 0,
        minUnitPrice: 0,
        maxUnitPrice: 0,
        minTotalPrice: 0,
        maxTotalPrice: 0,
      };
    }

    const unitPrices = candidates.map((p) => getEffectiveItemPrice(p));
    const unitCosts = candidates.map((p) => p.costPrice ?? 0);
    const unitMargins = candidates.map((p) => getEffectiveItemPrice(p) - (p.costPrice ?? 0));

    const minUnitPrice = Math.min(...unitPrices);
    const maxUnitPrice = Math.max(...unitPrices);
    const minUnitCost = Math.min(...unitCosts);
    const maxUnitCost = Math.max(...unitCosts);
    const minUnitMargin = Math.min(...unitMargins);
    const maxUnitMargin = Math.max(...unitMargins);

    const minTotalPrice = minUnitPrice * count;
    const maxTotalPrice = maxUnitPrice * count;
    const minTotalCost = minUnitCost * count;
    const maxTotalCost = maxUnitCost * count;

    minNormalPrice += minTotalPrice;
    maxNormalPrice += maxTotalPrice;
    minCostPrice += minTotalCost;
    maxCostPrice += maxTotalCost;
    minMarginBeforeDiscount += minUnitMargin * count;
    maxMarginBeforeDiscount += maxUnitMargin * count;

    return {
      slotId: slot.id,
      count,
      candidateCount: candidates.length,
      candidateNames: candidates.map((c) => c.name),
      minUnitCost,
      maxUnitCost,
      minTotalCost,
      maxTotalCost,
      minUnitPrice,
      maxUnitPrice,
      minTotalPrice,
      maxTotalPrice,
    };
  });

  const cleanDiscount = Math.max(0, Math.round(discountAmount || 0));
  const minFinalPrice = Math.max(0, minNormalPrice - cleanDiscount);
  const maxFinalPrice = Math.max(0, maxNormalPrice - cleanDiscount);
  const minProfit = minMarginBeforeDiscount - cleanDiscount;
  const maxProfit = maxMarginBeforeDiscount - cleanDiscount;

  return {
    minNormalPrice,
    maxNormalPrice,
    discountAmount: cleanDiscount,
    minFinalPrice,
    maxFinalPrice,
    minCostPrice,
    maxCostPrice,
    minProfit,
    maxProfit,
    slotDetails,
  };
}

export interface StockCheckProduct {
  id: number;
  name: string;
  stock: number;
  isBundle?: boolean;
  availableVariants?: string | null;
  type?: { name: string } | null;
}

export interface StockCheckCartItem {
  product?: StockCheckProduct | null;
  productId?: number;
  quantity: number;
  isBundle?: boolean;
  bundleContents?: string | null;
}

/**
 * Parse a bundleContents string (e.g. "2x Salt Bread Original, 1x Thai Milk Tea")
 * into deduplicated `{ name, quantity }[]` items.
 */
export function parseBundleContentsToItems(bundleContents?: string | null): { name: string; quantity: number }[] {
  if (!bundleContents || !bundleContents.trim()) return [];
  const clean = bundleContents
    .replace(/^(isi|contents|include|termasuk)\s*:?\s*/i, '')
    .replace(/\(\+[^)]+\)/g, '');
  const parts = clean
    .split(/,|\s+\+\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const merged = new Map<string, { name: string; quantity: number }>();

  for (const part of parts) {
    const prefixMatch = part.match(/^(\d+)\s*[xX*]\s*(.+)$/);
    let name = '';
    let qty = 1;
    if (prefixMatch) {
      qty = Math.max(1, parseInt(prefixMatch[1], 10));
      name = prefixMatch[2].trim();
    } else {
      const suffixMatch = part.match(/^(.+?)\s*\(\s*(\d+)\s*[xX*]?\s*\)$/);
      if (suffixMatch) {
        name = suffixMatch[1].trim();
        qty = Math.max(1, parseInt(suffixMatch[2], 10));
      } else {
        name = part.trim();
      }
    }
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += qty;
    } else {
      merged.set(key, { name, quantity: qty });
    }
  }

  return Array.from(merged.values());
}

/**
 * Calculate total quantity demanded per physical product ID across all single items
 * and bundle contents currently in the cart.
 */
export function getCartProductDemand(
  cartItems: StockCheckCartItem[],
  allProducts: StockCheckProduct[]
): Map<number, number> {
  const demand = new Map<number, number>();
  const safeCart = cartItems ?? [];
  const safeProducts = allProducts ?? [];
  for (const ci of safeCart) {
    if (!ci) continue;
    const isBundleItem = Boolean(ci.isBundle || ci.product?.isBundle);
    const prodId = ci.product?.id ?? ci.productId;
    if (!isBundleItem) {
      if (typeof prodId === 'number') {
        demand.set(prodId, (demand.get(prodId) ?? 0) + (ci.quantity || 0));
      }
    } else if (ci.bundleContents) {
      const parsed = parseBundleContentsToItems(ci.bundleContents);
      for (const pf of parsed) {
        const matchingProd = safeProducts.find(
          (p) => p && !p.isBundle && (p.name ?? '').trim().toLowerCase() === pf.name.trim().toLowerCase()
        );
        if (matchingProd) {
          demand.set(
            matchingProd.id,
            (demand.get(matchingProd.id) ?? 0) + pf.quantity * (ci.quantity || 0)
          );
        }
      }
    }
  }
  return demand;
}

/**
 * Determine whether a cart item's quantity can be incremented by 1 without exceeding
 * the physical stock of any underlying product.
 */
export function canIncrementCartItem(
  targetItem: StockCheckCartItem | null | undefined,
  cartItems: StockCheckCartItem[],
  allProducts: StockCheckProduct[]
): boolean {
  if (!targetItem) return false;
  const safeProducts = allProducts ?? [];
  const demand = getCartProductDemand(cartItems, safeProducts);
  const isBundleItem = Boolean(targetItem.isBundle || targetItem.product?.isBundle);

  if (!isBundleItem) {
    const targetId = targetItem.product?.id ?? targetItem.productId;
    if (typeof targetId !== 'number') return false;
    const prod = safeProducts.find((p) => p && p.id === targetId) ?? targetItem.product;
    if (!prod) return false;
    const used = demand.get(prod.id) ?? 0;
    return used + 1 <= prod.stock;
  }

  if (!targetItem.bundleContents) return false;
  const parsed = parseBundleContentsToItems(targetItem.bundleContents);
  if (parsed.length === 0) return false;

  for (const pf of parsed) {
    const matchingProd = safeProducts.find(
      (p) => p && !p.isBundle && (p.name ?? '').trim().toLowerCase() === pf.name.trim().toLowerCase()
    );
    if (!matchingProd) return false;
    const used = demand.get(matchingProd.id) ?? 0;
    if (used + pf.quantity > matchingProd.stock) {
      return false;
    }
  }

  return true;
}

/**
 * Compute the maximum number of boxes of a bundle that can be assembled from
 * the currently available physical stock of its component products/categories/custom option pools.
 */
export function getBundleMaxStock(
  bundleProd: StockCheckProduct,
  allProducts: StockCheckProduct[],
  cartDemand?: Map<number, number>
): number {
  if (!bundleProd.isBundle) return bundleProd.stock;
  const config = parseBundleConfig(bundleProd.availableVariants);
  if (!config.slots || config.slots.length === 0) return 0;

  const safeProducts = (allProducts ?? []).filter((p) => p && !p.isBundle);
  const remStock = (p: StockCheckProduct) => Math.max(0, p.stock - (cartDemand?.get(p.id) ?? 0));

  const fixedByProdName = new Map<string, number>();
  const choiceSlots: Array<{ quota: number; candidates: StockCheckProduct[]; poolKey: string }> = [];

  for (const slot of config.slots) {
    if (slot.type === 'PRODUCT' && slot.productName) {
      const key = slot.productName.trim().toLowerCase();
      fixedByProdName.set(key, (fixedByProdName.get(key) ?? 0) + Math.max(1, slot.quantity || 1));
    } else if (slot.type === 'CATEGORY') {
      const candidates = getSlotCandidateProducts(slot, safeProducts);
      if (candidates.length === 0) return 0;
      const poolKey = candidates
        .map((c) => c.id)
        .sort((a, b) => a - b)
        .join(',');
      choiceSlots.push({
        quota: Math.max(1, slot.quota || 1),
        candidates,
        poolKey,
      });
    }
  }

  if (fixedByProdName.size === 0 && choiceSlots.length === 0) return 0;

  let maxBoxes = Infinity;

  // 1. Check each fixed product requirement
  for (const [prodNameLower, reqQty] of fixedByProdName.entries()) {
    const prod = safeProducts.find((p) => (p.name ?? '').trim().toLowerCase() === prodNameLower);
    if (!prod) return 0;
    const avail = remStock(prod);
    maxBoxes = Math.min(maxBoxes, Math.floor(avail / reqQty));
  }

  if (maxBoxes === 0) return 0;

  // 2. Group choice slots by identical candidate pool and check each pool's stock
  const groupedPools = new Map<string, { quota: number; candidates: StockCheckProduct[] }>();
  for (const cs of choiceSlots) {
    const existing = groupedPools.get(cs.poolKey);
    if (existing) {
      existing.quota += cs.quota;
    } else {
      groupedPools.set(cs.poolKey, { quota: cs.quota, candidates: cs.candidates });
    }
  }

  for (const pool of groupedPools.values()) {
    const totalPoolStock = pool.candidates.reduce((sum, p) => sum + remStock(p), 0);
    let fixedInPool = 0;
    for (const cp of pool.candidates) {
      fixedInPool += fixedByProdName.get((cp.name ?? '').trim().toLowerCase()) ?? 0;
    }
    const neededPerBox = pool.quota + fixedInPool;
    maxBoxes = Math.min(maxBoxes, Math.floor(totalPoolStock / neededPerBox));
  }

  // 3. Also check combined union across all overlapping choice slots
  if (groupedPools.size > 1) {
    const unionMap = new Map<number, StockCheckProduct>();
    let totalChoiceQuota = 0;
    for (const pool of groupedPools.values()) {
      totalChoiceQuota += pool.quota;
      for (const cp of pool.candidates) {
        unionMap.set(cp.id, cp);
      }
    }
    const unionCandidates = Array.from(unionMap.values());
    const totalUnionStock = unionCandidates.reduce((sum, p) => sum + remStock(p), 0);
    let fixedInUnion = 0;
    for (const cp of unionCandidates) {
      fixedInUnion += fixedByProdName.get((cp.name ?? '').trim().toLowerCase()) ?? 0;
    }
    const totalUnionNeeded = totalChoiceQuota + fixedInUnion;
    maxBoxes = Math.min(maxBoxes, Math.floor(totalUnionStock / totalUnionNeeded));
  }

  return maxBoxes === Infinity ? 0 : Math.max(0, maxBoxes);
}
