import { prisma } from '@/lib/prisma';
import { UserError, cleanStr, cleanText, parseInteger, requireInteger } from '@/lib/validation';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';

// ============================ STOCK ============================

export const STOCK_TYPES = ['IN', 'OUT', 'RESET'] as const;
export type StockType = (typeof STOCK_TYPES)[number];

export interface AdjustStockInput {
  productId: number;
  variantOptionId?: number | null;
  type: string;
  quantity: unknown;
  giver: string;
  receiver: string;
  notes: string;
}

/** Manual stock adjustment. Stock and inventory log are updated atomically; stock can never become negative. */
export async function adjustStockService(input: AdjustStockInput) {
  if (!(STOCK_TYPES as readonly string[]).includes(input.type)) throw new UserError('Invalid stock adjustment type.');
  const type = input.type as StockType;
  const quantity =
    type === 'RESET'
      ? requireInteger(input.quantity as string | number, 'Stock quantity', { min: 0, max: 1_000_000 })
      : requireInteger(input.quantity as string | number, 'Quantity', { min: 1, max: 1_000_000 });

  const giver = cleanStr(input.giver, 80);
  const receiver = cleanStr(input.receiver, 80);
  const notes = cleanStr(input.notes, 200);
  if (type === 'IN' && !giver) throw new UserError('Sender/supplier is required for stock in.');
  if (type === 'OUT' && !receiver) throw new UserError('Receiver is required for stock out.');

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, isActive: true },
      select: { id: true, name: true, stock: true },
    });
    if (!product) throw new UserError('Product not found.');

    let variantName = '';

    if (input.variantOptionId) {
      const variant = await tx.productVariantOption.findFirst({
        where: { id: input.variantOptionId, productId: product.id, isActive: true },
      });
      if (!variant) throw new UserError('Flavor variant not found.');
      variantName = variant.name;

      if (type === 'IN') {
        await tx.productVariantOption.update({
          where: { id: variant.id },
          data: { stock: { increment: quantity } },
        });
      } else if (type === 'OUT') {
        const r = await tx.productVariantOption.updateMany({
          where: { id: variant.id, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (r.count === 0) throw new UserError(`Insufficient tray stock for "${variant.name}". Only ${variant.stock} remaining.`);
      } else {
        await tx.productVariantOption.update({
          where: { id: variant.id },
          data: { stock: quantity },
        });
      }

      // Re-synchronize product total stock with sum of its variant tray stocks
      const allVars = await tx.productVariantOption.findMany({
        where: { productId: product.id, isActive: true },
        select: { stock: true },
      });
      const newTotalStock = allVars.reduce((sum, v) => sum + v.stock, 0);
      await tx.product.update({
        where: { id: product.id },
        data: { stock: newTotalStock },
      });
    } else {
      const activeVariantsCount = await tx.productVariantOption.count({
        where: { productId: product.id, isActive: true },
      });
      if (activeVariantsCount > 0) {
        throw new UserError(
          `Product "${product.name}" tracks stock per flavor tray. Please select a specific flavor variant to adjust stock.`
        );
      }

      if (type === 'IN') {
        await tx.productVariantOption.count({}); // noop
        await tx.product.update({ where: { id: product.id }, data: { stock: { increment: quantity } } });
      } else if (type === 'OUT') {
        const r = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (r.count === 0) throw new UserError(`Insufficient stock. Only ${product.stock} remaining.`);
      } else {
        await tx.product.update({ where: { id: product.id }, data: { stock: quantity } });
      }
    }

    const logPrefix = variantName ? `[Flavor: ${variantName}] ` : '';
    let logNotes = notes ? `${logPrefix}${notes}` : logPrefix ? logPrefix.trim() : null;
    if (type === 'RESET') {
      logNotes = `${logPrefix}Stock Opname reset${notes ? ` • ${notes}` : ''}`;
    }

    await tx.inventoryLog.create({
      data: {
        productId: product.id,
        type,
        quantity,
        giver: giver || null,
        receiver: receiver || null,
        notes: logNotes,
      },
    });
  });
}

export { LOW_STOCK_THRESHOLD };

// ============================ PRODUCTS ============================

export interface ProductVariantRow {
  id?: number;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  bundleUpcharge: number;
  priority?: number;
  isActive?: boolean;
}

export interface ProductInput {
  name: string;
  type: string;
  variant: string;
  description: string;
  costPrice: number;
  price: number;
  discountPrice: number | null;
  stock?: number;
  availableVariants?: string | null;
  isBundle?: boolean;
  bundleQuota?: number | null;
  variantOptions?: ProductVariantRow[];
}

