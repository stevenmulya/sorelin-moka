import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { KANBAN_STATUSES, PAID_STATUSES, PAYMENT_METHODS, STATUS, type PaymentMethod } from '@/lib/constants';
import { UserError, cleanStr, isEmail, parseInteger, requireInteger } from '@/lib/validation';
import { effectivePrice, formatRupiah } from '@/lib/utils';
import { summarizeShift } from '@/lib/services/shifts';
import { parseBundleConfig } from '@/lib/bundle-config';

export type Db = Prisma.TransactionClient;

export interface OrderLine {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  costPrice: number;
  variantOptionId?: number | null;
  selectedVariant?: string | null;
  isBundle?: boolean;
  bundleContents?: string | null;
  notes?: string | null;
}

const MAX_LINES = 100;
const MAX_QTY = 999;

/**
 * Parse bundle flavor details from bundleContents string (e.g. "2x Garlic Butter, 1x Truffle Ham & Cheese (+Rp 3.000)").
 */
export function parseBundleFlavors(contents?: string | null): Array<{ flavorName: string; quantity: number }> {
  if (!contents) return [];
  const merged = new Map<string, { flavorName: string; quantity: number }>();
  const clean = contents
    .replace(/\(\+[^)]+\)/g, '')
    .replace(/\(include\)/gi, '')
    .replace(/\(termasuk\)/gi, '')
    .trim();
  const parts = clean.split(/[,+]|(?:\s*\+\s*)/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    let qty = 1;
    let name = '';
    const prefixMatch = part.match(/^\(?(\d+)\s*x\)?\s*(.+)$/i);
    if (prefixMatch) {
      qty = Math.max(1, parseInt(prefixMatch[1], 10));
      name = prefixMatch[2].replace(/[()]/g, '').trim();
    } else {
      const suffixMatch = part.match(/^(.+?)\s*\(?(\d+)\s*x\)?$/i);
      if (suffixMatch) {
        qty = Math.max(1, parseInt(suffixMatch[2], 10));
        name = suffixMatch[1].replace(/[()]/g, '').trim();
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
      merged.set(key, { flavorName: name, quantity: qty });
    }
  }
  return Array.from(merged.values());
}

/**
 * Build validated order line items from client input.
 * Accepts productId, quantity, variantOptionId, selectedVariant, isBundle, bundleContents, and notes.
 * Product name, effective prices, variant upcharges, cost prices, and totals are resolved directly from the database.
 */
