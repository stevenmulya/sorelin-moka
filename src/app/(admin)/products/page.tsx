import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Plus, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import ProductTableBody from '@/components/ProductTableBody';
import Pagination from '@/components/Pagination';
import { parsePage } from '@/lib/validation';

export const instant = false;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;

  const page = parsePage(resolvedParams.page);
  const sort = typeof resolvedParams.sort === 'string' ? resolvedParams.sort : 'priorities';
  const q = typeof resolvedParams.q === 'string' ? resolvedParams.q.trim() : '';

  const take = 10;
  const skip = (page - 1) * take;

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { description: { contains: q } },
            { type: { name: { contains: q } } },
            { variant: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] = [
    { priority: 'desc' },
    { createdAt: 'desc' },
  ];

  if (sort === 'newest') orderBy = { createdAt: 'desc' };
  if (sort === 'oldest') orderBy = { createdAt: 'asc' };

  const [totalItems, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      take,
      skip,
      include: { type: true, variant: true, images: true },
    }),
  ]);

  const totalPages = Math.ceil(totalItems / take) || 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#4A2E1B] tracking-tight">Product Catalog</h1>
          <p className="text-sm text-[#7A6251] mt-1">Manage your catalog, variants, and priority ordering.</p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl font-semibold text-sm hover:bg-[#3D2413] transition-colors shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
      </div>

      <div className="bg-[#FFFDF9] border border-[#EADBCC] rounded-2xl overflow-hidden shadow-xs">
        <form action="/products" method="GET" className="p-4 border-b border-[#EADBCC] flex flex-col sm:flex-row items-center gap-4 bg-[#FAF7F2]">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A69383]" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search products..."
              className="w-full pl-9 pr-4 py-2 bg-[#FFFDF9] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A69383] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B] transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative">
              <select
                name="sort"
                defaultValue={sort}
                className="appearance-none pl-9 pr-8 py-2 bg-[#FFFDF9] border border-[#EADBCC] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A2E1B] text-[#382213] font-medium cursor-pointer"
              >
                <option value="priorities">Sort by Priority</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6251]" />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl text-sm font-semibold hover:bg-[#3D2413] transition-colors shadow-xs"
            >
              Apply
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#FAF7F2] text-[#7A6251] font-semibold text-xs uppercase tracking-wider border-b border-[#EADBCC]">
              <tr>
                <th className="px-5 py-3.5">Priority (Drag)</th>
                <th className="px-5 py-3.5">Product Info</th>
                <th className="px-5 py-3.5">Pricing</th>
                <th className="px-5 py-3.5 text-center">Badges</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <ProductTableBody key={`${page}-${q}-${sort}`} initialProducts={products} />
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/products"
          params={{ q: q || undefined, sort: sort !== 'priorities' ? sort : undefined }}
          totalItems={totalItems}
          pageSize={take}
        />
      </div>
    </div>
  );
}
