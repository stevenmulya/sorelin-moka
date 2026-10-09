import { PrismaClient, Prisma } from '@prisma/client';
import { Plus, Search, Edit2, Trash2, Star, Heart, Filter, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { deleteProduct, toggleBestSeller, toggleFavorite, movePriorityUp, movePriorityDown } from '@/app/actions';
import ProductTableBody from '@/components/ProductTableBody';

import HistoryWidget from '@/components/HistoryWidget';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const instant = false;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams;
  
  const page = typeof resolvedParams.page === 'string' ? Number(resolvedParams.page) : 1;
  const sort = typeof resolvedParams.sort === 'string' ? resolvedParams.sort : 'priorities';
  const q = typeof resolvedParams.q === 'string' ? resolvedParams.q : '';

  const take = 10;
  const skip = (page - 1) * take;

  const where: Prisma.ProductWhereInput = q ? {
    OR: [
      { name: { contains: q } },
      { description: { contains: q } },
      { type: { name: { contains: q } } },
      { variant: { name: { contains: q } } }
    ]
  } : {};

  let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] = [
    { priority: 'desc' },
    { createdAt: 'desc' }
  ];

  if (sort === 'newest') orderBy = { createdAt: 'desc' };
  if (sort === 'oldest') orderBy = { createdAt: 'asc' };
  
  const totalItems = await prisma.product.count({ where });
  const totalPages = Math.ceil(totalItems / take);

  const products = await prisma.product.findMany({
    where,
    orderBy,
    take,
    skip,
    include: { type: true, variant: true, images: true }
  });

  const logs = await prisma.inventoryLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { product: { select: { name: true } } }
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Products Menu</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your catalog, variants, and priority ordering.</p>
        </div>
        <Link href="/products/new" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <form action="/products" method="GET" className="p-4 border-b border-gray-200 flex flex-col sm:flex-row items-center gap-4 bg-gray-50/50">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              name="q"
              defaultValue={q}
              placeholder="Search products..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative">
              <select 
                name="sort" 
                defaultValue={sort} 
                className="appearance-none pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-700 font-medium"
              >
                <option value="priorities">Sort by Priority</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            </div>
            <button type="submit" className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Apply</button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Priority (Drag)</th>
                <th className="px-6 py-4">Product Info</th>
                <th className="px-6 py-4">Pricing</th>
                <th className="px-6 py-4 text-center">Badges</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <ProductTableBody key={page + q + sort} initialProducts={products} />
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-white">
            <span className="text-sm text-gray-500">
              Showing {skip + 1} to {Math.min(skip + take, totalItems)} of {totalItems} items
            </span>
            <div className="flex items-center gap-1">
              <Link
                href={`?page=${Math.max(1, page - 1)}&sort=${sort}&q=${q}`}
                className={`p-2 rounded-md ${page === 1 ? 'text-gray-300 pointer-events-none' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              
              {[...Array(totalPages)].map((_, i) => (
                <Link
                  key={i + 1}
                  href={`?page=${i + 1}&sort=${sort}&q=${q}`}
                  className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-sm font-medium ${
                    page === i + 1 ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {i + 1}
                </Link>
              ))}

              <Link
                href={`?page=${Math.min(totalPages, page + 1)}&sort=${sort}&q=${q}`}
                className={`p-2 rounded-md ${page === totalPages ? 'text-gray-300 pointer-events-none' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