export async function buildOrder(
  rawItems: unknown,
  db: Db | typeof prisma = prisma,
): Promise<{ lines: OrderLine[]; total: number }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new UserError('Cart is empty.');
  if (rawItems.length > MAX_LINES) throw new UserError('Too many items in a single order.');

  interface ParsedRawItem {
    productId: number;
    quantity: number;
    variantOptionId: number | null;
    selectedVariant: string | null;
    isBundle: boolean;
    bundleContents: string | null;
    notes: string | null;
  }

  const parsedItems: ParsedRawItem[] = [];
  const totalQtyPerProduct = new Map<number, number>();

  for (const raw of rawItems) {
    const r = (raw ?? {}) as {
      productId?: unknown;
      quantity?: unknown;
      variantOptionId?: unknown;
      selectedVariant?: unknown;
      isBundle?: unknown;
      bundleContents?: unknown;
      notes?: unknown;
    };
    const productId = parseInteger(r.productId as number | string, { min: 1 });
    const quantity = parseInteger(r.quantity as number | string, { min: 1, max: MAX_QTY });
    if (productId === null || quantity === null) throw new UserError('Invalid order item data.');

    const variantOptionId = parseInteger(r.variantOptionId as number | string, { min: 1 });
    const selectedVariant = cleanStr(r.selectedVariant as string, 80) || null;
    const isBundle = Boolean(r.isBundle);
    const bundleContents = cleanStr(r.bundleContents as string, 1000) || null;
    const notes = cleanStr(r.notes as string, 200) || null;

    parsedItems.push({ productId, quantity, variantOptionId, selectedVariant, isBundle, bundleContents, notes });
    totalQtyPerProduct.set(productId, (totalQtyPerProduct.get(productId) ?? 0) + quantity);
  }

  const productIds = [...totalQtyPerProduct.keys()];
  const [products, allVariants, allActiveProducts] = await Promise.all([
    db.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { variants: true, type: true },
    }),
    db.productVariantOption.findMany({
      where: { isActive: true },
    }),
    db.product.findMany({
      where: { isActive: true },
      include: { type: true },
    }),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(allVariants.map((v) => [v.id, v]));
  const variantByName = new Map(allVariants.map((v) => [v.name.toLowerCase().trim(), v]));
  const productByName = new Map(
    allActiveProducts.filter((p) => !p.isBundle).map((p) => [p.name.toLowerCase().trim(), p])
  );

  // Compute minimum effective price per product category (excluding bundles)
  const minPriceByCategory = new Map<string, number>();
  for (const ap of allActiveProducts) {
    if (ap.isBundle || !ap.type?.name) continue;
    const catName = ap.type.name.trim().toLowerCase();
    const eff = effectivePrice(ap);
    const currMin = minPriceByCategory.get(catName);
    if (currMin === undefined || eff < currMin) {
      minPriceByCategory.set(catName, eff);
    }
  }

  // Track variant physical stock demand across single items and bundles
  const variantStockDemanded = new Map<number, number>();
  // Track standalone product physical stock demand across bundle items
  const productStockDemanded = new Map<number, number>();

  const lines: OrderLine[] = [];
  let total = 0;

  for (const item of parsedItems) {
    const p = productById.get(item.productId);
    if (!p) throw new UserError('Some products are no longer available. Please reload the page and try again.');

    let linePrice: number;
    let lineCostPrice: number;
    let finalVariantOptionId: number | null = null;
    let finalSelectedVariant: string | null = item.selectedVariant;

    const isBundleItem = Boolean(p.isBundle);

    if (isBundleItem) {
      // Dynamic bundle box pricing: Base Box Price + Sum of Category Tier / Flavor Upcharges
      const basePrice = effectivePrice(p);
      let upchargePerBox = 0;
      let bundleCogsPerBox = 0;

      const bundleConfig = parseBundleConfig(p.availableVariants);
      const fixedProductQtyMap = new Map<string, number>();
      let expectedSlotPieces = 0;
      for (const slot of bundleConfig.slots) {
        if (slot.type === 'PRODUCT' && slot.productName) {
          const qty = Math.max(1, slot.quantity || 1);
          const key = slot.productName.trim().toLowerCase();
          fixedProductQtyMap.set(key, (fixedProductQtyMap.get(key) ?? 0) + qty);
          expectedSlotPieces += qty;
        } else if (slot.type === 'CATEGORY') {
          expectedSlotPieces += Math.max(1, slot.quota || 1);
        }
      }

      const flavors = parseBundleFlavors(item.bundleContents);
      if (flavors.length === 0) {
        throw new UserError(`Please select bundle items for "${p.name}".`);
      }

      const totalSelectedPieces = flavors.reduce((sum, f) => sum + f.quantity, 0);
      const requiredQuota = expectedSlotPieces > 0 ? expectedSlotPieces : (p.bundleQuota || 0);
      if (requiredQuota > 0 && totalSelectedPieces !== requiredQuota) {
        throw new UserError(
          `Bundle "${p.name}" requires exactly ${requiredQuota} items (selected ${totalSelectedPieces}).`
        );
      }

      for (const [fixedKey, requiredFixedQty] of fixedProductQtyMap.entries()) {
        const selectedFixed = flavors.find((f) => f.flavorName.trim().toLowerCase() === fixedKey);
        if (!selectedFixed || selectedFixed.quantity < requiredFixedQty) {
          throw new UserError(`Bundle "${p.name}" is missing required fixed item "${fixedKey}".`);
        }
      }

      for (const f of flavors) {
        const cleanName = f.flavorName.toLowerCase().trim();
        const matchingProd = productByName.get(cleanName);
        if (matchingProd && !matchingProd.isBundle) {
          const fixedQty = fixedProductQtyMap.get(cleanName) ?? 0;
          const categorySelectedQty = Math.max(0, f.quantity - fixedQty);
          const catName = matchingProd.type?.name?.trim().toLowerCase();
          const minCatPrice = catName ? (minPriceByCategory.get(catName) ?? effectivePrice(matchingProd)) : effectivePrice(matchingProd);
          const delta = Math.max(0, effectivePrice(matchingProd) - minCatPrice);
          upchargePerBox += delta * categorySelectedQty;
          bundleCogsPerBox += (matchingProd.costPrice || 0) * f.quantity;
          productStockDemanded.set(
            matchingProd.id,
            (productStockDemanded.get(matchingProd.id) ?? 0) + f.quantity * item.quantity
          );
        } else {
          const vo = variantByName.get(cleanName);
          if (vo) {
            upchargePerBox += (vo.bundleUpcharge || 0) * f.quantity;
            bundleCogsPerBox += (vo.costPrice || 0) * f.quantity;
            variantStockDemanded.set(vo.id, (variantStockDemanded.get(vo.id) ?? 0) + f.quantity * item.quantity);
          } else {
            throw new UserError(`Bundle item "${f.flavorName}" is no longer available in the catalog.`);
          }
        }
      }

      linePrice = basePrice + upchargePerBox;
      lineCostPrice = bundleCogsPerBox > 0 ? bundleCogsPerBox : p.costPrice;
    } else {
      // Single Item Flavor / Variant Pricing
      let vo = item.variantOptionId ? variantById.get(item.variantOptionId) : null;
      if (!vo && item.selectedVariant) {
        vo = p.variants?.find((v) => v.name.toLowerCase() === item.selectedVariant?.toLowerCase()) || null;
      }

      if (vo) {
        linePrice = vo.price;
        lineCostPrice = vo.costPrice;
        finalSelectedVariant = vo.name;
        finalVariantOptionId = vo.id;
        variantStockDemanded.set(vo.id, (variantStockDemanded.get(vo.id) ?? 0) + item.quantity);
      } else {
        linePrice = effectivePrice(p);
        lineCostPrice = p.costPrice;
      }
    }

    lines.push({
      productId: item.productId,
      productName: p.name,
      quantity: item.quantity,
      price: linePrice,
      costPrice: lineCostPrice,
      variantOptionId: finalVariantOptionId,
      selectedVariant: finalSelectedVariant,
      isBundle: isBundleItem,
      bundleContents: isBundleItem ? item.bundleContents : null,
      notes: item.notes,
    });
    total += linePrice * item.quantity;
  }

  // 1. Stock verification for standard products (including demand from bundle slots)
  for (const [productId, totalWanted] of totalQtyPerProduct) {
    const p = productById.get(productId)!;
    if ((!p.variants || p.variants.length === 0) && !p.isBundle) {
      const inBundleDemand = productStockDemanded.get(productId) || 0;
      const combinedDemand = totalWanted + inBundleDemand;
      if (combinedDemand > p.stock) {
        throw new UserError(
          p.stock <= 0
            ? `"${p.name}" is currently out of stock.`
            : `"${p.name}" only has ${p.stock} items remaining.`
        );
      }
    }
  }

  // Check products demanded via bundles that weren't in direct cart items
  for (const [prodId, inBundleDemand] of productStockDemanded) {
    if (!totalQtyPerProduct.has(prodId)) {
      const prod = productById.get(prodId) || allActiveProducts.find((p) => p.id === prodId);
      if (prod && !prod.isBundle && inBundleDemand > prod.stock) {
        throw new UserError(
          prod.stock <= 0
            ? `"${prod.name}" is currently out of stock.`
            : `"${prod.name}" only has ${prod.stock} items remaining in stock.`
        );
      }
    }
  }

  // 2. Strict stock verification for flavor variants (prevents overselling & negative stock)
  for (const [varId, wantedQty] of variantStockDemanded) {
    const vo = variantById.get(varId);
    if (vo && wantedQty > vo.stock) {
      throw new UserError(
        vo.stock <= 0
          ? `Flavor "${vo.name}" is currently out of stock.`
          : `Flavor "${vo.name}" only has ${vo.stock} items remaining in stock.`
      );
    }
  }

  return { lines, total };
}

