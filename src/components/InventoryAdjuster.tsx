'use client';

import { useState } from 'react';
import { PackagePlus, PackageMinus, RefreshCcw, X } from 'lucide-react';
import { adjustStock } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';

type Product = {
  id: number;
  name: string;
  stock: number;
  variants?: Array<{
    id: number;
    name: string;
    stock: number;
  }>;
};

export default function InventoryAdjuster({ products }: { products: Product[] }) {
  const [activeTab, setActiveTab] = useState<'IN' | 'OUT' | 'RESET' | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const availableVariants = selectedProduct?.variants || [];

  if (!activeTab) {
    return (
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('IN')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-[#FFFDF8] rounded-xl font-semibold text-sm hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer"
        >
          <PackagePlus className="h-4 w-4" /> Stock In
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('OUT')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#C88A32] text-[#FFFDF8] rounded-xl font-semibold text-sm hover:bg-[#9E7324] transition-colors shadow-xs cursor-pointer"
        >
          <PackageMinus className="h-4 w-4" /> Stock Out
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('RESET')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl font-semibold text-sm hover:bg-[#54311B] transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCcw className="h-4 w-4" /> Reset Stock
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-6 shadow-xs relative">
      <button
        type="button"
        onClick={() => {
          setActiveTab(null);
          setSelectedProductId(null);
        }}
        className="absolute top-5 right-5 text-[#9E826B] hover:text-[#6B4227] p-1.5 rounded-lg transition-colors cursor-pointer"
      >
        <X className="h-5 w-5" />
      </button>

      <h2 className="text-base font-bold text-[#6B4227] mb-6 flex items-center gap-2">
        {activeTab === 'IN' && (
          <>
            <PackagePlus className="h-5 w-5 text-emerald-700" /> Stock In (Items Received / Freshly Baked)
          </>
        )}
        {activeTab === 'OUT' && (
          <>
            <PackageMinus className="h-5 w-5 text-[#C88A32]" /> Stock Out (Items Deducted / Spoiled)
          </>
        )}
        {activeTab === 'RESET' && (
          <>
            <RefreshCcw className="h-5 w-5 text-[#6B4227]" /> Reset Stock (Stock Opname)
          </>
        )}
      </h2>

      <ActionForm
        action={async (formData) => {
          const res = await adjustStock(formData);
          if (!res?.error) {
            setActiveTab(null);
            setSelectedProductId(null);
          }
          return res;
        }}
        className="space-y-4 max-w-2xl"
      >
        <input type="hidden" name="type" value={activeTab} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#8E6D53] mb-1.5">Select Product</label>
            <select
              name="productId"
              required
              value={selectedProductId ?? ''}
              onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3.5 py-2.5 bg-[#FAF0DA] border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#3F2311] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:bg-[#FFFDF8] transition-all"
            >
              <option value="">-- Select Product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Total Stock: {p.stock})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#8E6D53] mb-1.5">
              {activeTab === 'RESET' ? 'Set Stock To' : 'Quantity'}
            </label>
            <input
              type="number"
              name="quantity"
              min={activeTab === 'RESET' ? 0 : 1}
              placeholder="Enter stock quantity"
              required
              className="w-full px-3.5 py-2.5 bg-[#FAF0DA] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:bg-[#FFFDF8] transition-all font-semibold"
            />
          </div>
        </div>

        {availableVariants.length > 0 && (
          <div className="p-3.5 bg-[#FAF0DA]/50 rounded-xl border border-[#E5D5BC] space-y-1.5">
            <label className="block text-xs font-bold text-[#6B4227]">
              Select Flavor Variant / Baking Tray (Required)
            </label>
            <select
              name="variantOptionId"
              required
              className="w-full px-3.5 py-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#3F2311] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] transition-all"
            >
              <option value="">-- Choose Flavor Variant --</option>
              {availableVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} &bull; Tray Stock: {v.stock} pcs
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#8E6D53]">
              Products with flavors require adjusting specific flavor tray stock to maintain accurate inventory count.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#8E6D53] mb-1.5">Sender / Provider</label>
            <input
              type="text"
              name="giver"
              placeholder="Enter sender name"
              required={activeTab === 'IN'}
              className="w-full px-3.5 py-2.5 bg-[#FAF0DA] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:bg-[#FFFDF8] transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#8E6D53] mb-1.5">Receiver / Staff</label>
            <input
              type="text"
              name="receiver"
              placeholder="Enter receiver name"
              required={activeTab === 'OUT'}
              className="w-full px-3.5 py-2.5 bg-[#FAF0DA] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:bg-[#FFFDF8] transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#8E6D53] mb-1.5">Notes (Optional)</label>
          <input
            type="text"
            name="notes"
            placeholder="Enter adjustment notes"
            maxLength={200}
            className="w-full px-3.5 py-2.5 bg-[#FAF0DA] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:bg-[#FFFDF8] transition-all"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab(null);
              setSelectedProductId(null);
            }}
            className="px-5 py-2.5 border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#8E6D53] hover:bg-[#FAF0DA] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <SubmitButton
            pendingText="Saving..."
            className="px-5 py-2.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl text-sm font-semibold hover:bg-[#54311B] transition-colors shadow-xs cursor-pointer"
          >
            Confirm {activeTab === 'IN' ? 'Stock In' : activeTab === 'OUT' ? 'Stock Out' : 'Reset'}
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
