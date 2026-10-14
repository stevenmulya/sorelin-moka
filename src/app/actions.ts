'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { authenticate, destroySession, requireAdmin, requireAnyRole } from '@/lib/auth'
import { STATUS } from '@/lib/constants'
import { UserError, cleanStr, parseInteger, requireInteger, toUserMessage } from '@/lib/validation'
import {
  MAX_PRODUCT_IMAGES_PER_REQUEST,
  deleteUpload,
  saveProductImage,
  saveSelfieDataUrl,
} from '@/lib/uploads'
import {
  approvePaymentService,
  archivePickedUpService,
  cancelOrderService,
  changeStatusService,
  createOrder,
  editPaymentService,
} from '@/lib/services/orders'
import {
  closeShiftService,
  createExpenseService,
  deleteExpenseService,
  openShiftService,
} from '@/lib/services/shifts'
import {
  adjustStockService,
  archiveProductService,
  createProductService,
  parseProductForm,
  removeProductImageService,
  reorderPrioritiesService,
  updateProductService,
} from '@/lib/services/products'

/**
 * Catatan keamanan: setiap action ADMIN memanggil requireAdmin() di baris pertama.
 * Proxy hanyalah lapisan pertama; action tetap harus memeriksa sendiri karena
 * dapat dipanggil lewat POST langsung.
 *
 * Konvensi hasil: { error?: string }. Error validasi/bisnis dikembalikan sebagai pesan
 * (bukan dilempar) agar bisa ditampilkan ke kasir.
 */
export type ActionResult = { error?: string } | void

function fail(e: unknown): { error: string } {
  return { error: toUserMessage(e) }
}

// ============================ TRANSAKSI ============================

export async function createTransaction(formData: FormData): Promise<ActionResult> {
  await requireAdmin()

  let id: number
  try {
    let items: unknown = []
    try {
      items = JSON.parse(String(formData.get('items') ?? '[]'))
    } catch {
      throw new UserError('Cart data corrupted. Please refresh the page.')
    }
    const trx = await createOrder({
      customer: String(formData.get('customer') ?? ''),
      email: String(formData.get('customerEmail') ?? ''),
      phone: String(formData.get('customerPhone') ?? ''),
      items,
    })
    id = trx.id
  } catch (e) {
    return fail(e)
  }

  revalidatePath('/transactions')
  revalidatePath('/')
  redirect(`/transactions/${id}`)
}

export async function approvePayment(formData: FormData): Promise<ActionResult> {
  await requireAdmin()

  let id: number
  try {
    id = requireInteger(formData.get('transactionId') as string, 'Transaction ID', { min: 1 })
    await approvePaymentService({
      transactionId: id,
      cashierName: String(formData.get('cashierName') ?? ''),
      paymentMethod: String(formData.get('paymentMethod') ?? ''),
      paidAmount: formData.get('paidAmount'),
    })
  } catch (e) {
    return fail(e)
  }

  revalidatePath('/transactions')
  revalidatePath(`/transactions/${id}`)
  revalidatePath('/inventory')
  revalidatePath('/shift')
  revalidatePath('/')
  redirect(`/transactions/${id}?print=true`)
}

export async function cancelTransaction(formData: FormData): Promise<ActionResult> {
  await requireAdmin()

  try {
    const id = requireInteger(formData.get('transactionId') as string, 'Transaction ID', { min: 1 })
    await cancelOrderService({ transactionId: id, reason: String(formData.get('cancelReason') ?? '') })
  } catch (e) {
    return fail(e)
  }

  revalidatePath('/transactions')
  revalidatePath('/inventory')
  revalidatePath('/shift')
  revalidatePath('/orders')
  revalidatePath('/')
  redirect('/transactions')
}

export async function editPaymentMethod(formData: FormData): Promise<ActionResult> {
  await requireAdmin()

  let id: number
  try {
    id = requireInteger(formData.get('transactionId') as string, 'Transaction ID', { min: 1 })
    await editPaymentService({
      transactionId: id,
      paymentMethod: String(formData.get('paymentMethod') ?? ''),
      paidAmount: formData.get('paidAmount'),
    })
  } catch (e) {
    return fail(e)
  }

  revalidatePath('/transactions')
  revalidatePath(`/transactions/${id}`)
  revalidatePath('/shift')
  revalidatePath('/')
}

