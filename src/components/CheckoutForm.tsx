'use client';

import { useState } from 'react';
import { createTransaction } from '@/app/actions';
import { Minus, Plus, ShoppingCart, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
  type?: { name: string } | null;
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
          alert(`Cannot add more ${product.name}. Max stock reached!`);
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

  const totalAmount = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Derived state for products
  const uniqueTypes = ['All', ...Array.from(new Set(products.map(p => p.type?.name).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = selectedType === 'All' || (p.type?.name === selectedType);
    return matchSearch && matchType;
  });

  const itemsPerPage = 9;
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Ensure page resets if filter makes it out of bounds
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Product List (Left) */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl flex flex-col shadow-sm min-h-[700px] h-[calc(100vh-8rem)]">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-white flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search menus..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-all"
            />
          </div>
          <div className="relative w-full sm:w-64">
            <select 
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white text-gray-700 transition-all"
            >
              {uniqueTypes.map(t => (
                <option key={t as string} value={t as string}>{t === 'All' ? 'All Categories' : t}</option>
              ))}
            </select>
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50">
          {paginatedProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {paginatedProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-gray-400 hover:shadow-sm transition-all flex flex-col justify-between min-h-[110px]"
                >
                  <h3 className="font-medium text-gray-800 text-sm mb-2">{product.name}</h3>
                  <div className="flex justify-between items-end mt-auto">
                    <p className="text-sm text-gray-600">Rp {product.price.toLocaleString('id-ID')}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-md ${
                      (product.stock - (cart.find(c => c.product.id === product.id)?.quantity || 0)) <= 5 
                        ? 'bg-red-50 text-red-600' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {product.stock - (cart.find(c => c.product.id === product.id)?.quantity || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              No products found matching your search.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-gray-200 bg-white flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Cart / Checkout (Right) */}
      <div className="w-full lg:w-[380px] bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col min-h-[700px] h-[calc(100vh-8rem)] sticky top-6">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-gray-50/50">
          <ShoppingCart className="h-4 w-4 text-gray-600" />
          <h2 className="text-base font-medium text-gray-800">Current Order</h2>
          <span className="ml-auto bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full border border-gray-200">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
              <ShoppingCart className="h-8 w-8 text-gray-300" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex flex-col gap-2 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-medium text-gray-800 pr-4">{item.product.name}</p>
                  <p className="text-sm text-gray-800 whitespace-nowrap">Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">@ Rp {item.product.price.toLocaleString('id-ID')}</p>
                  <div className="flex items-center gap-2 bg-gray-50 rounded p-1 border border-gray-200">
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1 text-gray-500 hover:bg-white hover:shadow-sm rounded transition-all"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm w-5 text-center text-gray-700">{item.quantity}</span>
                    <button
                      onClick={() => addToCart(item.product)}
                      className="p-1 text-gray-500 hover:bg-white hover:shadow-sm rounded transition-all"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-500 text-sm">Total</span>
            <span className="text-lg font-semibold text-gray-900">
              Rp {totalAmount.toLocaleString('id-ID')}
            </span>
          </div>

          <form action={createTransaction} className="space-y-3">
            <div>
              <input
                type="text"
                id="customer"
                name="customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name (Required)"
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-all"
              />
            </div>
            
            <div className="flex gap-2">
              <input
                type="email"
                id="customerEmail"
                name="customerEmail"
                placeholder="Email (Required)"
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-all"
              />
              <input
                type="tel"
                id="customerPhone"
                name="customerPhone"
                placeholder="Phone (Optional)"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-all"
              />
            </div>
            
            <input type="hidden" name="totalAmount" value={totalAmount} />
            <input 
              type="hidden" 
              name="items" 
              value={JSON.stringify(cart.map(c => ({
                productId: c.product.id,
                productName: c.product.name,
                quantity: c.quantity,
                price: c.product.price
              })))} 
            />
            
            <button
              type="submit"
              disabled={cart.length === 0 || !customerName}
              className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              Create Order
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