async function getOpenShift(db: Db) {
  return db.shift.findFirst({ where: { status: 'Open' }, orderBy: { startTime: 'desc' } });
}

const PHONE_RE = /^[0-9+()\-\s]{6,20}$/;

export interface CreateOrderInput {
  customer: string;
  email?: string;
  phone?: string;
  items: unknown;
  selfieUrl?: string | null;
}

/** Create a "Waiting Payment" order in the currently open shift. */
export async function createOrder(input: CreateOrderInput) {
  const customer = cleanStr(input.customer, 60);
  if (!customer) throw new UserError('Customer name is required.');

  const email = cleanStr(input.email, 120);
  if (email && !isEmail(email)) throw new UserError('Invalid email format.');

  const phone = cleanStr(input.phone, 20);
  if (phone && !PHONE_RE.test(phone)) throw new UserError('Invalid phone number format.');

  return prisma.$transaction(async (tx) => {
    const shift = await getOpenShift(tx);
    if (!shift) throw new UserError('Store is currently closed (no active cashier shift).');

    const { lines, total } = await buildOrder(input.items, tx);

    return tx.transaction.create({
      data: {
        shiftId: shift.id,
        customer,
        customerEmail: email || null,
        customerPhone: phone || null,
        amount: total,
        status: STATUS.WAITING,
        selfieUrl: input.selfieUrl ?? null,
        items: { create: lines },
      },
    });
  }, { maxWait: 15000, timeout: 30000 });
}