/** Server-side product form validation. */
export function parseProductForm(fd: FormData): ProductInput {
  const name = cleanStr(fd.get('name'), 100);
  if (!name) throw new UserError('Product name is required.');

  const costPrice = requireInteger(fd.get('costPrice') as string, 'Cost price', { min: 0, max: 2_000_000_000 });
  const price = requireInteger(fd.get('price') as string, 'Selling price', { min: 1, max: 2_000_000_000 });
  if (costPrice >= price) throw new UserError('Selling price must be greater than cost price.');

  let discountPrice: number | null = null;
  const discPercentRaw = fd.get('discountPercent');
  if (typeof discPercentRaw === 'string' && discPercentRaw.trim() !== '') {
    const percent = parseInteger(discPercentRaw, { min: 1, max: 99 });
    if (percent !== null && percent > 0) {
      discountPrice = Math.round(price * (1 - percent / 100));
    }
  } else {
    const discRaw = fd.get('discountPrice');
    if (typeof discRaw === 'string' && discRaw.trim() !== '') {
      discountPrice = requireInteger(discRaw, 'Discount price', { min: 1, max: 2_000_000_000 });
      if (discountPrice >= price) throw new UserError('Discount price must be less than regular selling price.');
    }
  }

  const stockRaw = fd.get('stock');
  const stock = stockRaw !== null && stockRaw !== undefined && String(stockRaw).trim() !== ''
    ? parseInteger(String(stockRaw), { min: 0, max: 1_000_000 }) ?? undefined
    : undefined;

  let variantOptions: ProductVariantRow[] | undefined;
  const variantsJsonRaw = fd.get('variants_json');
  if (typeof variantsJsonRaw === 'string' && variantsJsonRaw.trim() !== '') {
    try {
      const parsed = JSON.parse(variantsJsonRaw);
      if (Array.isArray(parsed)) {
        variantOptions = parsed
          .filter((v: unknown) => v && typeof (v as { name?: unknown }).name === 'string' && ((v as { name: string }).name).trim().length > 0)
          .map((item: unknown, index: number) => {
            const v = item as {
              id?: unknown;
              name: string;
              price: unknown;
              costPrice?: unknown;
              stock?: unknown;
              bundleUpcharge?: unknown;
              priority?: unknown;
              isActive?: unknown;
            };
            return {
              id: typeof v.id === 'number' && v.id > 0 ? v.id : undefined,
              name: cleanStr(v.name, 100),
              price: requireInteger(v.price as string | number, `Variant "${v.name}" price`, { min: 1, max: 2_000_000_000 }),
              costPrice: requireInteger((v.costPrice ?? 0) as string | number, `Variant "${v.name}" cost price`, { min: 0, max: 2_000_000_000 }),
              stock: requireInteger((v.stock ?? 0) as string | number, `Variant "${v.name}" stock`, { min: 0, max: 1_000_000 }),
              bundleUpcharge: requireInteger((v.bundleUpcharge ?? 0) as string | number, `Variant "${v.name}" bundle upcharge`, { min: 0, max: 2_000_000_000 }),
              priority: typeof v.priority === 'number' ? v.priority : index + 1,
              isActive: v.isActive !== false,
            };
          });
      }
    } catch (e) {
      if (e instanceof UserError) throw e;
      throw new UserError('Invalid variant data format.');
    }
  }

  let availableVariants = cleanStr(fd.get('availableVariants'), 500) || null;
  if (!availableVariants && variantOptions && variantOptions.length > 0) {
    availableVariants = variantOptions.map((v) => v.name).join(', ');
  }

  const isBundle = fd.get('isBundle') === 'true' || fd.get('isBundle') === 'on';
  const bundleQuota = isBundle
    ? requireInteger(fd.get('bundleQuota') as string, 'Bundle quota', { min: 2, max: 50 })
    : null;

  return {
    name,
    type: cleanStr(fd.get('type'), 50),
    variant: cleanStr(fd.get('variant'), 50),
    description: cleanText(fd.get('description'), 500),
    costPrice,
    price,
    discountPrice,
    stock,
    availableVariants,
    isBundle,
    bundleQuota,
    variantOptions,
  };
}

export async function createProductService(input: ProductInput, imageUrls: string[]) {
  const maxPriority = await prisma.product.aggregate({
    where: { isActive: true },
    _max: { priority: true },
  });
  const nextPriority = (maxPriority._max.priority ?? 0) + 1;

  const initialStock = input.variantOptions && input.variantOptions.length > 0
    ? input.variantOptions.reduce((sum, v) => sum + (v.stock || 0), 0)
    : (input.stock ?? 0);

  return prisma.product.create({
    data: {
      name: input.name,
      type: input.type ? { connectOrCreate: { where: { name: input.type }, create: { name: input.type } } } : undefined,
      variant: input.variant ? { connectOrCreate: { where: { name: input.variant }, create: { name: input.variant } } } : undefined,
      description: input.description || null,
      costPrice: input.costPrice,
      price: input.price,
      discountPrice: input.discountPrice,
      availableVariants: input.availableVariants,
      isBundle: input.isBundle ?? false,
      bundleQuota: input.bundleQuota,
      stock: initialStock,
      priority: nextPriority,
      images: { create: imageUrls.map((url) => ({ url })) },
      variants: input.variantOptions && input.variantOptions.length > 0
        ? {
            create: input.variantOptions.map((v, i) => ({
              name: v.name,
              price: v.price,
              costPrice: v.costPrice,
              stock: v.stock,
              bundleUpcharge: v.bundleUpcharge,
              priority: v.priority ?? i + 1,
              isActive: v.isActive ?? true,
            })),
          }
        : undefined,
    },
    include: {
      variants: true,
      images: true,
    },
  });
}

