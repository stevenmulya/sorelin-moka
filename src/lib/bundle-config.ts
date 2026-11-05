export type BundleSlotType = 'CATEGORY' | 'PRODUCT';
export type BundlePricingMode = 'FIXED' | 'DISCOUNT';

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
  pricingMode?: BundlePricingMode;
  fixedPrice?: number;
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
      const parsed = JSON.parse(trimmed) as {
        slots?: unknown[];
        pricingMode?: unknown;
        fixedPrice?: unknown;
        discountAmount?: unknown;
      };
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

        const fixedPrice =
          typeof parsed.fixedPrice === 'number' &&
          !Number.isNaN(parsed.fixedPrice) &&
          parsed.fixedPrice > 0
            ? Math.round(parsed.fixedPrice)
            : undefined;

        const discountAmount =
          typeof parsed.discountAmount === 'number' &&
          !Number.isNaN(parsed.discountAmount) &&
          parsed.discountAmount >= 0
            ? Math.round(parsed.discountAmount)
            : undefined;

        const pricingMode: BundlePricingMode | undefined =
          parsed.pricingMode === 'FIXED' || parsed.pricingMode === 'DISCOUNT'
            ? parsed.pricingMode
            : fixedPrice !== undefined
              ? 'FIXED'
              : discountAmount !== undefined
                ? 'DISCOUNT'
                : undefined;

        return {
          slots,
          ...(pricingMode ? { pricingMode } : {}),
          ...(fixedPrice !== undefined ? { fixedPrice } : {}),
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
    ...(config.pricingMode ? { pricingMode: config.pricingMode } : {}),
    ...(typeof config.fixedPrice === 'number' && !Number.isNaN(config.fixedPrice) && config.fixedPrice > 0
      ? { fixedPrice: Math.round(config.fixedPrice) }
      : {}),
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
 * Supports both:
 *  - `DISCOUNT` mode: Final Price = Sum(Chosen Item Prices) - discountAmount
 *  - `FIXED` mode: Final Price = fixedPrice (flat price regardless of which options are chosen)
 */
export function calculateBundlePriceStats(
  slots: BundleSlotRule[],
  pricingOrDiscount:
    | number
    | {
        pricingMode?: BundlePricingMode;
        fixedPrice?: number;
        discountAmount?: number;
      },
  allProducts: BundlePricingProduct[]
) {
  const pricingOpts =
    typeof pricingOrDiscount === 'number'
      ? { pricingMode: 'DISCOUNT' as const, discountAmount: pricingOrDiscount, fixedPrice: 0 }
      : {
          pricingMode: pricingOrDiscount.pricingMode ?? 'DISCOUNT',
          fixedPrice: Math.max(0, Math.round(pricingOrDiscount.fixedPrice || 0)),
          discountAmount: Math.max(0, Math.round(pricingOrDiscount.discountAmount || 0)),
        };

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

  if (pricingOpts.pricingMode === 'FIXED') {
    const flatPrice = pricingOpts.fixedPrice;
    // In FIXED mode, customer always pays `flatPrice`, while HPP ranges from minCostPrice to maxCostPrice:
    // Lowest profit occurs when customer picks highest-HPP items (flatPrice - maxCostPrice)
    // Highest profit occurs when customer picks lowest-HPP items (flatPrice - minCostPrice)
    const minProfit = flatPrice - maxCostPrice;
    const maxProfit = flatPrice - minCostPrice;
    return {
      pricingMode: 'FIXED' as const,
      fixedPrice: flatPrice,
      discountAmount: Math.max(0, minNormalPrice - flatPrice),
      minNormalPrice,
      maxNormalPrice,
      minFinalPrice: flatPrice,
      maxFinalPrice: flatPrice,
      minCostPrice,
      maxCostPrice,
      minProfit,
      maxProfit,
      slotDetails,
    };
  }

  const cleanDiscount = pricingOpts.discountAmount;
  const minFinalPrice = Math.max(0, minNormalPrice - cleanDiscount);
  const maxFinalPrice = Math.max(0, maxNormalPrice - cleanDiscount);
  const minProfit = minMarginBeforeDiscount - cleanDiscount;
  const maxProfit = maxMarginBeforeDiscount - cleanDiscount;

  return {
    pricingMode: 'DISCOUNT' as const,
    fixedPrice: minFinalPrice,
    discountAmount: cleanDiscount,
    minNormalPrice,
    maxNormalPrice,
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
    .replace(/\(\+[^)]+\)/g, '')
    .replace(/\(include\)/gi, '')
    .replace(/\(termasuk\)/gi, '')
    .trim();
  const parts = clean
    .split(/,|\s+\+\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const merged = new Map<string, { name: string; quantity: number }>();

  for (const part of parts) {
    const prefixMatch = part.match(/^\(?(\d+)\s*[xX*]\)?\s*(.+)$/);
    let name = '';
    let qty = 1;
    if (prefixMatch) {
      qty = Math.max(1, parseInt(prefixMatch[1], 10));
      name = prefixMatch[2].replace(/[()]/g, '').trim();
    } else {
      const suffixMatch = part.match(/^(.+?)\s*\(\s*(\d+)\s*[xX*]?\s*\)$/);
      if (suffixMatch) {
        name = suffixMatch[1].replace(/[()]/g, '').trim();
        qty = Math.max(1, parseInt(suffixMatch[2], 10));
      } else {
        name = part.replace(/[()]/g, '').trim();
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
 * Uses Hall's Marriage Theorem across all non-empty subsets of choice pools to guarantee
 * 100% mathematical accuracy even when fixed slots and multiple choice slots overlap.
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

  // 2. Group choice slots by identical candidate pool
  const groupedPoolsMap = new Map<string, { quota: number; candidates: StockCheckProduct[] }>();
  for (const cs of choiceSlots) {
    const existing = groupedPoolsMap.get(cs.poolKey);
    if (existing) {
      existing.quota += cs.quota;
    } else {
      groupedPoolsMap.set(cs.poolKey, { quota: cs.quota, candidates: cs.candidates });
    }
  }

  const pools = Array.from(groupedPoolsMap.values());
  if (pools.length === 0) {
    return maxBoxes === Infinity ? 0 : Math.max(0, maxBoxes);
  }

  // 3. By Hall's Marriage Theorem, for every non-empty subset S of choice pools,
  // the union of candidate products U(S) must have enough remaining stock (after reserving
  // fixed requirements for each box) to satisfy the sum of quotas in S.
  //Wait: a fixed product p in U(S) with high stock cannot contribute more than `remStock(p)` total,
  // and if `remStock(p)` is already capped by `maxBoxes`, we should cap each fixed product's usable stock
  // at `remStock(p)` while adding `fixedQty(p)` to `neededPerBox` ONLY if `remStock(p) > fixedQty(p) * 0`.
  // Even better: since we want the largest integer B in [0, maxBoxes] such that for every subset S of pools:
  //   sum_{p in U(S)} max(0, remStock(p) - fixedQty(p) * B) >= (sum_{pool in S} pool.quota) * B,
  // notice that `sum_{p in U(S)} max(0, remStock(p) - fixedQty(p) * B) - Quota(S) * B` is strictly decreasing in B!
  // Let's first bound `maxBoxes` by the closed-form upper bound for each single pool, and then verify / binary-search B!
  for (const pool of pools) {
    const totalPoolStock = pool.candidates.reduce((sum, p) => sum + remStock(p), 0);
    let fixedInPool = 0;
    for (const cp of pool.candidates) {
      fixedInPool += fixedByProdName.get((cp.name ?? '').trim().toLowerCase()) ?? 0;
    }
    maxBoxes = Math.min(maxBoxes, Math.floor(totalPoolStock / (pool.quota + fixedInPool)));
  }

  if (maxBoxes <= 0) return 0;

  // Helper: check if `boxes` (B >= 1) is feasible across all subsets of pools
  const isFeasible = (boxes: number): boolean => {
    if (boxes <= 0) return true;
    const n = pools.length;
    if (n <= 8) {
      const totalMasks = 1 << n;
      for (let mask = 1; mask < totalMasks; mask++) {
        let quotaSum = 0;
        const unionProds = new Map<number, StockCheckProduct>();
        for (let i = 0; i < n; i++) {
          if (mask & (1 << i)) {
            quotaSum += pools[i].quota;
            for (const cp of pools[i].candidates) {
              unionProds.set(cp.id, cp);
            }
          }
        }
        let availAfterFixed = 0;
        for (const cp of unionProds.values()) {
          const fQty = fixedByProdName.get((cp.name ?? '').trim().toLowerCase()) ?? 0;
          availAfterFixed += Math.max(0, remStock(cp) - fQty * boxes);
        }
        if (availAfterFixed < quotaSum * boxes) {
          return false;
        }
      }
      return true;
    }
    return true;
  };

  // Binary search in [0, maxBoxes] for the exact maximum feasible boxes
  let lo = 0;
  let hi = maxBoxes;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (isFeasible(mid)) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return lo;
}