function resolvePayment(method: string, paidRaw: unknown, amount: number): { method: PaymentMethod; paid: number } {
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) throw new UserError('Invalid payment method.');
  const m = method as PaymentMethod;
  if (m !== 'Cash') {
    // Non-cash payments always match the exact order amount
    return { method: m, paid: amount };
  }
  const paid = requireInteger(paidRaw as string | number, 'Payment amount', { min: amount, max: 2_000_000_000 });
  return { method: m, paid };
}

export interface ApproveInput {
  transactionId: number;
  cashierName: string;
  paymentMethod: string;
  paidAmount: unknown;
}

/**
 * Approve payment atomically: lock status, deduct stock, and record inventory logs
 * within a single database transaction.
 */
export async function approvePaymentService(input: ApproveInput) {
  const cashierName = cleanStr(input.cashierName, 60);
  if (!cashierName) throw new UserError('Cashier name is required.');

  return prisma.$transaction(async (tx) => {
    const shift = await getOpenShift(tx);
    if (!shift) throw new UserError('No active shift. Please open a shift first.');

    const trx = await tx.transaction.findUnique({ where: { id: input.transactionId }, include: { items: true } });
    if (!trx) throw new UserError('Transaction not found.');
    if (trx.status !== STATUS.WAITING) throw new UserError('This transaction has already been processed.');
    if (trx.shiftId !== shift.id) throw new UserError('This transaction belongs to another shift and cannot be processed.');

    const { method, paid } = resolvePayment(input.paymentMethod, input.paidAmount, trx.amount);

    // Atomic lock: only one request can transition Waiting Payment -> Preparing
    const lock = await tx.transaction.updateMany({
      where: { id: trx.id, status: STATUS.WAITING },
      data: {
        status: STATUS.PREPARING,
        preparedAt: new Date(),
        cashierName,
        paidAmount: paid,
        paymentMethod: method,
      },
    });
    if (lock.count === 0) throw new UserError('This transaction has already been processed.');

    const productIds = trx.items.map((i) => i.productId).filter((id): id is number => id !== null);
    const [existingProducts, allVariants, allNonBundleProducts] = await Promise.all([
      productIds.length > 0
        ? tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, isBundle: true } })
        : [],
      tx.productVariantOption.findMany(),
      tx.product.findMany({ where: { isBundle: false }, orderBy: { isActive: 'asc' } }),
    ]);
    const productById = new Map(existingProducts.map((p) => [p.id, p]));
    const variantByName = new Map(allVariants.map((v) => [v.name.trim().toLowerCase(), v]));
    const variantById = new Map(allVariants.map((v) => [v.id, v]));
    const productByName = new Map(allNonBundleProducts.map((p) => [p.name.trim().toLowerCase(), p]));

    // Aggregate deductions in memory to execute in parallel batches instead of sequential N+1 loops
    const productDeductions = new Map<number, number>();
    const variantDeductions = new Map<number, number>();
    const affectedVariantProductIds = new Set<number>();
    const inventoryLogs: Prisma.InventoryLogCreateManyInput[] = [];

    for (const item of trx.items) {
      if (!item.productId) continue;
      const p = productById.get(item.productId);
      if (!p) continue;

      // 1. Deduct standard product stock
      if (!p.isBundle) {
        productDeductions.set(p.id, (productDeductions.get(p.id) || 0) + item.quantity);
      }

      // 2. Track single variant flavor stock
      if (item.variantOptionId) {
        variantDeductions.set(item.variantOptionId, (variantDeductions.get(item.variantOptionId) || 0) + item.quantity);
        const vo = variantById.get(item.variantOptionId);
        if (vo) affectedVariantProductIds.add(vo.productId);
      }

      // 3. Track bundle component flavor stocks
      if (item.isBundle && item.bundleContents) {
        const bundleFlavors = parseBundleFlavors(item.bundleContents);
        for (const bf of bundleFlavors) {
          const neededQty = bf.quantity * item.quantity;
          const cleanName = bf.flavorName.trim().toLowerCase();
          const matchingProd = productByName.get(cleanName);
          if (matchingProd && !matchingProd.isBundle) {
            productDeductions.set(matchingProd.id, (productDeductions.get(matchingProd.id) || 0) + neededQty);
            inventoryLogs.push({
              productId: matchingProd.id,
              type: 'OUT',
              quantity: neededQty,
              giver: null,
              receiver: trx.customer,
              notes: `Bundle [${p.name}] item: ${matchingProd.name} (TRX-${trx.id})`,
            });
          } else {
            const matchingVar = variantByName.get(cleanName);
            if (matchingVar) {
              variantDeductions.set(matchingVar.id, (variantDeductions.get(matchingVar.id) || 0) + neededQty);
              affectedVariantProductIds.add(matchingVar.productId);
              inventoryLogs.push({
                productId: matchingVar.productId,
                type: 'OUT',
                quantity: neededQty,
                giver: null,
                receiver: trx.customer,
                notes: `Bundle [${p.name}] flavor: ${matchingVar.name} (TRX-${trx.id})`,
              });
            }
          }
        }
      }

      if (!p.isBundle) {
        inventoryLogs.push({
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          giver: null,
          receiver: trx.customer,
          notes: item.selectedVariant
            ? `Sales: TRX-${trx.id} (${item.selectedVariant})`
            : `Sales: TRX-${trx.id}`,
        });
      }
    }

    // Execute stock decrements with atomic non-negative stock guards
    for (const [prodId, qty] of productDeductions.entries()) {
      const updated = await tx.product.updateMany({
        where: { id: prodId, stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      });
      if (updated.count === 0) {
        const currentProd = await tx.product.findUnique({ where: { id: prodId }, select: { name: true, stock: true } });
        throw new UserError(
          `Insufficient stock for "${currentProd?.name ?? 'Product'}". Required: ${qty}, Available: ${currentProd?.stock ?? 0}.`
        );
      }
    }

    for (const [varId, qty] of variantDeductions.entries()) {
      const updated = await tx.productVariantOption.updateMany({
        where: { id: varId, stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      });
      if (updated.count === 0) {
        const currentVar = await tx.productVariantOption.findUnique({ where: { id: varId }, select: { name: true, stock: true } });
        throw new UserError(
          `Insufficient tray stock for "${currentVar?.name ?? 'Variant'}". Required: ${qty}, Available: ${currentVar?.stock ?? 0}.`
        );
      }
    }

    if (inventoryLogs.length > 0) {
      await tx.inventoryLog.createMany({ data: inventoryLogs });
    }

    // 4. Re-synchronize parent product stocks for all affected flavor variants in parallel
    if (affectedVariantProductIds.size > 0) {
      const syncOps = [...affectedVariantProductIds].map(async (parentId) => {
        const sumResult = await tx.productVariantOption.aggregate({
          where: { productId: parentId, isActive: true },
          _sum: { stock: true },
        });
        return tx.product.update({
          where: { id: parentId },
          data: { stock: sumResult._sum.stock ?? 0 },
        });
      });
      await Promise.all(syncOps);
    }

    return { id: trx.id };
  }, { maxWait: 15000, timeout: 30000 });
}

