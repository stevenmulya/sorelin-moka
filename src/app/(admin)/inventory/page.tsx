import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import InventoryAdjuster from '@/components/InventoryAdjuster';
import HistoryWidget from '@/components/HistoryWidget';
import Pagination from '@/components/Pagination';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { parsePage } from '@/lib/validation';
import { connection } from 'next/server';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}) {
  await connection();
  const resolvedParams = await searchParams;
  const q = resolvedParams.q?.trim() || '';
  const page = parsePage(resolvedParams.page);
  const filter = resolvedParams.filter || '';
  const take = 9;
  const skip = (page - 1) * take;

  const whereClause: Prisma.ProductWhereInput = {
    isActive: true,
  };

  if (q) {
    whereClause.name = { contains: q };
  }
  if (filter === 'low') {
    whereClause.stock = { lte: LOW_STOCK_THRESHOLD };
  }

  const [allProducts, products, totalProducts, logs] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, stock: true },
    }),
    prisma.product.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      include: { type: true, variant: true },
      take,
      skip,
    }),
    prisma.product.count({ where: whereClause }),
    prisma.inventoryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { product: { select: { name: true } } },
    }),
  ]);

  const totalPages = Math.ceil(totalProducts / take) || 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#6B4227] tracking-tight">Stock Inventory</h1>
        <p className="text-sm text-[#8E6D53] mt-1">Manage and adjust your stock levels in real-time.</p>
      </div>

      <HistoryWidget logs={logs} />

      <InventoryAdjuster products={allProducts} />

      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-lg font-bold text-[#6B4227] flex items-center gap-3">
            Current Stock
            <Link
              href={`/inventory?page=1${q ? `&q=${q}` : ''}${filter === 'low' ? '' : '&filter=low'}`}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                filter === 'low'
                  ? 'bg-[#F3DBAA] text-[#54311B] border-[#DFC082]'
                  : 'bg-[#FFFDF8] text-[#8E6D53] border-[#E5D5BC] hover:bg-[#FAF0DA]'
              }`}
            >
              {filter === 'low' ? 'Filter: Low Stock (Active)' : 'Filter: Low Stock'}
            </Link>
          </h2>
          <form action="/inventory" method="GET" className="relative w-full sm:w-64">
            {filter && <input type="hidden" name="filter" value={filter} />}
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search products..."
              className="w-full pl-9 pr-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227]"
            />
            <Search className="h-4 w-4 text-[#9E826B] absolute left-3 top-1/2 -translate-y-1/2" />
            <button type="submit" className="hidden">
              Search
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((product) => {
            const isRed = product.stock <= LOW_STOCK_THRESHOLD;
            const isYellow = product.stock > LOW_STOCK_THRESHOLD && product.stock <= LOW_STOCK_THRESHOLD * 2;
            const dotColor = isRed ? 'bg-red-500' : isYellow ? 'bg-amber-500' : 'bg-emerald-500';
            const textColor = isRed ? 'text-red-700' : isYellow ? 'text-amber-800' : 'text-[#6B4227]';
            const borderColor = isRed
              ? 'border-red-200 bg-[#FEF2F2]/60'
              : isYellow
                ? 'border-amber-200 bg-[#FEF6E7]/60'
                : 'border-[#E5D5BC] bg-[#FFFDF8]';

            return (
              <div
                key={product.id}
                className={`border rounded-2xl p-5 shadow-xs hover:border-[#D5C1A1] transition-all flex flex-col justify-between ${borderColor}`}
              >
                <div>
                  <h3 className="font-bold text-[#3F2311] text-lg">{product.name}</h3>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2.5 py-0.5 bg-[#FAF0DA] border border-[#E5D5BC] text-[#8E6D53] text-xs font-semibold rounded-md">
                      {product.type?.name || 'No Type'}
                    </span>
                    <span className="px-2.5 py-0.5 bg-[#FAF0DA] border border-[#E5D5BC] text-[#8E6D53] text-xs font-semibold rounded-md">
                      {product.variant?.name || 'No Variant'}
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-[#E5D5BC]/60 pt-4">
                  <span className="text-sm font-semibold text-[#8E6D53]">Stock Quantity</span>
                  <div className="inline-flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`}></div>
                    <span className={`text-2xl font-bold tracking-tight ${textColor}`}>{product.stock}</span>
                    <span className="text-xs font-medium text-[#8E6D53]">units</span>
                  </div>
                </div>
              </div>
            );
          })}
          {products.length === 0 && (
            <div className="col-span-full p-12 text-center text-[#8E6D53] border-2 border-dashed border-[#E5D5BC] rounded-2xl bg-[#FFFDF8]">
              No products found matching your search.
            </div>
          )}
        </div>

        <div className="mt-6">
          <Pagination
            page={page}
            totalPages={totalPages}
            basePath="/inventory"
            params={{ q: q || undefined, filter: filter || undefined }}
            totalItems={totalProducts}
            pageSize={take}
          />
        </div>
      </div>
    </div>
  );
}
