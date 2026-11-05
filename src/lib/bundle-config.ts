export type BundleSlotType = 'CATEGORY' | 'PRODUCT';

export interface BundleSlotRule {
  id: string;
  type: BundleSlotType;
  categoryName?: string;
  quota?: number;
  productId?: number;
  productName?: string;
  quantity?: number;
}

export interface BundleConfig {
  slots: BundleSlotRule[];
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
      const parsed = JSON.parse(trimmed) as { slots?: unknown[] };
      if (Array.isArray(parsed.slots)) {
        const slots: BundleSlotRule[] = [];
        for (const s of parsed.slots) {
          const item = s as Partial<BundleSlotRule>;
          if (item.type === 'CATEGORY' && item.categoryName) {
            slots.push({
              id: item.id || Math.random().toString(36).substring(2, 9),
              type: 'CATEGORY',
              categoryName: String(item.categoryName).trim(),
              quota: Math.max(1, Number(item.quota) || 1),
            });
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
        return { slots };
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
  const validSlots = config.slots.filter((s) => {
    if (s.type === 'CATEGORY') return Boolean(s.categoryName && s.quota && s.quota > 0);
    if (s.type === 'PRODUCT') return Boolean(s.productName && s.quantity && s.quantity > 0);
    return false;
  });

  return JSON.stringify({ slots: validSlots });
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
 * the currently available physical stock of its component products/categories.
 */
export function getBundleMaxStock(
  bundleProd: StockCheckProduct,
  allProducts: StockCheckProduct[],
  cartDemand?: Map<number, number>
): number {
  if (!bundleProd.isBundle) return bundleProd.stock;
  const config = parseBundleConfig(bundleProd.availableVariants);
  if (!config.slots || config.slots.length === 0) return 0;

  const remStock = (p: StockCheckProduct) => Math.max(0, p.stock - (cartDemand?.get(p.id) ?? 0));

  const fixedByProdName = new Map<string, number>();
  const quotaByCatName = new Map<string, number>();

  for (const slot of config.slots) {
    if (slot.type === 'PRODUCT' && slot.productName) {
      const key = slot.productName.trim().toLowerCase();
      fixedByProdName.set(key, (fixedByProdName.get(key) ?? 0) + Math.max(1, slot.quantity || 1));
    } else if (slot.type === 'CATEGORY' && slot.categoryName) {
      const key = slot.categoryName.trim().toLowerCase();
      quotaByCatName.set(key, (quotaByCatName.get(key) ?? 0) + Math.max(1, slot.quota || 1));
    }
  }

  if (fixedByProdName.size === 0 && quotaByCatName.size === 0) return 0;

  let maxBoxes = Infinity;

  for (const [prodNameLower, reqQty] of fixedByProdName.entries()) {
    const prod = allProducts.find(
      (p) => !p.isBundle && p.name.trim().toLowerCase() === prodNameLower
    );
    if (!prod) return 0;
    const avail = remStock(prod);
    maxBoxes = Math.min(maxBoxes, Math.floor(avail / reqQty));
  }

  for (const [catNameLower, reqQuota] of quotaByCatName.entries()) {
    const catProds = allProducts.filter(
      (p) => !p.isBundle && p.type?.name?.trim().toLowerCase() === catNameLower
    );
    if (catProds.length === 0) return 0;
    const totalCatStock = catProds.reduce((sum, p) => sum + remStock(p), 0);

    let fixedInThisCat = 0;
    for (const cp of catProds) {
      fixedInThisCat += fixedByProdName.get(cp.name.trim().toLowerCase()) ?? 0;
    }

    const totalCatNeededPerBox = reqQuota + fixedInThisCat;
    maxBoxes = Math.min(maxBoxes, Math.floor(totalCatStock / totalCatNeededPerBox));
  }

  return maxBoxes === Infinity ? 0 : Math.max(0, maxBoxes);
}