export interface CancelInput {
  transactionId: number;
  reason: string;
  refundFromCashDrawer?: boolean;
}

/**
 * Cancel an order atomically:
 *  - Waiting Payment            : no stock to restore
 *  - Preparing / Ready          : stock is restored to inventory
 *  - Picked Up / Closed         : refunded/cancelled without restoring stock
 * Orders from closed shifts cannot be cancelled to preserve shift cash reconciliation.
 */
export async function cancelOrderService(input: CancelInput) {
  const reason = cleanStr(input.reason, 200);
  if (!reason) throw new UserError('Cancellation reason is required.');

  return prisma.$transaction(async (tx) => {
    const trx = await tx.transaction.findUnique({ where: { id: input.transactionId }, include: { items: true } });
    if (!trx) throw new UserError('Transaction not found.');
    if (trx.status === STATUS.CANCELLED) throw new UserError('Transaction is already cancelled.');

    if (trx.status !== STATUS.WAITING) {
      const shift = trx.shiftId ? await tx.shift.findUnique({ where: { id: trx.shiftId } }) : null;
      if (!shift || shift.status !== 'Open') {
        throw new UserError('Transactions from closed shifts cannot be cancelled.');
      }

      if (trx.paymentMethod === 'Cash') {
        // Cash order cancellation automatically reduces cashSales in summarizeShift
      } else if (input.refundFromCashDrawer) {
        const now = new Date();
        await tx.expense.create({
          data: {
            name: `Cash Refund: TRX-${trx.id} (${trx.paymentMethod || 'Non-Cash'})`,
            amount: trx.amount,
            paymentMethod: 'Cash',
            startDate: now,
            endDate: now,
            shiftId: shift.id,
          },
        });
      }
    }

    const lock = await tx.transaction.updateMany({
      where: { id: trx.id, status: trx.status },
      data: { status: STATUS.CANCELLED, cancelReason: reason },
    });
    if (lock.count === 0) throw new UserError('Transaction status has changed. Please refresh the page.');

    if (trx.status === STATUS.PREPARING || trx.status === STATUS.READY) {
      const productIds = trx.items.map((i) => i.productId).filter((id): id is number => id !== null);
      const [existingProducts, allVariants, allNonBundleProducts] = await Promise.all([
        productIds.length > 0
          ? tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, isBundle: true } })
          : [],
        tx.productVariantOption.findMany(),
        tx.product.findMany({ where: { isBundle: false }, orderBy: { isActive: 'asc' } }),
      ]);
      const productById = new Map(existingProducts.map((p) => [p.id, p]));
      const variantByName = new Map(allVariants.map((v) => [v.name.trim().toLowerCase(), v]));
      const variantById = new Map(allVariants.map((v) => [v.id, v]));
      const productByName = new Map(allNonBundleProducts.map((p) => [p.name.trim().toLowerCase(), p]));

      const productRestorations = new Map<number, number>();
      const variantRestorations = new Map<number, number>();
      const affectedVariantProductIds = new Set<number>();
      const inventoryLogs: Prisma.InventoryLogCreateManyInput[] = [];

      for (const item of trx.items) {
        if (!item.productId) continue;
        const p = productById.get(item.productId);
        if (!p) continue;

        if (!p.isBundle) {
          productRestorations.set(p.id, (productRestorations.get(p.id) || 0) + item.quantity);
        }

        if (item.variantOptionId) {
          variantRestorations.set(item.variantOptionId, (variantRestorations.get(item.variantOptionId) || 0) + item.quantity);
          const vo = variantById.get(item.variantOptionId);
          if (vo) affectedVariantProductIds.add(vo.productId);
        }

        if (item.isBundle && item.bundleContents) {
          const bundleFlavors = parseBundleFlavors(item.bundleContents);
          for (const bf of bundleFlavors) {
            const restoreQty = bf.quantity * item.quantity;
            const cleanName = bf.flavorName.trim().toLowerCase();
            const matchingProd = productByName.get(cleanName);
            if (matchingProd && !matchingProd.isBundle) {
              productRestorations.set(matchingProd.id, (productRestorations.get(matchingProd.id) || 0) + restoreQty);
              inventoryLogs.push({
                productId: matchingProd.id,
                type: 'IN',
                quantity: restoreQty,
                giver: 'Order Cancellation',
                receiver: null,
                notes: `Cancelled order bundle item: TRX-${trx.id} (${matchingProd.name})`,
              });
            } else {
              const matchingVar = variantByName.get(cleanName);
              if (matchingVar) {
                variantRestorations.set(matchingVar.id, (variantRestorations.get(matchingVar.id) || 0) + restoreQty);
                affectedVariantProductIds.add(matchingVar.productId);
                inventoryLogs.push({
                  productId: matchingVar.productId,
                  type: 'IN',
                  quantity: restoreQty,
                  giver: 'Order Cancellation',
                  receiver: null,
                  notes: `Cancelled bundle [${p.name}] flavor: ${matchingVar.name} (TRX-${trx.id})`,
                });
              }
            }
          }
        }

        if (!p.isBundle) {
          inventoryLogs.push({
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            giver: 'Order Cancellation',
            receiver: null,
            notes: `Cancelled order: TRX-${trx.id} (${reason})`,
          });
        }
      }

      const restoreBatch: Promise<unknown>[] = [];

      if (inventoryLogs.length > 0) {
        restoreBatch.push(tx.inventoryLog.createMany({ data: inventoryLogs }));
      }

      for (const [prodId, qty] of productRestorations.entries()) {
        restoreBatch.push(
          tx.product.update({
            where: { id: prodId },
            data: { stock: { increment: qty } },
          })
        );
      }

      for (const [varId, qty] of variantRestorations.entries()) {
        restoreBatch.push(
          tx.productVariantOption.update({
            where: { id: varId },
            data: { stock: { increment: qty } },
          })
        );
      }

      await Promise.all(restoreBatch);

      // Re-synchronize parent product stocks for all affected flavor variants in parallel
      if (affectedVariantProductIds.size > 0) {
        const syncOps = [...affectedVariantProductIds].map(async (parentId) => {
          const sumResult = await tx.productVariantOption.aggregate({
            where: { productId: parentId, isActive: true },
            _sum: { stock: true },
          });
          return tx.product.update({
            where: { id: parentId },
            data: { stock: sumResult._sum.stock ?? 0 },
          });
        });
        await Promise.all(syncOps);
      }
    }
    return { id: trx.id };
  }, { maxWait: 15000, timeout: 30000 });
}

