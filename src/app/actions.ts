'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()

export async function createTransaction(formData: FormData) {
  const customer = formData.get('customer') as string
  const customerEmail = formData.get('customerEmail') as string
  const customerPhone = formData.get('customerPhone') as string
  const totalAmount = Number(formData.get('totalAmount'))
  const itemsJson = formData.get('items') as string
  
  let items: any[] = []
  if (itemsJson) {
    items = JSON.parse(itemsJson)
  }

  // Fetch current costPrice for each product securely from DB
  const productIds = items.map((item: any) => item.productId);
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, costPrice: true }
  });
  const costPriceMap = new Map(dbProducts.map(p => [p.id, p.costPrice]));
  
  // Fetch active shift
  const activeShift = await prisma.shift.findFirst({
    where: { status: 'Open' },
    orderBy: { startTime: 'desc' }
  });

  if (!activeShift) {
    // You cannot sell without an open shift
    redirect('/shift');
  }
  
  const newTrx = await prisma.transaction.create({
    data: {
      shiftId: activeShift.id,
      customer: customer || 'Guest',
      customerEmail: customerEmail || null,
      customerPhone: customerPhone || null,
      amount: totalAmount,
      status: 'Waiting Payment',
      items: {
        create: items.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          costPrice: costPriceMap.get(item.productId) || 0
        }))
      }
    }
  });

  revalidatePath('/transactions');
  revalidatePath('/');
  redirect(`/transactions/${newTrx.id}`);
}

export async function approvePayment(formData: FormData) {
  const transactionId = Number(formData.get('transactionId'))
  const cashierName = formData.get('cashierName') as string
  const paidAmount = Number(formData.get('paidAmount'))
  const paymentMethod = formData.get('paymentMethod') as string

  const printType = formData.get('printType') as string;

  const trx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { items: true }
  });

  if (!trx || trx.status !== 'Waiting Payment') return;
  
  // Security: Validate paid amount
  if (paidAmount < trx.amount) {
    throw new Error("Paid amount cannot be less than transaction total");
  }

  // Security: Atomic lock to prevent Race Conditions (e.g. double-clicking "Pay")
  // We use updateMany to atomically check AND update the status in one database query
  const lockResult = await prisma.transaction.updateMany({
    where: { 
      id: transactionId, 
      status: 'Waiting Payment' 
    },
    data: {
      status: 'Preparing',
      preparedAt: new Date(),
      cashierName,
      paidAmount,
      paymentMethod
    }
  });

  // If count is 0, it means another request already processed this payment!
  if (lockResult.count === 0) {
    return;
  }

  // Now it's perfectly safe to deduct stock exactly once
  for (const item of trx.items) {
    if (!item.productId) continue;
    
    try {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } }
      });
    } catch (e) {
      console.error("Product not found for stock deduction", e);
    }

    await prisma.inventoryLog.create({
      data: {
        productId: item.productId,
        type: 'OUT',
        quantity: item.quantity,
        giver: null,
        receiver: trx.customer,
        notes: `Sales: TRX-${trx.id}`
      }
    });
  }

  revalidatePath('/transactions')
  revalidatePath(`/transactions/${transactionId}`)
  revalidatePath('/inventory')
  revalidatePath('/insights')
  revalidatePath('/')
  
  redirect(`/transactions/${transactionId}?print=true`)
}

export async function cancelTransaction(formData: FormData) {
  const transactionId = Number(formData.get('transactionId'));
  const cancelReason = formData.get('cancelReason') as string || null;
  
  const trx = await prisma.transaction.findUnique({ 
    where: { id: transactionId },
    include: { items: true }
  });
  
  if (!trx || trx.status === 'Cancelled') return;
  
  // If the order was already paid/confirmed, stock was deducted. We must revert it.
  if (trx.status !== 'Waiting Payment') {
    for (const item of trx.items) {
      if (!item.productId) continue;
      try {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
      } catch (e) {
        console.error(`Failed to revert stock for product ${item.productId}`);
      }
    }
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: 'Cancelled', cancelReason }
  });
  
  revalidatePath('/transactions');
  revalidatePath('/');
  redirect('/transactions');
}