export async function updateProductService(id: number, input: ProductInput, imageUrls: string[]) {
  return prisma.$transaction(async (tx) => {
    if (input.variantOptions) {
      const incomingIds = input.variantOptions
        .map((v) => v.id)
        .filter((vid): vid is number => typeof vid === 'number');

      // Remove variants that are no longer in the list
      await tx.productVariantOption.deleteMany({
        where: {
          productId: id,
          id: { notIn: incomingIds },
        },
      });

      for (let i = 0; i < input.variantOptions.length; i++) {
        const v = input.variantOptions[i];
        if (v.id) {
          await tx.productVariantOption.update({
            where: { id: v.id },
            data: {
              name: v.name,
              price: v.price,
              costPrice: v.costPrice,
              stock: v.stock,
              bundleUpcharge: v.bundleUpcharge,
              priority: v.priority ?? i + 1,
              isActive: v.isActive ?? true,
            },
          });
        } else {
          await tx.productVariantOption.create({
            data: {
              productId: id,
              name: v.name,
              price: v.price,
              costPrice: v.costPrice,
              stock: v.stock,
              bundleUpcharge: v.bundleUpcharge,
              priority: v.priority ?? i + 1,
              isActive: v.isActive ?? true,
            },
          });
        }
      }

      // Synchronize product stock with sum of variant stocks
      const totalVariantStock = input.variantOptions.reduce((sum, v) => sum + (v.stock || 0), 0);
      await tx.product.update({
        where: { id },
        data: { stock: totalVariantStock },
      });
    }

    return tx.product.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type ? { connectOrCreate: { where: { name: input.type }, create: { name: input.type } } } : { disconnect: true },
        variant: input.variant ? { connectOrCreate: { where: { name: input.variant }, create: { name: input.variant } } } : { disconnect: true },
        description: input.description || null,
        costPrice: input.costPrice,
        price: input.price,
        discountPrice: input.discountPrice,
        availableVariants: input.availableVariants,
        isBundle: input.isBundle ?? false,
        bundleQuota: input.bundleQuota,
        ...(typeof input.stock === 'number' && (!input.variantOptions || input.variantOptions.length === 0)
          ? { stock: input.stock }
          : {}),
        ...(imageUrls.length > 0 ? { images: { create: imageUrls.map((url) => ({ url })) } } : {}),
      },
      include: {
        variants: true,
        images: true,
      },
    });
  });
}

/** Soft-delete (archive) a product so historical transactions and stock logs remain intact. */
export async function archiveProductService(id: number) {
  const r = await prisma.product.updateMany({ where: { id, isActive: true }, data: { isActive: false, isBestSeller: false, isFavorite: false } });
  if (r.count === 0) throw new UserError('Product not found.');
}

/** Remove a single product image from the database and return its URL for cleanup. */
export async function removeProductImageService(productId: number, imageId: number): Promise<string> {
  const img = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
  if (!img) throw new UserError('Image not found.');
  await prisma.productImage.delete({ where: { id: img.id } });
  return img.url;
}

/**
 * Persist drag-and-drop priority order. The reordered page subset is placed back
 * into its corresponding global slots and normalized across all active products.
 */
export async function reorderPrioritiesService(orderedIds: unknown) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0 || orderedIds.length > 500) {
    throw new UserError('Invalid order sequence data.');
  }
  const ids = orderedIds.map((i) => parseInteger(i as number | string, { min: 1 }));
  if (ids.some((i) => i === null) || new Set(ids).size !== ids.length) throw new UserError('Invalid order sequence data.');
  const wanted = ids as number[];

  return prisma.$transaction(async (tx) => {
    const all = await tx.product.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, priority: true },
    });
    const wantedSet = new Set(wanted);
    const positions: number[] = [];
    all.forEach((p, idx) => {
      if (wantedSet.has(p.id)) positions.push(idx);
    });
    if (positions.length !== wanted.length) throw new UserError('Product list has changed. Please refresh the page.');

    const order = all.map((p) => p.id);
    positions.forEach((pos, k) => {
      order[pos] = wanted[k];
    });

    const current = new Map(all.map((p) => [p.id, p.priority]));
    const total = order.length;
    const updates: Promise<unknown>[] = [];
    for (let idx = 0; idx < total; idx++) {
      const priority = total - idx;
      if (current.get(order[idx]) !== priority) {
        updates.push(tx.product.update({ where: { id: order[idx] }, data: { priority } }));
      }
    }
    if (updates.length > 0) {
      await Promise.all(updates);
    }
  });
}
