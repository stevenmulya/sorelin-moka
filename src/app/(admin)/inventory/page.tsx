import { PrismaClient } from '@prisma/client';
import InventoryAdjuster from '@/components/InventoryAdjuster';
import HistoryWidget from '@/components/HistoryWidget';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const instant = false;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string, page?: string, filter?: string }> }) {
  const resolvedParams = await searchParams;
  const q = resolvedParams.q || '';
  const page = parseInt(resolvedParams.page || '1');
  const filter = resolvedParams.filter || '';
  const take = 9;
  const skip = (page - 1) * take;

  const whereClause: any = {};
  if (q) {
    whereClause.name = { contains: q };
  }
  if (filter === 'low') {
    whereClause.stock = { lt: 10 }; // both red and yellow
  }

  // Find products for dropdown (all of them) for InventoryAdjuster
  const allProducts = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, stock: true }
  });

  // Find paginated products for grid
  const products = await prisma.product.findMany({
    where: whereClause,
    orderBy: { name: 'asc' },
    include: { type: true, variant: true },
    take,
    skip
  });

  const totalProducts = await prisma.product.count({ where: whereClause });
  const totalPages = Math.ceil(totalProducts / take);

  const logs = await prisma.inventoryLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { product: { select: { name: true } } }
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Live Stock Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and adjust your stock levels in real-time.</p>
      </div>

      <HistoryWidget logs={logs} />
      
      <InventoryAdjuster products={allProducts} />

      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
            Current Stock
            <Link 
              href={`/inventory?page=1${q ? `&q=${q}` : ''}${filter === 'low' ? '' : '&filter=low'}`}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === 'low' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
              }`}
            >
              {filter === 'low' ? 'Showing Low Stock' : 'Filter Low Stock'}
            </Link>
          </h2>
          <form action="/inventory" className="relative w-full sm:w-64">
            {filter && <input type="hidden" name="filter" value={filter} />}
            <input 
              type="text" 
              name="q" 
              defaultValue={q} 
              placeholder="Search products..." 
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <button type="submit" className="hidden">Search</button>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((product) => {
            const isRed = product.stock <= 5;
            const isYellow = product.stock > 5 && product.stock < 10;
            const dotColor = isRed ? 'bg-red-500' : isYellow ? 'bg-amber-500' : 'bg-emerald-500';
            const textColor = isRed ? 'text-red-600' : isYellow ? 'text-amber-600' : 'text-gray-900';
            const borderColor = isRed ? 'border-red-200 bg-red-50/10' : isYellow ? 'border-amber-200 bg-amber-50/10' : 'border-gray-200 bg-white';

            return (
              <div key={product.id} className={`border rounded-xl p-5 shadow-sm hover:border-gray-300 transition-all flex flex-col justify-between ${borderColor}`}>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{product.name}</h3>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-gray-100/80 text-gray-600 text-xs font-medium rounded-md">
                      {product.type?.name || 'No Type'}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-100/80 text-gray-600 text-xs font-medium rounded-md">
                      {product.variant?.name || 'No Variant'}
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="text-sm font-medium text-gray-500">Stock Quantity</span>
                  <div className="inline-flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${dotColor}`}></div>
                    <span className={`text-xl font-bold tracking-tight ${textColor}`}>
                      {product.stock}
                    </span>
                    <span className="text-sm font-medium text-gray-500">pcs</span>
                  </div>
                </div>
              </div>
            );
          })}
          {products.length === 0 && (
            <div className="col-span-full p-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
              No products found matching your search.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Link 
              href={`/inventory?page=${Math.max(1, page - 1)}${q ? `&q=${q}` : ''}${filter ? `&filter=${filter}` : ''}`}
              className={`p-2 rounded-lg border border-gray-300 hover:bg-gray-50 ${page <= 1 ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <span className="text-sm font-medium text-gray-700">
              Page {page} of {totalPages}
            </span>
            <Link 
              href={`/inventory?page=${Math.min(totalPages, page + 1)}${q ? `&q=${q}` : ''}${filter ? `&filter=${filter}` : ''}`}
              className={`p-2 rounded-lg border border-gray-300 hover:bg-gray-50 ${page >= totalPages ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