export async function updateTransactionStatus(formData: FormData): Promise<ActionResult> {
  await requireAdmin()

  try {
    const id = requireInteger(formData.get('id') as string, 'Transaction ID', { min: 1 })
    await changeStatusService(id, String(formData.get('status') ?? ''))
  } catch (e) {
    return fail(e)
  }

  revalidatePath('/transactions')
  revalidatePath('/orders')
  revalidatePath('/')
}

export async function bulkArchiveOrders(ids: number[]): Promise<ActionResult> {
  await requireAdmin()
  try {
    await archivePickedUpService(ids)
  } catch (e) {
    return fail(e)
  }
  revalidatePath('/')
}

// ============================ PRODUK ============================

function collectImageFiles(formData: FormData): File[] {
  const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length > MAX_PRODUCT_IMAGES_PER_REQUEST) {
    throw new UserError(`Maximum ${MAX_PRODUCT_IMAGES_PER_REQUEST} images per upload.`)
  }
  return files
}

async function saveAll(files: File[]): Promise<string[]> {
  const urls: string[] = []
  try {
    for (const f of files) urls.push(await saveProductImage(f))
  } catch (e) {
    for (const u of urls) await deleteUpload(u) // jangan tinggalkan file yatim
    throw e
  }
  return urls
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  await requireAdmin()

  try {
    const input = parseProductForm(formData) // validasi dulu sebelum menulis file apa pun
    const urls = await saveAll(collectImageFiles(formData))
    try {
      await createProductService(input, urls)
    } catch (e) {
      for (const u of urls) await deleteUpload(u)
      throw e
    }
  } catch (e) {
    return fail(e)
  }

  revalidatePath('/products')
  revalidatePath('/kiosk')
  redirect('/products')
}

export async function updateProduct(formData: FormData): Promise<ActionResult> {
  await requireAdmin()

  try {
    const id = requireInteger(formData.get('id') as string, 'Product ID', { min: 1 })
    const input = parseProductForm(formData)
    const urls = await saveAll(collectImageFiles(formData))
    try {
      await updateProductService(id, input, urls)
    } catch (e) {
      for (const u of urls) await deleteUpload(u)
      throw e
    }
  } catch (e) {
    return fail(e)
  }

  revalidatePath('/products')
  revalidatePath('/kiosk')
  redirect('/products')
}

export async function deleteProductImage(formData: FormData): Promise<ActionResult> {
  await requireAdmin()

  let productId: number
  try {
    productId = requireInteger(formData.get('id') as string, 'Product ID', { min: 1 })
    const imageId = requireInteger(formData.get('imageId') as string, 'Image ID', { min: 1 })
    const url = await removeProductImageService(productId, imageId)
    await deleteUpload(url)
  } catch (e) {
    return fail(e)
  }

  revalidatePath(`/products/${productId}/edit`)
  revalidatePath('/products')
  revalidatePath('/kiosk')
}

/** "Hapus" produk = arsipkan (riwayat stok & penjualan tidak hilang). */
export async function deleteProduct(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  try {
    const id = requireInteger(formData.get('id') as string, 'Product ID', { min: 1 })
    await archiveProductService(id)
  } catch (e) {
    return fail(e)
  }
  revalidatePath('/products')
  revalidatePath('/inventory')
  revalidatePath('/kiosk')
  revalidatePath('/')
}

export async function toggleBestSeller(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const id = parseInteger(formData.get('id') as string, { min: 1 })
  if (id === null) return { error: 'ID produk tidak valid.' }
  const current = formData.get('current') === 'true'
  await prisma.product.updateMany({ where: { id, isActive: true }, data: { isBestSeller: !current } })
  revalidatePath('/products')
  revalidatePath('/kiosk')
}

export async function toggleFavorite(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const id = parseInteger(formData.get('id') as string, { min: 1 })
  if (id === null) return { error: 'ID produk tidak valid.' }
  const current = formData.get('current') === 'true'
  await prisma.product.updateMany({ where: { id, isActive: true }, data: { isFavorite: !current } })
  revalidatePath('/products')
  revalidatePath('/kiosk')
}

