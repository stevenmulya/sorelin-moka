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
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <PackagePlus className="h-4 w-4" /> Stock In
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('OUT')} 
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg font-medium text-sm hover:bg-amber-700 transition-colors shadow-sm"
        >
          <PackageMinus className="h-4 w-4" /> Stock Out
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('RESET')} 
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm"
        >
          <RefreshCcw className="h-4 w-4" /> Reset Stock
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative">
      <button 
        type="button"
        onClick={() => setActiveTab(null)} 
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 p-1"
      >
        <X className="h-5 w-5" />
      </button>

      <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
        {activeTab === 'IN' && <><PackagePlus className="h-5 w-5 text-emerald-600" /> Stock In (Items Received)</>}
        {activeTab === 'OUT' && <><PackageMinus className="h-5 w-5 text-amber-600" /> Stock Out (Items Deducted)</>}
        {activeTab === 'RESET' && <><RefreshCcw className="h-5 w-5 text-gray-900" /> Reset Stock (Stock Opname)</>}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
            <select name="productId" required className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all">
              <option value="">-- Select Product --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {activeTab === 'RESET' ? 'Set Stock To' : 'Quantity'}
            </label>
            <input 
              type="number" 
              name="quantity" 
              min={activeTab === 'RESET' ? 0 : 1} 
              required 
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender / Provider</label>
            <input 
              type="text" 
              name="giver" 
              placeholder="Name or Supplier" 
              required={activeTab === 'IN'} 
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receiver</label>
            <input 
              type="text" 
              name="receiver" 
              placeholder="Name or Cashier" 
              required={activeTab === 'OUT'} 
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all" 
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Reason (Optional)</label>
          <input 
            type="text" 
            name="notes" 
            placeholder="e.g. damaged, purchased from supplier..." 
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all" 
          />
        </div>

        <SubmitButton 
          pendingText="Saving..."
          className={`w-full py-2.5 rounded-lg font-medium text-sm text-white transition-colors mt-2 ${
            activeTab === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' :
            activeTab === 'OUT' ? 'bg-amber-600 hover:bg-amber-700' :
            'bg-gray-900 hover:bg-gray-800'
          }`}
        >
          Save Stock Adjustment
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
