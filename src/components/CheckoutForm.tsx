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

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Ensure page resets if filter makes it out of bounds
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Product List (Left) */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl flex flex-col shadow-sm overflow-hidden h-[calc(100vh-12rem)]">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
            />
          </div>
          <div className="relative w-full sm:w-48">
            <select 
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-700 font-medium"
            >
              {uniqueTypes.map(t => (
                <option key={t as string} value={t as string}>{t as string}</option>
              ))}
            </select>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {paginatedProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {paginatedProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-gray-900 hover:shadow-sm transition-all"
                >
                  <h3 className="font-medium text-gray-900">{product.name}</h3>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-sm text-gray-500">Rp {product.price.toLocaleString('id-ID')}</p>
                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${product.stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                      Stock: {product.stock}
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
        <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

      </div>

      {/* Cart / Checkout (Right) */}
      <div className="w-full lg:w-96 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col h-[calc(100vh-12rem)] sticky top-6">
        <div className="p-6 border-b border-gray-200 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-gray-900" />
          <h2 className="text-lg font-semibold text-gray-900">Current Order</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Cart is empty
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-900">{item.product.name}</p>
                  <p className="text-xs text-gray-500">Rp {item.product.price.toLocaleString('id-ID')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1 text-gray-500 hover:bg-gray-100 rounded-md"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                  <button
                    onClick={() => addToCart(item.product)}
                    className="p-1 text-gray-500 hover:bg-gray-100 rounded-md"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50/50">
          <div className="flex justify-between items-center mb-6">
            <span className="text-gray-500 font-medium">Total Amount</span>
            <span className="text-xl font-bold text-gray-900">
              Rp {totalAmount.toLocaleString('id-ID')}
            </span>
          </div>

          <form action={createTransaction} className="space-y-4">
            <div>
              <label htmlFor="customer" className="block text-xs font-medium text-gray-700 mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="customer"
                name="customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Budi Santoso"
                required
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
              />
            </div>
            
            <div>
              <label htmlFor="customerEmail" className="block text-xs font-medium text-gray-700 mb-1">
                Customer Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="customerEmail"
                name="customerEmail"
                placeholder="e.g. budi@example.com"
                required
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="customerPhone" className="block text-xs font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="customerPhone"
                name="customerPhone"
                placeholder="08123456789"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
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
              className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Transaction
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
