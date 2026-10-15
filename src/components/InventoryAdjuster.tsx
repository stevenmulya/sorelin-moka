'use client';

import { useState } from 'react';
import { PackagePlus, PackageMinus, RefreshCcw, X } from 'lucide-react';
import { adjustStock } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';

type Product = {
  id: number;
  name: string;
  stock: number;
};

export default function InventoryAdjuster({ products }: { products: Product[] }) {
  const [activeTab, setActiveTab] = useState<'IN' | 'OUT' | 'RESET' | null>(null);

  if (!activeTab) {
    return (
      <div className="flex flex-wrap gap-4">
        <button 
          type="button"
          onClick={() => setActiveTab('IN')} 
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-[#FFFDF9] rounded-xl font-semibold text-sm hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer"
        >
          <PackagePlus className="h-4 w-4" /> Stock In
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('OUT')} 
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#C69234] text-[#FFFDF9] rounded-xl font-semibold text-sm hover:bg-[#9E7324] transition-colors shadow-xs cursor-pointer"
        >
          <PackageMinus className="h-4 w-4" /> Stock Out
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('RESET')} 
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl font-semibold text-sm hover:bg-[#3D2413] transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCcw className="h-4 w-4" /> Reset Stock
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#FFFDF9] border border-[#EADBCC] rounded-2xl p-6 shadow-xs relative">
      <button 
        type="button"
        onClick={() => setActiveTab(null)} 
        className="absolute top-5 right-5 text-[#A89687] hover:text-[#4A2E1B] p-1.5 rounded-lg transition-colors cursor-pointer"
      >
        <X className="h-5 w-5" />
      </button>

      <h2 className="text-base font-bold text-[#4A2E1B] mb-6 flex items-center gap-2">
        {activeTab === 'IN' && <><PackagePlus className="h-5 w-5 text-emerald-700" /> Stock In (Items Received)</>}
        {activeTab === 'OUT' && <><PackageMinus className="h-5 w-5 text-[#C69234]" /> Stock Out (Items Deducted)</>}
        {activeTab === 'RESET' && <><RefreshCcw className="h-5 w-5 text-[#4A2E1B]" /> Reset Stock (Stock Opname)</>}
      </h2>

      <ActionForm 
        action={async (formData) => {
          const res = await adjustStock(formData);
          if (!res?.error) {
            setActiveTab(null);
          }
          return res;
        }} 
        className="space-y-4 max-w-2xl"
      >
        <input type="hidden" name="type" value={activeTab} />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Select Product</label>
            <select name="productId" required className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm font-semibold text-[#382213] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B] focus:bg-[#FFFDF9] transition-all">
              <option value="">-- Select Product --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">
              {activeTab === 'RESET' ? 'Set Stock To' : 'Quantity'}
            </label>
            <input 
              type="number" 
              name="quantity" 
              min={activeTab === 'RESET' ? 0 : 1} 
              required 
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B] focus:bg-[#FFFDF9] transition-all font-semibold" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Sender / Provider</label>
            <input 
              type="text" 
              name="giver" 
              placeholder="Name or Supplier" 
              required={activeTab === 'IN'} 
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B] focus:bg-[#FFFDF9] transition-all" 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Receiver</label>
            <input 
              type="text" 
              name="receiver" 
              placeholder="Name or Cashier" 
              required={activeTab === 'OUT'} 
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B] focus:bg-[#FFFDF9] transition-all" 
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Notes / Reason (Optional)</label>
          <input 
            type="text" 
            name="notes" 
            placeholder="e.g. damaged, purchased from supplier..." 
            className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B] focus:bg-[#FFFDF9] transition-all" 
          />
        </div>

        <SubmitButton 
          pendingText="Saving..."
          className={`w-full py-2.5 rounded-xl font-semibold text-sm text-[#FFFDF9] transition-colors mt-2 shadow-xs cursor-pointer ${
            activeTab === 'IN' ? 'bg-emerald-700 hover:bg-emerald-800' :
            activeTab === 'OUT' ? 'bg-[#C69234] hover:bg-[#9E7324]' :
            'bg-[#4A2E1B] hover:bg-[#3D2413]'
          }`}
        >
          Save Stock Adjustment
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
