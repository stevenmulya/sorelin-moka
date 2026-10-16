import { prisma } from '@/lib/prisma';
import { UserError, cleanStr, cleanText, parseInteger, requireInteger } from '@/lib/validation';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';

// ============================ STOCK ============================

export const STOCK_TYPES = ['IN', 'OUT', 'RESET'] as const;
export type StockType = (typeof STOCK_TYPES)[number];

export interface AdjustStockInput {
  productId: number;
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
    const product = await tx.product.findFirst({ where: { id: input.productId, isActive: true }, select: { id: true, stock: true } });
    if (!product) throw new UserError('Product not found.');

    let logNotes = notes || null;
    if (type === 'IN') {
      await tx.product.update({ where: { id: product.id }, data: { stock: { increment: quantity } } });
    } else if (type === 'OUT') {
      const r = await tx.product.updateMany({
        where: { id: product.id, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (r.count === 0) throw new UserError(`Insufficient stock. Only ${product.stock} remaining.`);
    } else {
      await tx.product.update({ where: { id: product.id }, data: { stock: quantity } });
      logNotes = `Previous stock: ${product.stock}${notes ? ` • ${notes}` : ''}`;
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

export interface ProductInput {
  name: string;
  type: string;
  variant: string;
  description: string;
  costPrice: number;
  price: number;
  discountPrice: number | null;
}

/** Server-side product form validation. */
export function parseProductForm(fd: FormData): ProductInput {
  const name = cleanStr(fd.get('name'), 100);
  if (!name) throw new UserError('Product name is required.');

  const costPrice = requireInteger(fd.get('costPrice') as string, 'Cost price', { min: 0, max: 2_000_000_000 });
  const price = requireInteger(fd.get('price') as string, 'Selling price', { min: 1, max: 2_000_000_000 });
  if (costPrice >= price) throw new UserError('Selling price must be greater than cost price.');

  let discountPrice: number | null = null;
  const discRaw = fd.get('discountPrice');
  if (typeof discRaw === 'string' && discRaw.trim() !== '') {
    discountPrice = requireInteger(discRaw, 'Discount price', { min: 1, max: 2_000_000_000 });
    if (discountPrice >= price) throw new UserError('Discount price must be less than regular selling price.');
    if (discountPrice <= costPrice) throw new UserError('Discount price cannot be less than or equal to cost price.');
  }

  return {
    name,
    type: cleanStr(fd.get('type'), 50),
    variant: cleanStr(fd.get('variant'), 50),
    description: cleanText(fd.get('description'), 500),
    costPrice,
    price,
    discountPrice,
  };
}

export async function createProductService(input: ProductInput, imageUrls: string[]) {
  return prisma.product.create({
    data: {
      name: input.name,
      type: input.type ? { connectOrCreate: { where: { name: input.type }, create: { name: input.type } } } : undefined,
      variant: input.variant ? { connectOrCreate: { where: { name: input.variant }, create: { name: input.variant } } } : undefined,
      description: input.description || null,
      costPrice: input.costPrice,
      price: input.price,
      discountPrice: input.discountPrice,
      stock: 0,
      images: { create: imageUrls.map((url) => ({ url })) },
    },
  });
}

export async function updateProductService(id: number, input: ProductInput, imageUrls: string[]) {
  return prisma.product.update({
    where: { id },
    data: {
      name: input.name,
      type: input.type ? { connectOrCreate: { where: { name: input.type }, create: { name: input.type } } } : { disconnect: true },
      variant: input.variant ? { connectOrCreate: { where: { name: input.variant }, create: { name: input.variant } } } : { disconnect: true },
      description: input.description || null,
      costPrice: input.costPrice,
      price: input.price,
      discountPrice: input.discountPrice,
      ...(imageUrls.length > 0 ? { images: { create: imageUrls.map((url) => ({ url })) } } : {}),
    },
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