export interface EditPaymentInput {
  transactionId: number;
  paymentMethod: string;
  paidAmount: unknown;
}

/** Modify payment method or paid amount for a paid order in the currently open shift. */
export async function editPaymentService(input: EditPaymentInput) {
  return prisma.$transaction(async (tx) => {
    const shift = await getOpenShift(tx);
    const trx = await tx.transaction.findUnique({ where: { id: input.transactionId } });
    if (!trx) throw new UserError('Transaction not found.');
    if (!PAID_STATUSES.includes(trx.status)) throw new UserError('Only paid orders can be modified.');
    if (!shift || trx.shiftId !== shift.id) {
      throw new UserError('Payments from closed shifts cannot be modified.');
    }
    const { method, paid } = resolvePayment(input.paymentMethod, input.paidAmount, trx.amount);

    if (trx.paymentMethod === 'Cash' && method !== 'Cash') {
      const summary = await summarizeShift(tx, shift.id);
      const availableCash = shift.initialCash + summary.cashSales - summary.cashExpenses;
      if (trx.amount > availableCash) {
        throw new UserError(
          `Cannot change payment method from Cash because cash expenses have already reduced the drawer balance to ${formatRupiah(Math.max(0, availableCash))}.`
        );
      }
    }

    await tx.transaction.update({ where: { id: trx.id }, data: { paymentMethod: method, paidAmount: paid } });
    return { id: trx.id };
  }, { maxWait: 15000, timeout: 30000 });
}

