'use client';

import { useState } from 'react';
import { createTransaction } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { effectivePrice } from '@/lib/utils';
import { Minus, Plus, ShoppingCart, Search, Filter, ChevronLeft, ChevronRight, PackageX } from 'lucide-react';

type Product = {
  id: number;
  name: string;
  price: number;
  discountPrice?: number | null;
  stock: number;
  type?: { name: string } | null;
  images?: Array<{ url: string }> | null;
};

export default function CheckoutForm({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [customerName, setCustomerName] = useState('');
  
  // Search, Filter, Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert(`Cannot add ${product.name}. Out of stock!`);
      return;
    }
    
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Cannot add more ${product.name}. Max stock (${product.stock}) reached!`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }
      return prev.filter((item) => item.product.id !== productId);
    });
  };

  const totalAmount = cart.reduce((sum, item) => sum + effectivePrice(item.product) * item.quantity, 0);

  // Derived state for products
  const uniqueTypes = ['All', ...Array.from(new Set(products.map(p => p.type?.name).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = selectedType === 'All' || (p.type?.name === selectedType);
    return matchSearch && matchType;
  });

  // 12 items per page fills a 2-column grid evenly (6 rows of 2)
  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  const startItem = filteredProducts.length === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(safeCurrentPage * itemsPerPage, filteredProducts.length);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Product List (Left) */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl flex flex-col shadow-sm min-h-[620px] h-[calc(100vh-8.5rem)]">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-white flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search menu or item..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all"
            />
          </div>
          <div className="relative w-full sm:w-60">
            <select 
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white text-gray-700 transition-all font-medium"
            >
              {uniqueTypes.map(t => (
                <option key={t as string} value={t as string}>{t === 'All' ? 'All Categories' : t}</option>
              ))}
            </select>
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Product Grid - Fixed 2 columns */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/40">
          {paginatedProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3.5">
              {paginatedProducts.map((product) => {
                const eff = effectivePrice(product);
                const hasDiscount = Boolean(product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price);
                const currentCartQty = cart.find(c => c.product.id === product.id)?.quantity || 0;
                const remainingStock = product.stock - currentCartQty;
                const isOutOfStock = remainingStock <= 0;

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && addToCart(product)}
                    className={`bg-white border rounded-xl p-3.5 transition-all flex flex-col justify-between select-none ${
                      isOutOfStock
                        ? 'opacity-60 border-gray-200 cursor-not-allowed bg-gray-50/60'
                        : 'border-gray-200/90 hover:border-gray-900 hover:shadow-md cursor-pointer active:scale-[0.99]'
                    }`}
                  >
                    {/* Top: Category Tag & Stock Pill */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider truncate max-w-[120px]">
                        {product.type?.name || 'Item'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOutOfStock
                          ? 'bg-red-100 text-red-700'
                          : remainingStock <= 5
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>
                        {isOutOfStock ? 'Sold Out' : `${remainingStock} left`}
                      </span>
                    </div>

                    {/* Thumbnail Image (if available) */}
                    {product.images?.[0]?.url && (
                      <div className="w-full h-24 mb-2 rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={product.images[0].url} 
                          alt={product.name} 
                          className="w-full h-full object-cover pointer-events-none" 
                        />
                      </div>
                    )}

                    {/* Middle: Product Name */}
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug mb-3">
                      {product.name}
                    </h3>

                    {/* Bottom: Price */}
                    <div className="mt-auto pt-2 border-t border-gray-100 flex items-baseline justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          Rp {eff.toLocaleString('id-ID')}
                        </p>
                        {hasDiscount && (
                          <p className="text-[11px] text-gray-400 line-through">
                            Rp {product.price.toLocaleString('id-ID')}
                          </p>
                        )}
                      </div>
                      {currentCartQty > 0 && (
                        <span className="bg-gray-900 text-white text-[11px] font-bold px-2 py-0.5 rounded-md">
                          {currentCartQty}x
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 py-12">
              <PackageX className="h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No products match your search.</p>
              {(searchQuery || selectedType !== 'All') && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSelectedType('All'); setCurrentPage(1); }}
                  className="text-xs text-blue-600 hover:underline pt-1"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 border-t border-gray-200 bg-white flex items-center justify-between text-xs text-gray-600">
          <div>
            Showing <span className="font-semibold text-gray-900">{startItem}–{endItem}</span> of{' '}
            <span className="font-semibold text-gray-900">{filteredProducts.length}</span> items
            {totalPages > 1 && (
              <span className="text-gray-400 ml-1.5">• Page {safeCurrentPage} of {totalPages}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-semibold text-gray-700">
              {safeCurrentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Cart / Checkout (Right) */}
      <div className="w-full lg:w-[380px] bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col min-h-[620px] h-[calc(100vh-8.5rem)] sticky top-6">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-gray-50/50">
          <ShoppingCart className="h-4 w-4 text-gray-600" />
          <h2 className="text-base font-semibold text-gray-800">Current Order</h2>
          <span className="ml-auto bg-gray-900 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 py-10">
              <ShoppingCart className="h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium">Cart is empty</p>
              <p className="text-xs text-gray-400">Select items on the left to add to order</p>
            </div>
          ) : (
            cart.map((item) => {
              const eff = effectivePrice(item.product);
              return (
                <div key={item.product.id} className="flex flex-col gap-2 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-gray-800 pr-4">{item.product.name}</p>
                    <p className="text-sm font-bold text-gray-900 whitespace-nowrap">
                      Rp {(eff * item.quantity).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">@ Rp {eff.toLocaleString('id-ID')}</p>
                    <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 text-gray-600 hover:bg-white hover:shadow-sm rounded transition-all"
                        title="Decrease"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-bold w-6 text-center text-gray-800">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => addToCart(item.product)}
                        className="p-1 text-gray-600 hover:bg-white hover:shadow-sm rounded transition-all"
                        title="Increase"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-white space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <span className="text-gray-500 text-sm font-medium">Total</span>
            <span className="text-xl font-black text-gray-900">
              Rp {totalAmount.toLocaleString('id-ID')}
            </span>
          </div>

          <ActionForm action={createTransaction} className="space-y-3">
            <div>
              <label htmlFor="customer" className="block text-xs font-semibold text-gray-700 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                id="customer"
                name="customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name..."
                required
                maxLength={60}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all font-medium"
              />
            </div>
            
            <div className="flex gap-2">
              <input
                type="email"
                id="customerEmail"
                name="customerEmail"
                placeholder="Email (Optional)"
                maxLength={120}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all"
              />
              <input
                type="tel"
                id="customerPhone"
                name="customerPhone"
                placeholder="Phone (Optional)"
                maxLength={20}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all"
              />
            </div>
            
            <input 
              type="hidden" 
              name="items" 
              value={JSON.stringify(cart.map(c => ({
                productId: c.product.id,
                quantity: c.quantity
              })))} 
            />
            
            <SubmitButton
              pendingText="Creating Order..."
              disabled={cart.length === 0 || !customerName.trim()}
              className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-all shadow-sm"
            >
              Create Order
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
