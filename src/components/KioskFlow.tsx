'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCart, Plus, Minus, ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, Camera, X } from 'lucide-react';
import { submitKioskOrder } from '@/app/actions';
import { effectivePrice } from '@/lib/utils';

export interface KioskProduct {
  id: number;
  name: string;
  price: number;
  discountPrice?: number | null;
  stock: number;
  isBestSeller?: boolean;
  isFavorite?: boolean;
  type?: { id: number; name: string } | null;
  variant?: { id: number; name: string } | null;
  description?: string | null;
  images?: Array<{ url: string }> | null;
}

export default function KioskFlow({ products }: { products: KioskProduct[] }) {
  const [step, setStep] = useState<'start' | 'menu' | 'checkout' | 'biodata' | 'selfie' | 'success'>('start');
  const [cart, setCart] = useState<{ product: KioskProduct; quantity: number }[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<KioskProduct | null>(null);

  // Menu filters & horizontal pagination
  const [page, setPage] = useState(0);
  const [filterBestSeller, setFilterBestSeller] = useState(false);
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const ITEMS_PER_PAGE = 3;

  // Extract unique product types
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.type?.name) set.add(p.type.name);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterBestSeller && !p.isBestSeller) return false;
      if (filterFavorite && !p.isFavorite) return false;
      if (selectedType !== 'ALL' && p.type?.name !== selectedType) return false;
      return true;
    });
  }, [products, filterBestSeller, filterFavorite, selectedType]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));

  // Filter handlers that reset page to 0
  const handleToggleBestSeller = () => {
    setFilterBestSeller((prev) => !prev);
    setPage(0);
  };

  const handleToggleFavorite = () => {
    setFilterFavorite((prev) => !prev);
    setPage(0);
  };

  const handleSelectType = (t: string) => {
    setSelectedType(t);
    setPage(0);
  };

  // Safe page clamped to bounds
  const safePage = Math.min(page, Math.max(0, totalPages - 1));

  // Current page items (exactly 3 per page)
  const currentItems = useMemo(() => {
    const start = safePage * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, safePage]);

  const totalAmount = cart.reduce((sum, item) => sum + effectivePrice(item.product) * item.quantity, 0);
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: KioskProduct) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
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
          item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        );
      }
      return prev.filter((item) => item.product.id !== productId);
    });
  };

  const deleteFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        const maxWidth = 640;
        const width = video.videoWidth || maxWidth;
        const height = video.videoHeight || 480;
        const scale = Math.min(1, maxWidth / width);
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  useEffect(() => {
    let active = true;
    if (step === 'selfie' && !photo) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'user' } })
        .then((stream) => {
          if (!active) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((e) => {
          if (active) {
            console.error('Error accessing camera:', e);
            setError('Unable to access camera. You can still proceed without a photo.');
          }
        });
    } else {
      stopCamera();
    }
    return () => {
      active = false;
      stopCamera();
    };
  }, [step, photo, stopCamera]);

  const handleSubmit = async (overridePhoto?: string | null) => {
    setLoading(true);
    setError('');

    const photoToSend = overridePhoto !== undefined ? overridePhoto || '' : photo || '';

    try {
      const res = await submitKioskOrder({
        customerName: name,
        customerEmail: email,
        photoBase64: photoToSend,
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
      });

      if (res.success) {
        setStep('success');
      } else {
        setError(res.error || 'Failed to submit order');
      }
    } catch {
      setError('A system error occurred.');
    }
    setLoading(false);
  };

  const resetFlow = useCallback(() => {
    stopCamera();
    setStep('start');
    setCart([]);
    setName('');
    setEmail('');
    setPhoto(null);
    setError('');
    setPage(0);
    setFilterBestSeller(false);
    setFilterFavorite(false);
    setSelectedType('ALL');
    setSelectedProduct(null);
  }, [stopCamera]);

  // Inactivity auto-reset (60s idle timeout to protect customer data)
  useEffect(() => {
    if (step === 'start') return;
    if (step === 'success') {
      const timer = setTimeout(() => {
        resetFlow();
      }, 10000);
      return () => clearTimeout(timer);
    }

    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        resetFlow();
      }, 60000);
    };

    resetTimer();
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    return () => {
      clearTimeout(timeoutId);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [step, resetFlow]);

  // =========================================================================
  // 1. START SCREEN (Simple, minimal, warm beige & brown)
  // =========================================================================
  if (step === 'start') {
    return (
      <div
        className="h-[100dvh] w-full bg-[#FAF7F2] flex flex-col items-center justify-center p-6 select-none cursor-pointer"
        onClick={() => setStep('menu')}
      >
        <div className="flex flex-col items-center gap-6 max-w-xs sm:max-w-sm text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sorelin-secondary-lockup.png"
            alt="Sorelin"
            className="w-36 sm:w-44 md:w-52 h-auto object-contain drop-shadow-xs"
          />
          <button
            type="button"
            onClick={() => setStep('menu')}
            className="px-8 py-3 bg-[#4A2E1B] text-[#FFFDF9] hover:bg-[#3D2413] rounded-full text-xs font-semibold tracking-[0.2em] uppercase transition-all shadow-xs hover:shadow active:scale-95"
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. MENU SCREEN (Fixed screen height, 3 items per page, horizontal navigation)
  // =========================================================================
  if (step === 'menu') {
    return (
      <div className="h-[100dvh] w-full bg-[#FAF7F2] flex flex-col overflow-hidden select-none">
        {/* Top Header */}
        <header className="flex-shrink-0 h-13 sm:h-14 px-3 sm:px-6 border-b border-[#EADDCE] bg-[#FFFDF9] flex items-center justify-between z-10 shadow-xs">
          {/* Top Left: Back to Start */}
          <button
            type="button"
            onClick={() => setStep('start')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6E5748] hover:text-[#3B2314] hover:bg-[#F3ECE1] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Start</span>
          </button>

          {/* Top Center: Sorelin Logotype Cream */}
          <div className="flex items-center justify-center h-full py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sorelin-logotype-cream.png"
              alt="Sorelin"
              className="h-5 sm:h-6 md:h-7 w-auto object-contain"
            />
          </div>

          {/* Top Right: Cart Button */}
          <button
            type="button"
            onClick={() => cart.length > 0 && setStep('checkout')}
            disabled={cart.length === 0}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              cart.length > 0
                ? 'bg-[#4A2E1B] text-[#FFFDF9] hover:bg-[#3D2413] shadow-xs cursor-pointer active:scale-95'
                : 'bg-[#EDE4D8] text-[#A69383] cursor-not-allowed'
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Cart</span>
            {totalQuantity > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#FCE8B3] text-[#4A2E1B] text-[10px] font-bold">
                {totalQuantity}
              </span>
            )}
          </button>
        </header>

        {/* Center Main Area: 3 Items per page flanked by Previous and Next buttons */}
        <main className="flex-1 flex items-center justify-between px-2 sm:px-4 md:px-8 py-2 min-h-0 relative">
          {/* Previous Button */}
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 rounded-full border border-[#DCCFBE] bg-[#FFFDF9] text-[#4A2E1B] flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[#F3ECE1] transition-all shadow-xs z-10 active:scale-95"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* 3 Items Row (Foto - Nama - Harga only, center item highlighted with effect) */}
          <div className="flex-1 max-w-4xl mx-auto w-full h-full max-h-[calc(100dvh-112px)] flex items-center justify-center px-1.5 sm:px-4">
            {currentItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-8 w-full items-center justify-items-center">
                {currentItems.map((product, idx) => {
                  const isOutOfStock = product.stock <= 0;
                  const eff = effectivePrice(product);
                  const hasDiscount = Boolean(
                    product.discountPrice &&
                      product.discountPrice > 0 &&
                      product.discountPrice < product.price
                  );
                  // Highlight the center item
                  const isCenter = currentItems.length === 3 ? idx === 1 : idx === Math.floor(currentItems.length / 2);

                  return (
                    <div
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={`flex flex-col items-center text-center cursor-pointer transition-all duration-300 ease-out select-none group w-full max-w-[130px] sm:max-w-[170px] md:max-w-[210px] ${
                        isCenter
                          ? 'scale-105 sm:scale-110 z-20'
                          : 'scale-90 sm:scale-95 opacity-80 hover:opacity-100 hover:scale-100 z-10'
                      }`}
                    >
                      {/* Foto */}
                      <div
                        className={`relative w-full aspect-square max-h-[130px] sm:max-h-[170px] md:max-h-[210px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F3ECE1] transition-all duration-300 ${
                          isCenter
                            ? 'shadow-lg shadow-[#4A2E1B]/15 ring-2 ring-[#C69234]/50 group-hover:shadow-xl group-hover:ring-[#C69234]'
                            : 'shadow-xs group-hover:shadow-md'
                        }`}
                      >
                        {product.images?.[0]?.url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={product.images[0].url}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] sm:text-xs text-[#A69383]">
                            No Image
                          </div>
                        )}

                        {/* Sold out badge */}
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-[#2D1B0F]/65 flex items-center justify-center p-1">
                            <span className="bg-[#4A2E1B] text-[#FFFDF9] text-[8px] sm:text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Sold Out
                            </span>
                          </div>
                        )}

                        {/* Best seller / favorite indicator */}
                        {!isOutOfStock && (product.isBestSeller || product.isFavorite) && (
                          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                            {product.isBestSeller && (
                              <span className="px-1.5 py-0.5 rounded bg-[#FDF0D0] text-[#7A4E0B] text-[8px] font-bold uppercase tracking-wider border border-[#F2DB94]">
                                ★
                              </span>
                            )}
                            {product.isFavorite && (
                              <span className="px-1.5 py-0.5 rounded bg-[#FCEAE5] text-[#913B2E] text-[8px] font-bold uppercase tracking-wider border border-[#F7C6BC]">
                                ♥
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Nama */}
                      <h3
                        className={`font-semibold text-[#3B2314] mt-2 sm:mt-2.5 line-clamp-1 leading-tight transition-colors ${
                          isCenter ? 'text-xs sm:text-sm font-bold text-[#2D1B0F]' : 'text-[11px] sm:text-xs'
                        }`}
                      >
                        {product.name}
                      </h3>

                      {/* Harga */}
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span
                          className={`font-bold text-[#4A2E1B] ${
                            isCenter ? 'text-xs sm:text-sm text-[#3D2413]' : 'text-[11px] sm:text-xs'
                          }`}
                        >
                          Rp {eff.toLocaleString('id-ID')}
                        </span>
                        {hasDiscount && (
                          <span className="text-[9px] text-[#A69383] line-through">
                            Rp {product.price.toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="w-full py-12 text-center text-xs text-[#7A6251]">
                No items match your selected filter.
              </div>
            )}
          </div>

          {/* Next Button */}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 rounded-full border border-[#DCCFBE] bg-[#FFFDF9] text-[#4A2E1B] flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[#F3ECE1] transition-all shadow-xs z-10 active:scale-95"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </main>

        {/* Bottom Footer Bar: Filters */}
        <footer className="flex-shrink-0 h-13 sm:h-14 px-3 sm:px-6 border-t border-[#EADDCE] bg-[#FFFDF9] flex items-center justify-between gap-2 overflow-x-auto z-10">
          {/* Bottom Left: Filter by Best Seller & Favorite */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleToggleBestSeller}
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                filterBestSeller
                  ? 'bg-[#FDF0D0] text-[#7A4E0B] border-[#F2DB94]'
                  : 'bg-[#FAF7F2] text-[#755F50] border-[#E2D6C6] hover:bg-[#F3ECE1]'
              }`}
            >
              <span>★</span> Best Seller
            </button>
            <button
              type="button"
              onClick={handleToggleFavorite}
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                filterFavorite
                  ? 'bg-[#FCEAE5] text-[#913B2E] border-[#F7C6BC]'
                  : 'bg-[#FAF7F2] text-[#755F50] border-[#E2D6C6] hover:bg-[#F3ECE1]'
              }`}
            >
              <span>♥</span> Favorite
            </button>
          </div>

          {/* Page Dots / Indicator */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#8C7666] flex-shrink-0">
            <span>
              {safePage + 1} / {totalPages}
            </span>
          </div>

          {/* Bottom Right: Filter by Type */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0 py-1">
            <button
              type="button"
              onClick={() => handleSelectType('ALL')}
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-medium border whitespace-nowrap transition-colors ${
                selectedType === 'ALL'
                  ? 'bg-[#4A2E1B] text-[#FFFDF9] border-[#4A2E1B]'
                  : 'bg-[#FAF7F2] text-[#755F50] border-[#E2D6C6] hover:bg-[#F3ECE1]'
              }`}
            >
              All
            </button>
            {availableTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleSelectType(t)}
                className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-medium border whitespace-nowrap transition-colors ${
                  selectedType === t
                    ? 'bg-[#4A2E1B] text-[#FFFDF9] border-[#4A2E1B]'
                    : 'bg-[#FAF7F2] text-[#755F50] border-[#E2D6C6] hover:bg-[#F3ECE1]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </footer>

        {/* Detail Popup Modal (Gambar, Nama, Type, Variant, Desc, Tombol Add - Tanpa Harga) */}
        {selectedProduct && (
          <div
            className="fixed inset-0 z-50 bg-[#2D1B0F]/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedProduct(null)}
          >
            <div
              className="bg-[#FFFDF9] border border-[#EADBCC] rounded-3xl p-4 sm:p-6 w-full max-w-xs sm:max-w-sm max-h-[92dvh] overflow-y-auto shadow-xl flex flex-col relative animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full text-[#7A6251] hover:text-[#3B2314] hover:bg-[#F3ECE1] transition-colors z-10"
                aria-label="Close detail"
              >
                <X className="h-4 w-4" />
              </button>

              {/* 1. Gambar */}
              <div className="w-full max-h-[160px] sm:max-h-[200px] aspect-square rounded-2xl overflow-hidden bg-[#F3ECE1] relative flex-shrink-0 mx-auto">
                {selectedProduct.images?.[0]?.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={selectedProduct.images[0].url}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[#A69383]">
                    No Image
                  </div>
                )}
                {selectedProduct.stock <= 0 && (
                  <div className="absolute inset-0 bg-[#2D1B0F]/65 flex items-center justify-center p-1">
                    <span className="bg-[#4A2E1B] text-[#FFFDF9] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Sold Out
                    </span>
                  </div>
                )}
              </div>

              {/* 2. Nama */}
              <h3 className="text-sm sm:text-base font-bold text-[#3B2314] mt-3.5 tracking-tight">
                {selectedProduct.name}
              </h3>

              {/* 3. Type & Variant */}
              {(selectedProduct.type?.name || selectedProduct.variant?.name) && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {selectedProduct.type?.name && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FDF0D0] text-[#7A4E0B] border border-[#F2DB94]">
                      {selectedProduct.type.name}
                    </span>
                  )}
                  {selectedProduct.variant?.name && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F3ECE1] text-[#6E5748] border border-[#E2D6C6]">
                      {selectedProduct.variant.name}
                    </span>
                  )}
                </div>
              )}

              {/* 4. Desc (Description) */}
              <p className="text-xs text-[#7A6251] mt-2.5 leading-relaxed line-clamp-4">
                {selectedProduct.description || 'Crafted with fine ingredients for an authentic taste.'}
              </p>

              {/* 5. Tombol Add (Tanpa Harga di Detail) */}
              <button
                type="button"
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
                disabled={selectedProduct.stock <= 0}
                className="w-full mt-5 py-2.5 bg-[#4A2E1B] text-[#FFFDF9] hover:bg-[#3D2413] rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {selectedProduct.stock <= 0 ? 'Out of Stock' : '+ Add'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 3. CHECKOUT SCREEN (Simple, compact typography, warm palette)
  // =========================================================================
  if (step === 'checkout') {
    return (
      <div className="h-[100dvh] w-full bg-[#FAF7F2] flex flex-col overflow-hidden select-none">
        <header className="flex-shrink-0 h-13 sm:h-14 px-4 sm:px-6 border-b border-[#EADDCE] bg-[#FFFDF9] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep('menu')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6E5748] hover:text-[#3B2314] hover:bg-[#F3ECE1]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Menu</span>
          </button>
          <h2 className="text-xs sm:text-sm font-bold text-[#3B2314]">Review Order</h2>
          <div className="w-12"></div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-lg mx-auto w-full overflow-y-auto flex flex-col justify-between">
          <div className="bg-[#FFFDF9] rounded-xl border border-[#EADBCC] p-4 divide-y divide-[#F0EAE1]">
            {cart.map((item) => {
              const eff = effectivePrice(item.product);
              return (
                <div key={item.product.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="flex-1 pr-2">
                    <h4 className="text-xs font-semibold text-[#3B2314] line-clamp-1">{item.product.name}</h4>
                    <p className="text-[11px] text-[#7A6251] mt-0.5">
                      Rp {eff.toLocaleString('id-ID')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-[#FDF3D8] border border-[#F2DC9B] rounded-lg">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 text-[#4A2E1B] hover:bg-[#FBE8B8] rounded"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-bold text-[#4A2E1B] px-1.5">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => addToCart(item.product)}
                        className="p-1 text-[#4A2E1B] hover:bg-[#FBE8B8] rounded"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteFromCart(item.product.id)}
                      className="p-1 text-[#A69383] hover:text-red-600 rounded"
                      title="Remove item"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-[#EADDCE] space-y-3">
            <div className="flex justify-between items-center text-xs text-[#6B5344]">
              <span>Total Items</span>
              <span className="font-semibold">{totalQuantity}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-[#3B2314]">
              <span>Total Amount</span>
              <span className="text-base text-[#4A2E1B]">Rp {totalAmount.toLocaleString('id-ID')}</span>
            </div>

            <button
              type="button"
              onClick={() => setStep('biodata')}
              className="w-full py-2.5 bg-[#4A2E1B] text-[#FFFDF9] hover:bg-[#3D2413] rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs active:scale-95"
            >
              Continue to Details
            </button>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // 4. BIODATA SCREEN (Simple, compact typography, warm palette)
  // =========================================================================
  if (step === 'biodata') {
    return (
      <div className="h-[100dvh] w-full bg-[#FAF7F2] flex flex-col overflow-hidden select-none">
        <header className="flex-shrink-0 h-13 sm:h-14 px-4 sm:px-6 border-b border-[#EADDCE] bg-[#FFFDF9] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep('checkout')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6E5748] hover:text-[#3B2314] hover:bg-[#F3ECE1]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
          <h2 className="text-xs sm:text-sm font-bold text-[#3B2314]">Customer Details</h2>
          <div className="w-12"></div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-sm mx-auto w-full flex items-center">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep('selfie');
            }}
            className="bg-[#FFFDF9] rounded-xl border border-[#EADBCC] p-5 w-full space-y-4 shadow-xs"
          >
            <div>
              <label className="block text-xs font-semibold text-[#3B2314] mb-1">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Enter your name"
                className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E2D6C6] rounded-lg text-[#3B2314] placeholder-[#A69383] focus:outline-none focus:ring-1 focus:ring-[#4A2E1B] focus:border-[#4A2E1B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3B2314] mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={120}
                placeholder="email@example.com"
                className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E2D6C6] rounded-lg text-[#3B2314] placeholder-[#A69383] focus:outline-none focus:ring-1 focus:ring-[#4A2E1B] focus:border-[#4A2E1B]"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 bg-[#4A2E1B] text-[#FFFDF9] hover:bg-[#3D2413] rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              Next: Selfie Photo
            </button>
          </form>
        </main>
      </div>
    );
  }

  // =========================================================================
  // 5. SELFIE SCREEN (Simple, compact camera frame, warm palette)
  // =========================================================================
  if (step === 'selfie') {
    return (
      <div className="h-[100dvh] w-full bg-[#FAF7F2] flex flex-col overflow-hidden select-none">
        <header className="flex-shrink-0 h-13 sm:h-14 px-4 sm:px-6 border-b border-[#EADDCE] bg-[#FFFDF9] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setPhoto(null);
              setStep('biodata');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6E5748] hover:text-[#3B2314] hover:bg-[#F3ECE1] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
          <h2 className="text-xs sm:text-sm font-bold text-[#3B2314]">Customer Photo</h2>
          <div className="w-12"></div>
        </header>

        <main className="flex-1 p-4 max-w-sm mx-auto w-full flex flex-col items-center justify-center overflow-y-auto">
          {error && <p className="text-xs text-red-600 mb-2 text-center">{error}</p>}

          <div className="bg-[#FFFDF9] rounded-2xl p-2 border border-[#EADBCC] shadow-xs w-full max-w-[240px] aspect-[3/4] max-h-[45vh] relative overflow-hidden mb-3">
            {!photo ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-xl bg-[#2D1B0F]"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={photo} alt="Selfie" className="w-full h-full object-cover rounded-xl" />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {!photo ? (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={takePhoto}
                className="px-5 py-2.5 bg-[#4A2E1B] text-[#FFFDF9] hover:bg-[#3D2413] rounded-full text-xs font-semibold flex items-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5 text-[#FCE8B3]" />
                <span>Take Photo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  handleSubmit('');
                }}
                disabled={loading}
                className="text-[11px] text-[#7A6251] hover:text-[#3B2314] underline font-medium cursor-pointer"
              >
                Skip Photo & Submit Order →
              </button>
            </div>
          ) : (
            <div className="flex w-full max-w-[260px] gap-2">
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="flex-1 py-2 bg-[#FFFDF9] border border-[#EADBCC] text-[#6B5344] rounded-xl text-xs font-semibold hover:bg-[#F3ECE1] transition-colors cursor-pointer"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(photo)}
                disabled={loading}
                className="flex-1 py-2 bg-[#4A2E1B] text-[#FFFDF9] hover:bg-[#3D2413] rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {loading ? 'Submitting...' : 'Submit Order'}
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // =========================================================================
  // 6. SUCCESS SCREEN (Simple, gentle, warm completion)
  // =========================================================================
  if (step === 'success') {
    return (
      <div className="h-[100dvh] w-full bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-12 h-12 rounded-full bg-[#FDF0D0] text-[#7A4E0B] border border-[#F2DB94] flex items-center justify-center mb-4 shadow-xs">
          <CheckCircle className="h-6 w-6" />
        </div>

        <h2 className="text-base sm:text-lg font-bold text-[#3B2314] mb-1 tracking-tight">
          Order Received!
        </h2>
        <p className="text-xs text-[#7A6251] max-w-xs mb-6 leading-relaxed">
          Thank you, <span className="font-semibold text-[#3B2314]">{name}</span>. Please proceed to the cashier to complete your payment.
        </p>

        <button
          type="button"
          onClick={resetFlow}
          className="px-6 py-2.5 bg-[#4A2E1B] text-[#FFFDF9] hover:bg-[#3D2413] rounded-full text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          New Order
        </button>
      </div>
    );
  }

  return null;
}