export async function editPaymentMethod(formData: FormData) {
  const transactionId = Number(formData.get('transactionId'));
  const paymentMethod = formData.get('paymentMethod') as string;
  const paidAmount = Number(formData.get('paidAmount'));

  const trx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  
  if (!trx || trx.status === 'Cancelled' || trx.status === 'Waiting Payment') {
    throw new Error("Cannot edit payment for cancelled or unpaid orders");
  }

  if (paidAmount < trx.amount) {
    throw new Error("Paid amount cannot be less than total amount");
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { paymentMethod, paidAmount }
  });

  revalidatePath('/transactions');
  revalidatePath(`/transactions/${transactionId}`);
}

export async function createProduct(formData: FormData) {
  const typeName = formData.get('type') as string
  const variantName = formData.get('variant') as string
  
  const files = formData.getAll('images') as File[];
  const uploadedUrls: string[] = [];
  
  for (const file of files) {
    const url = await saveImage(file);
    if (url) uploadedUrls.push(url);
  }

  await prisma.product.create({
    data: {
      name: formData.get('name') as string,
      type: typeName ? { connectOrCreate: { where: { name: typeName }, create: { name: typeName } } } : undefined,
      variant: variantName ? { connectOrCreate: { where: { name: variantName }, create: { name: variantName } } } : undefined,
      description: formData.get('description') as string,
      costPrice: Number(formData.get('costPrice')),
      price: Number(formData.get('price')),
      discountPrice: formData.get('discountPrice') ? Number(formData.get('discountPrice')) : null,
      stock: 0,
      images: {
        create: uploadedUrls.map(url => ({ url }))
      }
    }
  })
  revalidatePath('/products')
  redirect('/products')
}

export async function updateProduct(formData: FormData) {
  const id = Number(formData.get('id'))
  const typeName = formData.get('type') as string
  const variantName = formData.get('variant') as string

  const files = formData.getAll('images') as File[];
  const uploadedUrls: string[] = [];
  
  for (const file of files) {
    const url = await saveImage(file);
    if (url) uploadedUrls.push(url);
  }

  const updateData: any = {
    name: formData.get('name') as string,
    type: typeName ? { connectOrCreate: { where: { name: typeName }, create: { name: typeName } } } : { disconnect: true },
    variant: variantName ? { connectOrCreate: { where: { name: variantName }, create: { name: variantName } } } : { disconnect: true },
    description: formData.get('description') as string,
    costPrice: Number(formData.get('costPrice')),
    price: Number(formData.get('price')),
    discountPrice: formData.get('discountPrice') ? Number(formData.get('discountPrice')) : null,
  }

  if (uploadedUrls.length > 0) {
    updateData.images = {
      create: uploadedUrls.map(url => ({ url }))
    };
  }

  await prisma.product.update({
    where: { id },
    data: updateData
  })
  revalidatePath('/products')
  redirect('/products')
}

export async function deleteProduct(formData: FormData) {
  const id = Number(formData.get('id'));

  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: true }
  });

  if (product) {
    for (const image of product.images) {
      try {
        const filepath = path.join(process.cwd(), 'public', image.url);
        await fs.unlink(filepath);
      } catch (e) {
        console.error("Failed to delete physical image", e);
      }
    }
  }

  await prisma.product.delete({
    where: { id }
  })
  revalidatePath('/products')
}

import { promises as fs } from 'fs'
import path from 'path'

async function saveImage(file: File | null): Promise<string | undefined> {
  if (!file || file.size === 0) return undefined;
  
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = Date.now() + '-' + file.name.replaceAll(' ', '_');
  const filepath = path.join(process.cwd(), 'public', 'uploads', filename);
  
  await fs.writeFile(filepath, buffer);
  return `/uploads/${filename}`;
}

export async function toggleBestSeller(formData: FormData) {
  const id = Number(formData.get('id'));
  const current = formData.get('current') === 'true';
  await prisma.product.update({ where: { id }, data: { isBestSeller: !current } });
  revalidatePath('/products');
}

export async function toggleFavorite(formData: FormData) {
  const id = Number(formData.get('id'));
  const current = formData.get('current') === 'true';
  await prisma.product.update({ where: { id }, data: { isFavorite: !current } });
  revalidatePath('/products');
}

export async function movePriorityUp(formData: FormData) {
  const id = Number(formData.get('id'));
  const priority = Number(formData.get('priority'));
  await prisma.product.update({ where: { id }, data: { priority: priority + 1 } });
  revalidatePath('/products');
}

