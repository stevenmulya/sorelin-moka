'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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
  
  await prisma.transaction.create({
    data: {
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
  })

  revalidatePath('/transactions')
  revalidatePath('/')
  redirect('/transactions')
}

export async function approvePayment(formData: FormData) {
  const transactionId = Number(formData.get('transactionId'))
  const cashierName = formData.get('cashierName') as string
  const paidAmount = Number(formData.get('paidAmount'))

  const printType = formData.get('printType') as string;

  const trx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { items: true }
  });

  if (!trx || trx.status !== 'Waiting Payment') return;

  // Deduct stock for each item securely (Atomic Update prevents Race Conditions)
  for (const item of trx.items) {
    if (!item.productId) continue;
    
    // We wrap in try/catch in case the product was deleted
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

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: 'Preparing',
      preparedAt: new Date(),
      cashierName,
      paidAmount
    }
  })

  revalidatePath('/transactions')
  revalidatePath(`/transactions/${transactionId}`)
  revalidatePath('/inventory')
  revalidatePath('/insights')
  revalidatePath('/')
  
  if (printType === 'text' || printType === 'image') {
    redirect(`/transactions/${transactionId}/print?type=${printType}`);
  } else {
    redirect('/')
  }
}

export async function cancelTransaction(formData: FormData) {
  const transactionId = Number(formData.get('transactionId'))
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: 'Cancelled' }
  })
  revalidatePath('/transactions')
  revalidatePath('/')
  redirect('/')
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
  const id = Number(formData.get('id'))
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

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  let newStock = product.stock;
  if (type === 'IN') newStock += quantity;
  else if (type === 'OUT') newStock = Math.max(0, newStock - quantity);
  else if (type === 'RESET') newStock = quantity;

  await prisma.product.update({
    where: { id: productId },
    data: { stock: newStock }
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
  const days = Number(formData.get('days'));
  
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Math.max(1, days) - 1); // e.g. 1 day = same date

  await prisma.expense.create({
    data: {
      name,
      amount,
      startDate,
      endDate
    }
  });

  revalidatePath('/insights');
  revalidatePath('/');
}

export async function deleteExpense(formData: FormData) {
  const id = Number(formData.get('id'));
  await prisma.expense.delete({ where: { id } });
  revalidatePath('/insights');
  revalidatePath('/');
}
