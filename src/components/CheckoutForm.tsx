'use client';

import { useState, useMemo } from 'react';
import { createTransaction } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { effectivePrice, formatRupiah } from '@/lib/utils';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import {
  Minus,
  Plus,
  ShoppingCart,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  PackageX,
  Sparkles,
  Package,
} from 'lucide-react';
import ItemCustomizerModal, {
  type CustomizableProduct,
  type CustomizationResult,
} from '@/components/ItemCustomizerModal';

export type Product = CustomizableProduct;

export interface CartItem {
  cartId: string;
  product: Product;
  quantity: number;
  variantOptionId?: number | null;
  selectedVariant?: string | null;
  selectedPrice?: number;
  isBundle?: boolean;
  bundleContents?: string | null;
  notes?: string | null;
}

export default function CheckoutForm({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Item customization modal state
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);

  // Search, Filter, Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  // Collect all available flavor variants across products for bundle customization
  const allAvailableVariants = useMemo(() => {
    return products.flatMap((p) => p.variants || []);
  }, [products]);

  const getProductCartQty = (productId: number) => {
    return cart
      .filter((item) => item.product.id === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const getItemPrice = (item: CartItem) => {
    return item.selectedPrice ?? effectivePrice(item.product);
  };

  const handleProductCardClick = (product: Product) => {
    const currentQty = getProductCartQty(product.id);
    const hasVariants = product.isBundle || Boolean(product.variants && product.variants.length > 0) || Boolean(product.availableVariants);
    if (!hasVariants && product.stock - currentQty <= 0) {
      window.alert(`Cannot add "${product.name}". Maximum available stock (${product.stock}) reached.`);
      return;
    }

    // If item has customizable flavor variants or is a bundle, open the customizer modal
    if (product.availableVariants || product.isBundle || (product.variants && product.variants.length > 0)) {
      setCustomizingProduct(product);
      return;
    }

    // Standard product without flavor variations
    const cartId = `${product.id}-standard`;
    const eff = effectivePrice(product);
    setCart((prev) => {
      const existing = prev.find((item) => item.cartId === cartId);
      if (existing) {
        return prev.map((item) =>
          item.cartId === cartId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          cartId,
          product,
          quantity: 1,
          variantOptionId: null,
          selectedVariant: null,
          selectedPrice: eff,
          isBundle: false,
          bundleContents: null,
          notes: null,
        },
      ];
    });
  };

  const handleCustomizerConfirm = (res: CustomizationResult) => {
    const cartId = `${res.product.id}-${res.variantOptionId || ''}-${res.selectedVariant || ''}-${res.bundleContents || ''}-${res.notes || ''}`;

    setCart((prev) => {
      const existing = prev.find((item) => item.cartId === cartId);
      if (existing) {
        return prev.map((item) =>
          item.cartId === cartId ? { ...item, quantity: item.quantity + res.quantity } : item
        );
      }
      return [
        ...prev,
        {
          cartId,
          product: res.product,
          quantity: res.quantity,
          variantOptionId: res.variantOptionId,
          selectedVariant: res.selectedVariant,
          selectedPrice: res.selectedPrice,
          isBundle: res.isBundle,
          bundleContents: res.bundleContents,
          notes: res.notes,
        },
      ];
    });

    setCustomizingProduct(null);
  };

  const removeFromCart = (cartId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.cartId === cartId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.cartId === cartId ? { ...item, quantity: item.quantity - 1 } : item
        );
      }
      return prev.filter((item) => item.cartId !== cartId);
    });
  };

  const incrementCartItem = (cartItem: CartItem) => {
    const currentTotal = getProductCartQty(cartItem.product.id);
    if (!cartItem.product.isBundle && currentTotal >= cartItem.product.stock) {
      window.alert(
        `Cannot add more "${cartItem.product.name}". Maximum available stock (${cartItem.product.stock}) reached.`
      );
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.cartId === cartItem.cartId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const totalAmount = cart.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Derived state for products
  const uniqueTypes = ['All', ...Array.from(new Set(products.map((p) => p.type?.name).filter(Boolean)))];

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = selectedType === 'All' || p.type?.name === selectedType;
    return matchSearch && matchType;
  });

  // 12 items per page fills a 2-column grid evenly (6 rows of 2)
  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage
  );

  const startItem = filteredProducts.length === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(safeCurrentPage * itemsPerPage, filteredProducts.length);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Product Customizer Modal (Flavors & Bundling) */}
      {customizingProduct && (
        <ItemCustomizerModal
          product={customizingProduct}
          maxAvailableStock={
            customizingProduct.isBundle
              ? 999
              : customizingProduct.stock - getProductCartQty(customizingProduct.id)
          }
          allAvailableVariants={allAvailableVariants}
          allProducts={products}
          onClose={() => setCustomizingProduct(null)}
          onConfirm={handleCustomizerConfirm}
        />
      )}

      {/* Product List (Left) */}
      <div className="flex-1 bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl flex flex-col shadow-xs min-h-[620px] h-[calc(100vh-8.5rem)]">
        {/* Toolbar */}
        <div className="p-4 border-b border-[#E5D5BC] bg-[#FFFDF8] flex flex-col sm:flex-row gap-3 items-center justify-between rounded-t-2xl">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E6D53]" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#8E6D53] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:bg-[#FFFDF8] transition-all"
            />
          </div>
          <div className="relative w-full sm:w-60">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none pl-10 pr-8 py-2 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:bg-[#FFFDF8] text-[#3F2311] transition-all font-semibold"
            >
              {uniqueTypes.map((t) => (
                <option key={t as string} value={t as string}>
                  {t === 'All' ? 'All Categories' : t}
                </option>
              ))}
            </select>
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E6D53]" />
          </div>
        </div>

        {/* Product Grid - Fixed 2 columns */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#FAF0DA]/35">
          {paginatedProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3.5">
              {paginatedProducts.map((product) => {
                const eff = effectivePrice(product);
                const hasDiscount = Boolean(
                  product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price
                );
                const currentCartQty = getProductCartQty(product.id);
                const remainingStock = product.stock - currentCartQty;
                const hasVariants = product.isBundle || Boolean(product.variants && product.variants.length > 0) || Boolean(product.availableVariants);
                const isOutOfStock = !hasVariants && remainingStock <= 0;

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && handleProductCardClick(product)}
                    className={`bg-[#FFFDF8] border rounded-2xl p-3.5 transition-all flex flex-col justify-between select-none ${
                      isOutOfStock
                        ? 'opacity-60 border-[#E5D5BC] cursor-not-allowed bg-[#FAF0DA]/50'
                        : 'border-[#E5D5BC] hover:border-[#6B4227] hover:shadow-md cursor-pointer active:scale-[0.99]'
                    }`}
                  >
                    {/* Top: Category Tag & Stock Pill */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1 overflow-hidden">
                        <span className="text-[10px] font-bold text-[#8E6D53] uppercase tracking-wider truncate max-w-[100px]">
                          {product.type?.name || 'General'}
                        </span>
                        {product.isBundle ? (
                          <span className="bg-[#6B4227] text-[#FAF0DA] text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-0.5">
                            <Package className="h-2.5 w-2.5" /> Bundle
                          </span>
                        ) : product.availableVariants ? (
                          <span className="bg-[#F3DBAA] text-[#6B4227] text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-0.5">
                            <Sparkles className="h-2.5 w-2.5" /> Flavors
                          </span>
                        ) : null}
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          product.isBundle
                            ? 'bg-[#FAF0DA] text-[#6B4227] border border-[#E5D5BC]'
                            : isOutOfStock
                              ? 'bg-[#FEF2F2] text-red-700 border border-[#FECACA]'
                              : remainingStock <= LOW_STOCK_THRESHOLD
                                ? 'bg-[#F3DBAA]/60 text-[#6B4227] border border-[#E5D5BC]'
                                : 'bg-[#F0FDF4] text-emerald-700 border border-[#DCFCE7]'
                        }`}
                      >
                        {product.isBundle ? 'Package' : isOutOfStock ? 'Sold Out' : `${remainingStock} left`}
                      </span>
                    </div>

                    {/* Thumbnail Image */}
                    {product.images?.[0]?.url && (
                      <div className="w-full h-24 mb-2 rounded-xl overflow-hidden bg-[#FAF0DA] border border-[#E5D5BC]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.images[0].url}
                          alt={product.name}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      </div>
                    )}

                    {/* Middle: Product Name */}
                    <h3 className="font-bold text-[#3F2311] text-sm line-clamp-2 leading-snug mb-3">
                      {product.name}
                    </h3>

                    {/* Bottom: Price */}
                    <div className="mt-auto pt-2 border-t border-[#E5D5BC]/60 flex items-baseline justify-between">
                      <div>
                        {product.variants && product.variants.length > 0 && Math.min(...product.variants.map((v) => v.price)) !== Math.max(...product.variants.map((v) => v.price)) ? (
                          <p className="text-sm font-bold text-[#6B4227]">
                            From {formatRupiah(Math.min(...product.variants.map((v) => v.price)))}
                          </p>
                        ) : (
                          <p className="text-sm font-bold text-[#6B4227]">{formatRupiah(eff)}</p>
                        )}
                        {hasDiscount && (
                          <p className="text-[11px] text-[#8E6D53] line-through">{formatRupiah(product.price)}</p>
                        )}
                      </div>
                      {currentCartQty > 0 && (
                        <span className="bg-[#6B4227] text-[#FAF0DA] text-[11px] font-bold px-2 py-0.5 rounded-md">
                          {currentCartQty}x
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#8E6D53] space-y-2 py-12">
              <PackageX className="h-10 w-10 text-[#D7C5AE]" />
              <p className="text-sm font-semibold text-[#6B4227]">No products match your filter.</p>
              {(searchQuery || selectedType !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedType('All');
                    setCurrentPage(1);
                  }}
                  className="text-xs text-[#C88A32] hover:underline pt-1 font-semibold cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 border-t border-[#E5D5BC] bg-[#FFFDF8] flex items-center justify-between text-xs text-[#8E6D53] rounded-b-2xl">
          <div>
            Showing <span className="font-semibold text-[#3F2311]">{startItem}–{endItem}</span> of{' '}
            <span className="font-semibold text-[#3F2311]">{filteredProducts.length}</span> items
            {totalPages > 1 && (
              <span className="text-[#8E6D53] ml-1.5">• Page {safeCurrentPage} of {totalPages}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="p-1.5 border border-[#E5D5BC] rounded-xl text-[#6B4227] hover:bg-[#FAF0DA] hover:text-[#3F2311] disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-bold text-[#3F2311]">
              {safeCurrentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="p-1.5 border border-[#E5D5BC] rounded-xl text-[#6B4227] hover:bg-[#FAF0DA] hover:text-[#3F2311] disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Cart / Checkout (Right) */}
      <div className="w-full lg:w-[390px] bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl shadow-xs flex flex-col min-h-[620px] h-[calc(100vh-8.5rem)] sticky top-6">
        <div className="p-4 border-b border-[#E5D5BC] flex items-center gap-3 bg-[#FAF0DA]/60 rounded-t-2xl">
          <ShoppingCart className="h-4 w-4 text-[#C88A32]" />
          <h2 className="text-base font-bold text-[#3F2311]">Current Order</h2>
          <span className="ml-auto bg-[#6B4227] text-[#FAF0DA] text-xs font-bold px-2.5 py-0.5 rounded-full">
            {totalItems} items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#8E6D53] space-y-2 py-10">
              <ShoppingCart className="h-8 w-8 text-[#D7C5AE]" />
              <p className="text-sm font-semibold text-[#6B4227]">Cart is empty</p>
              <p className="text-xs text-[#8E6D53]">Select products on the left to add them to this order</p>
            </div>
          ) : (
            cart.map((item) => {
              const unitPrice = getItemPrice(item);
              return (
                <div
                  key={item.cartId}
                  className="flex flex-col gap-1.5 pb-3 border-b border-[#E5D5BC]/60 last:border-0 last:pb-0"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-sm font-bold text-[#3F2311] leading-snug">{item.product.name}</p>
                      {item.selectedVariant && (
                        <span className="inline-block mt-0.5 text-[11px] font-semibold text-[#6B4227] bg-[#FAF0DA] px-2 py-0.5 rounded-md border border-[#E5D5BC]">
                          Flavor: {item.selectedVariant}
                        </span>
                      )}
                      {item.isBundle && item.bundleContents && (
                        <p className="mt-1 text-[11px] font-medium text-[#6B4227] bg-[#F3DBAA]/60 px-2 py-1 rounded-md border border-[#DFC082] leading-tight">
                          Bundle: {item.bundleContents}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-[11px] text-[#8E6D53] italic mt-0.5">&quot;{item.notes}&quot;</p>
                      )}
                    </div>
                    <p className="text-sm font-bold text-[#6B4227] whitespace-nowrap">
                      {formatRupiah(unitPrice * item.quantity)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-[#8E6D53]">@ {formatRupiah(unitPrice)}</p>
                    <div className="flex items-center gap-1.5 bg-[#FAF0DA]/60 rounded-xl p-1 border border-[#E5D5BC]">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.cartId)}
                        className="p-1 text-[#6B4227] hover:text-[#3F2311] hover:bg-[#FFFDF8] hover:shadow-xs rounded-lg transition-all cursor-pointer"
                        title="Decrease"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-bold w-6 text-center text-[#3F2311]">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => incrementCartItem(item)}
                        className="p-1 text-[#6B4227] hover:text-[#3F2311] hover:bg-[#FFFDF8] hover:shadow-xs rounded-lg transition-all cursor-pointer"
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

        <div className="p-4 border-t border-[#E5D5BC] bg-[#FFFDF8] space-y-3 rounded-b-2xl">
          <div className="flex justify-between items-center pb-2 border-b border-[#E5D5BC]/60">
            <span className="text-[#8E6D53] text-sm font-semibold">Total</span>
            <span className="text-xl font-bold text-[#6B4227]">{formatRupiah(totalAmount)}</span>
          </div>

          <ActionForm
            action={createTransaction}
            onSuccess={() => {
              setCart([]);
              setCustomerName('');
              setCustomerEmail('');
              setCustomerPhone('');
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="customer" className="block text-xs font-semibold text-[#6B4227] mb-1">
                Customer Name
              </label>
              <input
                type="text"
                id="customer"
                name="customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
                required
                maxLength={60}
                className="w-full px-3 py-2 bg-[#FAF0DA]/40 border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#8E6D53] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:bg-[#FFFDF8] transition-all font-medium"
              />
            </div>

            <div className="flex gap-2">
              <input
                type="email"
                id="customerEmail"
                name="customerEmail"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Enter customer email"
                maxLength={120}
                className="w-full px-3 py-2 bg-[#FAF0DA]/40 border border-[#E5D5BC] rounded-xl text-xs text-[#3F2311] placeholder-[#8E6D53] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:bg-[#FFFDF8] transition-all"
              />
              <input
                type="tel"
                id="customerPhone"
                name="customerPhone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Enter customer phone"
                maxLength={20}
                className="w-full px-3 py-2 bg-[#FAF0DA]/40 border border-[#E5D5BC] rounded-xl text-xs text-[#3F2311] placeholder-[#8E6D53] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:bg-[#FFFDF8] transition-all"
              />
            </div>

            <input
              type="hidden"
              name="items"
              value={JSON.stringify(
                cart.map((c) => ({
                  productId: c.product.id,
                  quantity: c.quantity,
                  variantOptionId: c.variantOptionId || undefined,
                  selectedVariant: c.selectedVariant || null,
                  isBundle: c.isBundle || false,
                  bundleContents: c.bundleContents || null,
                  notes: c.notes || null,
                }))
              )}
            />

            <SubmitButton
              pendingText="Creating Order..."
              disabled={cart.length === 0 || !customerName.trim()}
              className="w-full py-2.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl text-sm font-bold hover:bg-[#54311B] transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              Create Order
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
