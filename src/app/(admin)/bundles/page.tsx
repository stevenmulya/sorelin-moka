import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Plus, Search, Layers, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { formatRupiah } from '@/lib/utils';
import { parseBundleConfig, getBundleMaxStock, calculateBundlePriceStats } from '@/lib/bundle-config';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { deleteProduct } from '@/app/actions';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
export const instant = false;

export default async function BundlesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await connection();
  const resolvedParams = await searchParams;
  const q = resolvedParams.q?.trim() || '';

  const [bundles, singleProducts] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        isBundle: true,
        ...(q ? { name: { contains: q } } : {}),
      },
      include: {
        images: true,
      },
      orderBy: { priority: 'desc' },
    }),
    prisma.product.findMany({
      where: { isActive: true, isBundle: false },
      include: { type: true },
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#6B4227] tracking-tight">Bundles & Packages</h1>
          <p className="text-sm text-[#8E6D53] mt-1">
            Manage combo packages, bakery + drink sets, and customer selection quotas.
          </p>
        </div>
        <Link
          href="/bundles/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#6B4227] text-[#FAF0DA] rounded-xl font-semibold text-sm hover:bg-[#54311B] transition-colors shadow-xs"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          <span>Create Bundle</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#E5D5BC] pb-3">
        <Link
          href="/products"
          className="px-4 py-1.5 text-xs font-semibold rounded-xl text-[#8E6D53] hover:text-[#6B4227] hover:bg-[#FAF0DA] transition-colors"
        >
          Single Products
        </Link>
        <span className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-[#6B4227] text-[#FAF0DA] shadow-xs">
          Bundles & Packages ({bundles.length})
        </span>
      </div>

      <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl overflow-hidden shadow-xs">
        <form
          action="/bundles"
          method="GET"
          className="p-4 border-b border-[#E5D5BC] flex flex-col sm:flex-row items-center gap-4 bg-[#FAF0DA]/60"
        >
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9E826B]" strokeWidth={1.5} />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Enter bundle name"
              className="w-full pl-9 pr-4 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] transition-all"
            />
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF0DA] text-[#8E6D53] font-semibold text-xs border-b border-[#E5D5BC]">
              <tr>
                <th className="px-5 py-3.5">Bundle Name</th>
                <th className="px-5 py-3.5">Slot Rules & Composition</th>
                <th className="px-5 py-3.5">Connected Stock</th>
                <th className="px-5 py-3.5 text-right">Package Price</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5D5BC]/60">
              {bundles.map((bundle) => {
                const config = parseBundleConfig(bundle.availableVariants);
                const maxStock = getBundleMaxStock(bundle, singleProducts);
                const hasDiscConfig = typeof config.discountAmount === 'number';
                const stats = config.slots.length > 0
                  ? calculateBundlePriceStats(
                      config.slots,
                      hasDiscConfig ? (config.discountAmount ?? 0) : 0,
                      singleProducts
                    )
                  : null;

                return (
                  <tr key={bundle.id} className="hover:bg-[#FAF0DA]/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-[#FAF0DA] rounded-xl overflow-hidden flex-shrink-0 border border-[#E5D5BC]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={bundle.images?.[0]?.url || '/placeholder.jpg'}
                            alt={bundle.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-[#3F2311] text-sm">{bundle.name}</p>
                          <p className="text-xs text-[#8E6D53] line-clamp-1 mt-0.5">
                            {bundle.description || 'Combo package'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {config.slots.length > 0 ? (
                          config.slots.map((s, idx) => (
                            <span
                              key={s.id || idx}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                s.type === 'CATEGORY'
                                   ? 'bg-[#FAF0DA] text-[#6B4227] border-[#E5D5BC]'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {s.type === 'CATEGORY' ? (
                                <>
                                  <Layers className="h-3 w-3" strokeWidth={1.5} />
                                  <span>
                                    {s.quota}x{' '}
                                    {s.allowedProductNames && s.allowedProductNames.length > 0
                                      ? s.allowedProductNames
                                          .map((n) => n.replace(/^Salt Bread\s+/i, ''))
                                          .join(' / ')
                                      : s.categoryName}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>
                                    + {s.quantity}x {s.productName}
                                  </span>
                                </>
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#8E6D53]">
                            Select {bundle.bundleQuota || 3} flavors
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          maxStock > 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${maxStock > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {maxStock > 0 ? `${maxStock} sets available` : 'Out of Stock'}
                      </span>
                      <div className="text-[11px] text-[#8E6D53] mt-0.5">Linked to product stock</div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {stats && hasDiscConfig ? (
                        <div>
                          <div className="text-[#6B4227] font-semibold">
                            {stats.minFinalPrice === stats.maxFinalPrice
                              ? formatRupiah(stats.minFinalPrice)
                              : `${formatRupiah(stats.minFinalPrice)} – ${formatRupiah(stats.maxFinalPrice)}`}
                          </div>
                          {stats.discountAmount > 0 && (
                            <div className="text-[11px] text-amber-800 font-medium mt-0.5">
                              Save {formatRupiah(stats.discountAmount)}
                            </div>
                          )}
                          <div className="text-xs text-[#8E6D53] mt-0.5">
                            HPP:{' '}
                            {stats.minCostPrice === stats.maxCostPrice
                              ? formatRupiah(stats.minCostPrice)
                              : `${formatRupiah(stats.minCostPrice)} – ${formatRupiah(stats.maxCostPrice)}`}
                          </div>
                        </div>
                      ) : bundle.discountPrice ? (
                        <div>
                          <div className="text-[#6B4227] font-semibold">{formatRupiah(bundle.discountPrice)}</div>
                          <div className="text-xs text-[#8E6D53] mt-0.5 line-through">
                            {formatRupiah(bundle.price)}
                          </div>
                          <div className="text-xs text-[#8E6D53] mt-0.5">Cost: {formatRupiah(bundle.costPrice)}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-[#6B4227] font-semibold">{formatRupiah(bundle.price)}</div>
                          <div className="text-xs text-[#8E6D53] mt-0.5">Cost: {formatRupiah(bundle.costPrice)}</div>
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/bundles/${bundle.id}/edit`}
                          className="p-1.5 text-[#8E6D53] hover:text-[#6B4227] hover:bg-[#FAF0DA] rounded-lg transition-colors cursor-pointer"
                          title="Edit Bundle"
                        >
                          <Edit2 className="h-4 w-4" strokeWidth={1.5} />
                        </Link>
                        <ActionForm
                          action={deleteProduct}
                          confirmMessage={`Are you sure you want to archive bundle "${bundle.name}"?`}
                        >
                          <input type="hidden" name="id" value={bundle.id} />
                          <SubmitButton
                            pendingText="..."
                            className="p-1.5 text-[#8E6D53] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Archive Bundle"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </SubmitButton>
                        </ActionForm>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {bundles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#8E6D53]">
                    No bundles found. Click &quot;Create Bundle&quot; to build your first combo package.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