/** Valid status transitions on the kitchen Kanban board. Cancellations must use cancelOrderService. */
export function isAllowedTransition(from: string, to: string): boolean {
  if (from === to) return false;
  if (KANBAN_STATUSES.includes(from) && KANBAN_STATUSES.includes(to)) return true;
  return from === STATUS.PICKED_UP && to === STATUS.CLOSED;
}

export async function changeStatusService(transactionId: number, to: string) {
  return prisma.$transaction(async (tx) => {
    const trx = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!trx) throw new UserError('Transaction not found.');
    if (!isAllowedTransition(trx.status, to)) throw new UserError('Status transition is not allowed.');

    const now = new Date();
    const data: Prisma.TransactionUpdateManyMutationInput = { status: to };
    if (to === STATUS.PREPARING) {
      data.readyAt = null;
      data.pickedUpAt = null;
    } else if (to === STATUS.READY) {
      data.readyAt = now;
      data.pickedUpAt = null;
    } else if (to === STATUS.PICKED_UP) {
      data.pickedUpAt = now;
      if (!trx.readyAt) data.readyAt = now;
    }

    const lock = await tx.transaction.updateMany({ where: { id: trx.id, status: trx.status }, data });
    if (lock.count === 0) throw new UserError('Order status has changed. Please refresh the page.');
    return { id: trx.id };
  }, { maxWait: 15000, timeout: 30000 });
}

/** Archive Picked Up orders to Closed status. */
export async function archivePickedUpService(ids: unknown) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) return { count: 0 };
  const clean = ids.map((i) => parseInteger(i as number | string, { min: 1 })).filter((i): i is number => i !== null);
  if (clean.length === 0) return { count: 0 };
  return prisma.transaction.updateMany({
    where: { id: { in: clean }, status: STATUS.PICKED_UP },
    data: { status: STATUS.CLOSED },
  });
}