export async function movePriorityDown(formData: FormData) {
  const id = Number(formData.get('id'));
  const priority = Number(formData.get('priority'));
  await prisma.product.update({ where: { id }, data: { priority: Math.max(0, priority - 1) } });
  revalidatePath('/products');
}

export async function adjustStock(formData: FormData) {
  const productId = Number(formData.get('productId'));
  const type = formData.get('type') as string; // IN, OUT, RESET
  const quantity = Number(formData.get('quantity'));
  const giver = formData.get('giver') as string;
  const receiver = formData.get('receiver') as string;
  const notes = formData.get('notes') as string;

  if (quantity < 0) {
    throw new Error("Quantity cannot be negative");
  }

  let updateData: any = {};
  if (type === 'IN') {
    updateData = { stock: { increment: quantity } };
  } else if (type === 'OUT') {
    // We can't easily prevent sub-zero natively in simple prisma decrement without where clause, 
    // but we can check current first as a fallback, though atomic is better.
    // For absolute perfection, Prisma allows decrement. If it goes below zero, it's a logical negative stock.
    updateData = { stock: { decrement: quantity } };
  } else if (type === 'RESET') {
    updateData = { stock: quantity };
  }

  await prisma.product.update({
    where: { id: productId },
    data: updateData
  });

  await prisma.inventoryLog.create({
    data: {
      productId,
      type,
      quantity,
      giver: giver || null,
      receiver: receiver || null,
      notes: notes || null
    }
  });

  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/');
}

export async function updatePriorities(updates: { id: number, priority: number }[]) {
  // Use a transaction to update all at once
  await prisma.$transaction(
    updates.map(u => 
      prisma.product.update({ where: { id: u.id }, data: { priority: u.priority } })
    )
  );
  revalidatePath('/products');
}

export async function updateTransactionStatus(formData: FormData) {
  const id = Number(formData.get('id'));
  const status = formData.get('status') as string;
  
  const updateData: any = { status };
  const now = new Date();
  
  if (status === 'Preparing') updateData.preparedAt = now;
  else if (status === 'Ready for Pickup') updateData.readyAt = now;
  else if (status === 'Picked Up') updateData.pickedUpAt = now;

  await prisma.transaction.update({
    where: { id },
    data: updateData
  });
  
  revalidatePath('/transactions');
  revalidatePath('/orders');
  revalidatePath('/');
}

export async function bulkArchiveOrders(ids: number[]) {
  await prisma.transaction.updateMany({
    where: { id: { in: ids } },
    data: { status: 'Closed' }
  });
  revalidatePath('/');
}


export async function createExpense(formData: FormData) {
  const name = formData.get('name') as string;
  const amount = Number(formData.get('amount'));
  
  const startDate = new Date();
  const endDate = new Date(startDate); // 1 day lifespan (Cash Basis)

  const openShift = await prisma.shift.findFirst({ where: { status: 'Open' }, orderBy: { startTime: 'desc' } });

  if (!openShift) {
    redirect('/shift');
  }

  await prisma.expense.create({
    data: {
      name,
      amount,
      startDate,
      endDate,
      shiftId: openShift.id
    }
  });

  revalidatePath('/insights');
  revalidatePath('/expenses');
  revalidatePath('/shift');
  revalidatePath('/');
}

export async function deleteExpense(formData: FormData) {
  const id = Number(formData.get('id'));
  await prisma.expense.delete({ where: { id } });
  revalidatePath('/insights');
  revalidatePath('/expenses');
  revalidatePath('/shift');
  revalidatePath('/');
}

// ================= SHIFT ACTIONS =================

export async function openShift(formData: FormData) {
  const openedBy = formData.get('openedBy') as string;
  const initialCash = Number(formData.get('initialCash'));

  // Close any existing open shifts just in case
  await prisma.shift.updateMany({
    where: { status: 'Open' },
    data: { status: 'Closed', endTime: new Date(), closedBy: 'System Auto-close' }
  });

  await prisma.shift.create({
    data: {
      openedBy,
      initialCash,
      status: 'Open',
    }
  });

  revalidatePath('/shift');
  revalidatePath('/shifts');
  revalidatePath('/');
  redirect('/');
}

