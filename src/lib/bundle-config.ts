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