/** Menerima urutan id produk di halaman aktif (atas ke bawah). */
export async function updatePriorities(orderedIds: number[]): Promise<ActionResult> {
  await requireAdmin()
  try {
    await reorderPrioritiesService(orderedIds)
  } catch (e) {
    return fail(e)
  }
  revalidatePath('/products')
  revalidatePath('/kiosk')
}

// ============================ STOK ============================

export async function adjustStock(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  try {
    await adjustStockService({
      productId: requireInteger(formData.get('productId') as string, 'Product', { min: 1 }),
      type: String(formData.get('type') ?? ''),
      quantity: formData.get('quantity'),
      giver: String(formData.get('giver') ?? ''),
      receiver: String(formData.get('receiver') ?? ''),
      notes: String(formData.get('notes') ?? ''),
    })
  } catch (e) {
    return fail(e)
  }
  revalidatePath('/inventory')
  revalidatePath('/products')
  revalidatePath('/kiosk')
  revalidatePath('/')
}

// ============================ PENGELUARAN ============================

export async function createExpense(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  try {
    await createExpenseService(
      String(formData.get('name') ?? ''),
      formData.get('amount'),
      formData.get('paymentMethod') ? String(formData.get('paymentMethod')) : undefined
    )
  } catch (e) {
    return fail(e)
  }
  revalidatePath('/report')
  revalidatePath('/expenses')
  revalidatePath('/shift')
  revalidatePath('/')
}

export async function deleteExpense(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  try {
    await deleteExpenseService(requireInteger(formData.get('id') as string, 'Expense ID', { min: 1 }))
  } catch (e) {
    return fail(e)
  }
  revalidatePath('/report')
  revalidatePath('/expenses')
  revalidatePath('/shift')
  revalidatePath('/')
}

// ============================ SHIFT ============================

export async function openShift(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  try {
    await openShiftService(String(formData.get('openedBy') ?? ''), formData.get('initialCash'))
  } catch (e) {
    return fail(e)
  }
  revalidatePath('/shift')
  revalidatePath('/shifts')
  revalidatePath('/')
  redirect('/')
}

export async function closeShift(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  try {
    const shiftId = requireInteger(formData.get('shiftId') as string, 'Shift ID', { min: 1 })
    await closeShiftService(shiftId, formData.get('actualCash'), String(formData.get('closedBy') ?? ''))
  } catch (e) {
    return fail(e)
  }
  revalidatePath('/shift')
  revalidatePath('/shifts')
  revalidatePath('/transactions')
  revalidatePath('/orders')
  revalidatePath('/kiosk')
  revalidatePath('/')
  redirect('/shift')
}

// ============================ AUTH ============================

export async function loginAction(formData: FormData) {
  const username = cleanStr(formData.get('username'), 80)
  const password = typeof formData.get('password') === 'string' ? (formData.get('password') as string).trim() : ''
  if (!username || !password) return { success: false as const, error: 'Username and password are required.' }
  return authenticate(username, password)
}

export async function logoutAction() {
  await destroySession()
  redirect('/login')
}

// ============================ KIOSK ============================

const MAX_WAITING_ORDERS = 30

export async function submitKioskOrder(data: {
  customerName: string
  customerEmail: string
  items: { productId: number; quantity: number }[]
  photoBase64: string
}): Promise<{ success: true; transactionId: number } | { success: false; error: string }> {
  await requireAnyRole()

  let selfieUrl: string | null = null
  try {
    // Perlindungan banjir pesanan dari kiosk
    const waiting = await prisma.transaction.count({ where: { status: STATUS.WAITING, shift: { status: 'Open' } } })
    if (waiting >= MAX_WAITING_ORDERS) throw new UserError('Order queue is currently full. Please contact the cashier.')

    if (data.photoBase64) selfieUrl = await saveSelfieDataUrl(data.photoBase64)

    try {
      const trx = await createOrder({
        customer: data.customerName,
        email: data.customerEmail,
        items: data.items,
        selfieUrl,
      })
      revalidatePath('/transactions')
      revalidatePath('/')
      return { success: true, transactionId: trx.id }
    } catch (e) {
      await deleteUpload(selfieUrl) // pesanan gagal -> jangan tinggalkan foto yatim
      throw e
    }
  } catch (e) {
    return { success: false, error: toUserMessage(e) }
  }
}