export async function closeShift(formData: FormData) {
  const shiftId = Number(formData.get('shiftId'));
  const actualCash = Number(formData.get('actualCash'));
  const closedBy = formData.get('closedBy') as string;

  // Security: Calculate Expected Cash securely on the server
  // Do not trust form data for financial calculations
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.status === 'Closed') return;

  const transactions = await prisma.transaction.findMany({
    where: { shiftId, status: { not: 'Cancelled' } }
  });

  let cashSales = 0;
  for (const trx of transactions) {
    if (trx.status === 'Waiting Payment') continue;
    if (trx.paymentMethod === 'Cash' || !trx.paymentMethod) cashSales += trx.amount;
  }

  const expenses = await prisma.expense.findMany({
    where: { shiftId }
  });
  
  let shiftExpenses = 0;
  for (const exp of expenses) {
    shiftExpenses += exp.amount;
  }

  const expectedCash = shift.initialCash + cashSales - shiftExpenses;

  await prisma.shift.update({
    where: { id: shiftId },
    data: {
      status: 'Closed',
      endTime: new Date(),
      actualCash,
      expectedCash,
      closedBy
    }
  });

  // Automatically cancel all unpaid transactions from this shift
  // Otherwise they will hang around and cause cash discrepancies if paid later
  await prisma.transaction.updateMany({
    where: { shiftId, status: 'Waiting Payment' },
    data: { status: 'Cancelled' }
  });

  // UX Improvement: Auto-archive any globally pending "Picked Up" orders 
  // so the new cashier starts with a clean Picked Up column.
  await prisma.transaction.updateMany({
    where: { status: 'Picked Up' },
    data: { status: 'Closed' }
  });

  revalidatePath('/shift');
  revalidatePath('/shifts');
  revalidatePath('/transactions');
  revalidatePath('/orders');
  revalidatePath('/');
  redirect('/shift');
}


export async function loginAction(formData: FormData) {
  const username = (formData.get('username') as string)?.trim();
  const password = (formData.get('password') as string)?.trim();
  
  if (username === 'admin' && password === 'sorelin') {
    (await cookies()).set('auth_role', 'admin', { path: '/', maxAge: 60 * 60 * 24 * 7 });
    return { success: true, role: 'admin' };
  } else if (username === 'customer' && password === 'soretan') {
    (await cookies()).set('auth_role', 'kiosk', { path: '/', maxAge: 60 * 60 * 24 * 7 });
    return { success: true, role: 'kiosk' };
  }
  
  return { success: false, error: 'Invalid username or password' };
}

export async function logoutAction() {
  (await cookies()).delete('auth_role');
  redirect('/login');
}

export async function submitKioskOrder(data: {
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  items: any[];
  photoBase64: string;
}) {
  // Save selfie
  let selfieUrl = null;
  if (data.photoBase64) {
    const base64Data = data.photoBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `selfie_${Date.now()}.png`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
    // Ensure dir exists
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }
    
    const filepath = path.join(uploadsDir, filename);
    await fs.writeFile(filepath, buffer);
    selfieUrl = `/uploads/${filename}`;
  }

  // Find active shift
  const shift = await prisma.shift.findFirst({
    where: { status: 'Open' },
    orderBy: { startTime: 'desc' }
  });

  if (!shift) {
    return { success: false, error: "Store is currently closed." };
  }

  // Pre-fetch product cost prices
  const productIds = data.items.map(i => i.productId);
  const productsInDb = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, costPrice: true }
  });
  const costMap = new Map(productsInDb.map(p => [p.id, p.costPrice]));

  // Create Transaction
  const trx = await prisma.transaction.create({
    data: {
      customer: data.customerName,
      customerEmail: data.customerEmail,
      amount: data.totalAmount,
      status: 'Waiting Payment',
      shiftId: shift.id,
      paymentMethod: null,
      paidAmount: null,
      cashierName: null,
      selfieUrl: selfieUrl,
      items: {
        create: data.items.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          costPrice: costMap.get(item.productId) || 0
        }))
      }
    }
  });

  // Adjust stock via atomic decrement
  for (const item of data.items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } }
    });
  }

  revalidatePath('/transactions');
  revalidatePath('/');
  return { success: true, transactionId: trx.id };
}
