'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Plus,
  Minus,
  ArrowLeft,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Camera,
  Upload,
  X,
} from 'lucide-react';
import { submitKioskOrder } from '@/app/actions';
import { effectivePrice, formatRupiah } from '@/lib/utils';

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
  const router = useRouter();
  const [step, setStep] = useState<'start' | 'menu' | 'checkout' | 'biodata' | 'selfie' | 'success'>('start');
  const [cart, setCart] = useState<{ product: KioskProduct; quantity: number }[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [orderCode, setOrderCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<KioskProduct | null>(null);
  const [detailImgIdx, setDetailImgIdx] = useState(0);

  // Menu filters & horizontal pagination
  const [page, setPage] = useState(0);
  const [filterBestSeller, setFilterBestSeller] = useState(false);
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const ITEMS_PER_PAGE = 12;

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

  // Safe page clamped to bounds
  const safePage = Math.min(page, Math.max(0, totalPages - 1));

  // Page change handler with smooth scroll to top
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Filter handlers that reset page to 0 and scroll to top
  const handleToggleBestSeller = () => {
    setFilterBestSeller((prev) => !prev);
    setPage(0);
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleFavorite = () => {
    setFilterFavorite((prev) => !prev);
    setPage(0);
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectType = (t: string) => {
    setSelectedType(t);
    setPage(0);
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Generate pagination page numbers with smart ellipsis windowing
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    const curr = safePage + 1; // 1-indexed

    if (curr <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages);
    } else if (curr >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', curr - 1, curr, curr + 1, '...', totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  // Current page items (up to 12 items per page)
  const currentItems = useMemo(() => {
    const start = safePage * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, safePage]);

  const totalAmount = cart.reduce((sum, item) => sum + effectivePrice(item.product) * item.quantity, 0);
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  const getCartQuantity = useCallback(
    (productId: number) => cart.find((item) => item.product.id === productId)?.quantity ?? 0,
    [cart]
  );

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
      const next =
        existing && existing.quantity > 1
          ? prev.map((item) =>
              item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item
            )
          : prev.filter((item) => item.product.id !== productId);
      if (next.length === 0 && step === 'checkout') {
        setStep('menu');
      }
      return next;
    });
  };

  const deleteFromCart = (productId: number) => {
    setCart((prev) => {
      const next = prev.filter((item) => item.product.id !== productId);
      if (next.length === 0 && step === 'checkout') {
        setStep('menu');
      }
      return next;
    });
  };

  const stopTracks = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopTracks();
    setCameraReady(false);
  }, [stopTracks]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setError('Camera is still initializing. Please wait a moment or upload a photo.');
      return;
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    const maxWidth = 480;
    const scale = Math.min(1, maxWidth / width);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      setError('Failed to capture photo from camera. Please try again or skip.');
      return;
    }

    setError('');
    setPhoto(dataUrl);
    stopCamera();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const maxWidth = 480;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (dataUrl.startsWith('data:image/')) {
          setError('');
          setPhoto(dataUrl);
          stopCamera();
        }
      };
      img.onerror = () => setError('Unable to read the selected image.');
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.onerror = () => setError('Unable to read the selected file.');
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (step !== 'selfie' || photo) {
      return;
    }

    let active = true;

    const requestStream = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API unavailable');
      }
      try {
        return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      } catch {
        return await navigator.mediaDevices.getUserMedia({ video: true });
      }
    };

    requestStream()
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (active) {
          setCameraReady(false);
          setCameraError('Live camera is unavailable. You can upload a photo from your device or skip this step.');
        }
      });

    return () => {
      active = false;
      stopTracks();
    };
  }, [step, photo, stopTracks]);

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
        setOrderCode(res.transactionCode);
        setStep('success');
      } else {
        setError(res.error || 'Failed to submit order. Please try again.');
        router.refresh();
      }
    } catch {
      setError('A network or system error occurred. Please try again.');
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
    setOrderCode('');
    setError('');
    setCameraError('');
    setPage(0);
    setFilterBestSeller(false);
    setFilterFavorite(false);
    setSelectedType('ALL');
    setSelectedProduct(null);
    setDetailImgIdx(0);
    router.refresh();
  }, [stopCamera, router]);

  // Inactivity auto-reset (60s idle timeout to protect customer data)
  useEffect(() => {
    if (step === 'start' || loading) return;
    if (step === 'success') {
      const timer = setTimeout(() => {
        resetFlow();
      }, 12000);
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
  }, [step, loading, resetFlow]);

  // =========================================================================
  // 1. START SCREEN
  // =========================================================================
  if (step === 'start') {
    return (
      <div
        className="h-[100dvh] w-full bg-[#FAF0DA] flex flex-col items-center justify-center p-6 select-none cursor-pointer"
        onClick={() => setStep('menu')}
      >
        <div className="flex flex-col items-center gap-6 max-w-xs sm:max-w-sm text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sorelin-lockup-primary.png"
            alt="Sorelin Bakery"
            className="w-44 sm:w-52 md:w-60 h-auto object-contain"
          />
          <button
            type="button"
            onClick={() => setStep('menu')}
            className="px-8 py-3.5 bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] border-2 border-[#6B4227] rounded-sm font-handwriting text-lg font-bold tracking-widest uppercase transition-all duration-150 ease-out shadow-[4px_4px_0px_#6B4227] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#6B4227] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none cursor-pointer"
          >
            Tap to Order
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. MENU SCREEN (KOREAN BAKERY 2-COLOR & TORN PAPER SLIP DESIGN)
  // =========================================================================
  if (step === 'menu') {
    const selectedCartQty = selectedProduct ? getCartQuantity(selectedProduct.id) : 0;
    const selectedAtMaxStock = selectedProduct ? selectedCartQty >= selectedProduct.stock : false;
    const selectedImages = selectedProduct?.images ?? [];

    return (
      <div className="h-[100dvh] w-full bg-[#FAF0DA] flex flex-col overflow-hidden select-none">
        {/* Top Header */}
        <header className="flex-shrink-0 h-14 sm:h-16 px-3 sm:px-6 border-b-2 border-[#6B4227] bg-[#FAF0DA] flex items-center justify-between z-20">
          {/* Top Left: Back to Start */}
          <button
            type="button"
            onClick={() => setStep('start')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-bold font-handwriting text-[#6B4227] border-2 border-[#6B4227] bg-[#FAF0DA] hover:bg-[#6B4227] hover:text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 ease-out cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Start Over</span>
            <span className="sm:hidden">Start</span>
          </button>

          {/* Top Center: Sorelin Logotype Brown */}
          <div className="flex items-center justify-center h-full py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sorelin-logo-brown.png"
              alt="Sorelin Bakery"
              className="h-7 sm:h-8 md:h-9 w-auto object-contain"
            />
          </div>

          {/* Top Right: Cart Button */}
          <button
            type="button"
            onClick={() => cart.length > 0 && setStep('checkout')}
            disabled={cart.length === 0}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-sm font-handwriting text-sm font-bold transition-all duration-150 ease-out border-2 border-[#6B4227] ${
              cart.length > 0
                ? 'bg-[#6B4227] text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer'
                : 'bg-[#FAF0DA] text-[#6B4227]/40 border-[#6B4227]/40 cursor-not-allowed'
            }`}
            aria-label="View shopping cart"
          >
            <ShoppingCart className="h-4 w-4 stroke-[2.5]" />
            <span>Order Bag</span>
            {totalQuantity > 0 && (
              <span className="px-1.5 py-0.2 rounded-sm bg-[#FAF0DA] text-[#6B4227] border border-[#6B4227] text-xs font-extrabold">
                {totalQuantity}
              </span>
            )}
          </button>
        </header>

        {/* Category & Filter Navigation Bar */}
        <div className="flex-shrink-0 bg-[#FAF0DA] border-b-2 border-[#6B4227] px-3 sm:px-6 py-2 z-10">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
            {/* Left: Type / Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => handleSelectType('ALL')}
                className={`px-3.5 py-1 rounded-sm font-handwriting text-sm font-bold whitespace-nowrap transition-all duration-150 ease-out border-2 border-[#6B4227] cursor-pointer ${
                  selectedType === 'ALL'
                    ? 'bg-[#6B4227] text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
                    : 'bg-[#FAF0DA] text-[#6B4227] hover:bg-[#6B4227]/10 hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px]'
                }`}
              >
                All Items
              </button>
              {availableTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleSelectType(t)}
                  className={`px-3.5 py-1 rounded-sm font-handwriting text-sm font-bold whitespace-nowrap transition-all duration-150 ease-out border-2 border-[#6B4227] cursor-pointer ${
                    selectedType === t
                      ? 'bg-[#6B4227] text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
                      : 'bg-[#FAF0DA] text-[#6B4227] hover:bg-[#6B4227]/10 hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Right: Quick Highlight Toggles */}
            <div className="flex items-center gap-1.5 flex-shrink-0 pl-2 sm:pl-3 border-l-2 border-[#6B4227]">
              <button
                type="button"
                onClick={handleToggleBestSeller}
                className={`px-3 py-1 rounded-sm font-handwriting text-xs sm:text-sm font-bold border-2 border-[#6B4227] transition-all duration-150 ease-out flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  filterBestSeller
                    ? 'bg-[#6B4227] text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
                    : 'bg-[#FAF0DA] text-[#6B4227] hover:bg-[#6B4227]/10 hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px]'
                }`}
              >
                <span>★</span> Best Seller
              </button>
              <button
                type="button"
                onClick={handleToggleFavorite}
                className={`px-3 py-1 rounded-sm font-handwriting text-xs sm:text-sm font-bold border-2 border-[#6B4227] transition-all duration-150 ease-out flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  filterFavorite
                    ? 'bg-[#6B4227] text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
                    : 'bg-[#FAF0DA] text-[#6B4227] hover:bg-[#6B4227]/10 hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px]'
                }`}
              >
                <span>♥</span> Favorite
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Products Area: 2 columns mobile, 3 columns desktop */}
        <main
          ref={mainScrollRef}
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-5 sm:py-7 relative kiosk-scrollbar"
        >
          <div className="max-w-5xl mx-auto w-full pb-24 sm:pb-28">
            {currentItems.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-7 items-start">
                {currentItems.map((product) => {
                  const isOutOfStock = product.stock <= 0;
                  const eff = effectivePrice(product);
                  const hasDiscount = Boolean(
                    product.discountPrice &&
                      product.discountPrice > 0 &&
                      product.discountPrice < product.price
                  );
                  const discountPercent = hasDiscount
                    ? Math.round(((product.price - product.discountPrice!) / product.price) * 100)
                    : 0;
                  const inCartQty = getCartQuantity(product.id);
                  const atMaxStock = inCartQty >= product.stock;

                  return (
                    /* Torn Paper Slip Card with Top Masking Tape */
                    <div
                      key={product.id}
                      className="relative group flex flex-col drop-shadow-[3px_4px_0px_#6B4227] hover:-translate-y-1 transition-transform duration-200 select-none pt-2"
                    >
                      {/* Masking / Washi Tape at Top */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 sm:w-20 h-4 bg-[#6B4227]/25 border-x-2 border-dashed border-[#6B4227]/40 -rotate-1 z-20 pointer-events-none" />

                      {/* Main Card Body */}
                      <div className="bg-[#FAF0DA] border-t-2 border-x-2 border-[#6B4227] p-3 sm:p-4 flex flex-col justify-between flex-1">
                        {/* Top Part: Clickable for Details */}
                        <div
                          onClick={() => {
                            setSelectedProduct(product);
                            setDetailImgIdx(0);
                          }}
                          className="cursor-pointer"
                        >
                          {/* Photo Container with Polaroid-style Border */}
                          <div className="relative w-full aspect-square overflow-hidden bg-[#FAF0DA] border-2 border-[#6B4227] rounded-sm">
                            {product.images?.[0]?.url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={product.images[0].url}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-handwriting text-sm text-[#6B4227]/60">
                                Fresh in Oven
                              </div>
                            )}

                            {/* Out of Stock Rubber Stamp Overlay */}
                            {isOutOfStock && (
                              <div className="absolute inset-0 bg-[#6B4227]/85 backdrop-blur-[1px] flex items-center justify-center p-2">
                                <span className="border-2 border-[#FAF0DA] text-[#FAF0DA] font-handwriting text-xs sm:text-sm font-extrabold px-3 py-1 -rotate-6 uppercase tracking-wider">
                                  Sold Out
                                </span>
                              </div>
                            )}

                            {/* Badges: Top Left */}
                            {!isOutOfStock && (
                              <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 items-start">
                                {product.isBestSeller && (
                                  <span className="font-handwriting font-bold text-[10px] sm:text-[11px] px-1.5 py-0.5 border-1.5 border-[#6B4227] bg-[#FAF0DA] text-[#6B4227] rounded-sm shadow-[1px_1px_0px_#6B4227]">
                                    ★ Best
                                  </span>
                                )}
                                {product.isFavorite && (
                                  <span className="font-handwriting font-bold text-[10px] sm:text-[11px] px-1.5 py-0.5 border-1.5 border-[#6B4227] bg-[#FAF0DA] text-[#6B4227] rounded-sm shadow-[1px_1px_0px_#6B4227]">
                                    ♥ Fav
                                  </span>
                                )}
                                {hasDiscount && (
                                  <span className="font-handwriting font-bold text-[10px] sm:text-[11px] px-1.5 py-0.5 bg-[#6B4227] text-[#FAF0DA] rounded-sm shadow-[1px_1px_0px_#6B4227]">
                                    -{discountPercent}%
                                  </span>
                                )}
                              </div>
                            )}

                            {/* In-Bag Badge: Top Right */}
                            {inCartQty > 0 && (
                              <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-sm bg-[#6B4227] text-[#FAF0DA] border border-[#FAF0DA] font-handwriting text-xs font-bold shadow-xs">
                                {inCartQty} in bag
                              </div>
                            )}
                          </div>

                          {/* Perforation Dashed Line */}
                          <div className="w-full border-b border-dashed border-[#6B4227]/40 my-2" />

                          {/* Category Subtitle */}
                          <p className="font-handwriting text-xs font-bold tracking-widest text-[#6B4227]/75 uppercase truncate">
                            {product.type?.name || 'Bakery & Pastry'}
                          </p>

                          {/* Product Title in Neat Handwriting */}
                          <h3 className="font-handwriting text-base sm:text-lg font-bold text-[#6B4227] line-clamp-2 leading-tight mt-0.5 min-h-[2.4rem] group-hover:underline">
                            {product.name}
                          </h3>

                          {/* Price Row */}
                          <div className="flex items-baseline gap-1.5 mt-1 font-handwriting">
                            <span className="text-base sm:text-lg font-extrabold text-[#6B4227]">
                              {formatRupiah(eff)}
                            </span>
                            {hasDiscount && (
                              <span className="text-xs text-[#6B4227]/60 line-through">
                                {formatRupiah(product.price)}
                              </span>
                            )}
                          </div>

                          {/* Low stock notice */}
                          {!isOutOfStock && product.stock <= 5 && (
                            <p className="font-handwriting text-xs font-semibold text-[#6B4227]/80 mt-0.5">
                              only {product.stock} left in bakery
                            </p>
                          )}
                        </div>

                        {/* Bottom Action Area: Quick Add or Inline Stepper with Button-Push Effect */}
                        <div className="mt-2.5 pt-2 border-t border-dashed border-[#6B4227]/30">
                          {isOutOfStock ? (
                            <div className="w-full py-1.5 border-2 border-dashed border-[#6B4227]/40 text-[#6B4227]/60 font-handwriting text-sm font-bold text-center rounded-sm">
                              Sold Out Today
                            </div>
                          ) : inCartQty === 0 ? (
                            <button
                              type="button"
                              onClick={() => addToCart(product)}
                              className="w-full py-1.5 bg-[#FAF0DA] text-[#6B4227] hover:bg-[#6B4227] hover:text-[#FAF0DA] border-2 border-[#6B4227] rounded-sm font-handwriting text-sm font-bold flex items-center justify-center gap-1.5 transition-all duration-150 ease-out shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
                            >
                              <Plus className="h-4 w-4 stroke-[2.5]" />
                              <span>Order This</span>
                            </button>
                          ) : (
                            <div className="w-full flex items-center justify-between bg-[#6B4227] text-[#FAF0DA] border-2 border-[#6B4227] rounded-sm p-1 shadow-[2px_2px_0px_#6B4227]">
                              <button
                                type="button"
                                onClick={() => removeFromCart(product.id)}
                                className="w-7 h-7 flex items-center justify-center bg-[#FAF0DA] text-[#6B4227] hover:bg-[#FAF0DA]/90 active:translate-y-[1px] active:scale-95 font-bold transition-all duration-100 cursor-pointer rounded-xs border border-[#6B4227]"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
                              </button>
                              <span className="font-handwriting text-sm sm:text-base font-bold px-2">
                                {inCartQty} in bag
                              </span>
                              <button
                                type="button"
                                onClick={() => addToCart(product)}
                                disabled={atMaxStock}
                                className="w-7 h-7 flex items-center justify-center bg-[#FAF0DA] text-[#6B4227] hover:bg-[#FAF0DA]/90 active:translate-y-[1px] active:scale-95 disabled:opacity-40 font-bold transition-all duration-100 cursor-pointer rounded-xs border border-[#6B4227]"
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Torn Paper Bottom Edge (SVG with Jagged Perforated Paper Teeth) */}
                      <div className="w-full leading-none -mt-[1px] select-none pointer-events-none">
                        <svg
                          viewBox="0 0 320 14"
                          preserveAspectRatio="none"
                          className="w-full h-3.5 block"
                        >
                          {/* Fill the torn paper teeth with cream */}
                          <path
                            d="M0,0 L320,0 L320,3 L310,10 L301,4 L290,12 L281,5 L270,11 L260,3 L249,12 L239,4 L229,11 L218,5 L208,12 L198,3 L188,11 L177,4 L167,12 L156,5 L146,11 L135,3 L125,12 L115,4 L104,11 L94,5 L83,12 L73,3 L62,11 L52,4 L41,12 L31,5 L20,11 L10,3 L0,10 Z"
                            fill="#FAF0DA"
                          />
                          {/* Stroke ONLY the jagged bottom line in brown */}
                          <path
                            d="M320,0 L320,3 L310,10 L301,4 L290,12 L281,5 L270,11 L260,3 L249,12 L239,4 L229,11 L218,5 L208,12 L198,3 L188,11 L177,4 L167,12 L156,5 L146,11 L135,3 L125,12 L115,4 L104,11 L94,5 L83,12 L73,3 L62,11 L52,4 L41,12 L31,5 L20,11 L10,3 L0,10 L0,0"
                            fill="none"
                            stroke="#6B4227"
                            strokeWidth="2"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center bg-[#FAF0DA] rounded-sm border-2 border-[#6B4227] p-8 max-w-md mx-auto shadow-[4px_4px_0px_#6B4227]">
                <p className="font-handwriting text-lg font-bold text-[#6B4227]">No baked goods found</p>
                <p className="font-handwriting text-sm text-[#6B4227]/75 mt-1">
                  Try selecting a different bakery category or clearing your filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedType('ALL');
                    setFilterBestSeller(false);
                    setFilterFavorite(false);
                    setPage(0);
                  }}
                  className="mt-4 px-5 py-1.5 bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] border-2 border-[#6B4227] rounded-sm font-handwriting text-sm font-bold transition-all duration-150 ease-out cursor-pointer shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  Reset All Filters
                </button>
              </div>
            )}

            {/* Pagination Controls Section */}
            {totalPages > 1 && (
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 bg-[#FAF0DA] border-2 border-[#6B4227] rounded-sm p-3 sm:p-4 shadow-[4px_4px_0px_#6B4227]">
                {/* Range summary */}
                <div className="font-handwriting text-sm sm:text-base font-bold text-[#6B4227] text-center sm:text-left">
                  Showing <span className="underline">{safePage * ITEMS_PER_PAGE + 1}</span>–
                  <span className="underline">
                    {Math.min((safePage + 1) * ITEMS_PER_PAGE, filteredProducts.length)}
                  </span>{' '}
                  of {filteredProducts.length} bakery items
                </div>

                {/* Page Buttons with Tactile Push Effect */}
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.max(0, safePage - 1))}
                    disabled={safePage === 0}
                    className="flex items-center gap-1 px-3 py-1 rounded-sm border-2 border-[#6B4227] bg-[#FAF0DA] text-[#6B4227] font-handwriting text-sm font-bold hover:bg-[#6B4227] hover:text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-30 disabled:hover:bg-[#FAF0DA] disabled:hover:text-[#6B4227] disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:shadow-none transition-all duration-150 ease-out cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {pageNumbers.map((p, idx) => {
                      if (p === '...') {
                        return (
                          <span key={`dots-${idx}`} className="px-1.5 font-handwriting text-base font-bold text-[#6B4227]">
                            …
                          </span>
                        );
                      }
                      const pageIdx = (p as number) - 1;
                      const isActive = pageIdx === safePage;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handlePageChange(pageIdx)}
                          className={`min-w-[32px] h-8 px-2 rounded-sm font-handwriting text-sm font-bold transition-all duration-150 ease-out cursor-pointer border-2 border-[#6B4227] ${
                            isActive
                              ? 'bg-[#6B4227] text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
                              : 'bg-[#FAF0DA] text-[#6B4227] hover:bg-[#6B4227]/10 hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px]'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.min(totalPages - 1, safePage + 1))}
                    disabled={safePage >= totalPages - 1}
                    className="flex items-center gap-1 px-3 py-1 rounded-sm border-2 border-[#6B4227] bg-[#FAF0DA] text-[#6B4227] font-handwriting text-sm font-bold hover:bg-[#6B4227] hover:text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-30 disabled:hover:bg-[#FAF0DA] disabled:hover:text-[#6B4227] disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:shadow-none transition-all duration-150 ease-out cursor-pointer"
                    aria-label="Next page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Sticky Floating Bottom Cart Bar when totalQuantity > 0 */}
        {totalQuantity > 0 && (
          <div className="fixed bottom-3 sm:bottom-5 inset-x-3 sm:inset-x-6 z-30 pointer-events-none">
            <div className="max-w-2xl mx-auto bg-[#6B4227] text-[#FAF0DA] border-2 border-[#6B4227] rounded-sm p-3 sm:p-3.5 shadow-[4px_4px_0px_rgba(107,66,39,0.5)] flex items-center justify-between pointer-events-auto backdrop-blur-xs animate-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-[#FAF0DA] text-[#6B4227] border-2 border-[#FAF0DA] flex items-center justify-center relative shadow-xs">
                  <ShoppingCart className="h-5 w-5 stroke-[2.5]" />
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-sm bg-[#6B4227] text-[#FAF0DA] border border-[#FAF0DA] font-handwriting text-xs font-bold">
                    {totalQuantity}
                  </span>
                </div>
                <div>
                  <p className="font-handwriting text-sm text-[#FAF0DA]/90">
                    {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'} in order bag
                  </p>
                  <p className="font-handwriting text-lg sm:text-xl font-extrabold text-[#FAF0DA]">
                    {formatRupiah(totalAmount)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="px-4 sm:px-6 py-2.5 bg-[#FAF0DA] text-[#6B4227] hover:bg-[#FAF0DA]/90 border-2 border-[#FAF0DA] font-handwriting text-base font-extrabold tracking-wide uppercase transition-all duration-150 ease-out shadow-[3px_3px_0px_#FAF0DA] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0px_#FAF0DA] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none cursor-pointer flex items-center gap-1.5"
              >
                <span>Review Order</span>
                <ChevronRight className="h-4 w-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* Product Detail Modal Styled Like a Bakery Recipe Note */}
        {selectedProduct && (
          <div
            className="fixed inset-0 z-50 bg-[#6B4227]/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedProduct(null)}
          >
            <div
              className="bg-[#FAF0DA] border-2 border-[#6B4227] rounded-sm p-5 sm:p-6 w-full max-w-xs sm:max-w-sm max-h-[92dvh] overflow-y-auto kiosk-scrollbar shadow-[6px_6px_0px_#6B4227] flex flex-col relative animate-in zoom-in-95 duration-200 pt-7"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Washi tape at top */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 sm:w-24 h-4.5 bg-[#6B4227]/25 border-x-2 border-dashed border-[#6B4227]/40 -rotate-1 pointer-events-none" />

              {/* Close Button with Tactile Push */}
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 p-1 rounded-sm text-[#6B4227] border-2 border-[#6B4227] bg-[#FAF0DA] hover:bg-[#6B4227] hover:text-[#FAF0DA] shadow-[1px_1px_0px_#6B4227] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all duration-150 ease-out z-10 cursor-pointer"
                aria-label="Close detail"
              >
                <X className="h-4 w-4 stroke-[2.5]" />
              </button>

              {/* Image Gallery */}
              <div className="w-full max-h-[160px] sm:max-h-[200px] aspect-square rounded-sm overflow-hidden bg-[#FAF0DA] relative flex-shrink-0 mx-auto border-2 border-[#6B4227]">
                {selectedImages[detailImgIdx]?.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={selectedImages[detailImgIdx].url}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-handwriting text-sm text-[#6B4227]/60">
                    Fresh in Oven
                  </div>
                )}
                {selectedProduct.stock <= 0 && (
                  <div className="absolute inset-0 bg-[#6B4227]/85 flex items-center justify-center p-1">
                    <span className="border-2 border-[#FAF0DA] text-[#FAF0DA] font-handwriting text-xs font-bold px-3 py-1 -rotate-6 uppercase tracking-wider">
                      Sold Out Today
                    </span>
                  </div>
                )}
              </div>

              {selectedImages.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-2">
                  {selectedImages.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDetailImgIdx(i)}
                      className={`h-2 rounded-xs border border-[#6B4227] transition-all cursor-pointer ${
                        i === detailImgIdx ? 'w-4 bg-[#6B4227]' : 'w-2 bg-[#FAF0DA]'
                      }`}
                      aria-label={`View image ${i + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Product Name & Price */}
              <div className="flex items-start justify-between gap-2 mt-3.5">
                <h3 className="font-handwriting text-lg sm:text-xl font-bold text-[#6B4227]">
                  {selectedProduct.name}
                </h3>
                <span className="font-handwriting text-lg sm:text-xl font-extrabold text-[#6B4227] whitespace-nowrap">
                  {formatRupiah(effectivePrice(selectedProduct))}
                </span>
              </div>

              {/* Type & Variant */}
              {(selectedProduct.type?.name || selectedProduct.variant?.name) && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {selectedProduct.type?.name && (
                    <span className="px-2 py-0.5 rounded-sm font-handwriting text-xs font-bold border-1.5 border-[#6B4227] bg-[#FAF0DA] text-[#6B4227]">
                      {selectedProduct.type.name}
                    </span>
                  )}
                  {selectedProduct.variant?.name && (
                    <span className="px-2 py-0.5 rounded-sm font-handwriting text-xs font-bold bg-[#6B4227] text-[#FAF0DA]">
                      {selectedProduct.variant.name}
                    </span>
                  )}
                </div>
              )}

              {/* Description */}
              <p className="font-handwriting text-sm sm:text-base text-[#6B4227]/80 mt-2.5 leading-relaxed line-clamp-4">
                {selectedProduct.description || 'Freshly prepared daily in our bakery with premium ingredients.'}
              </p>

              {/* Add to Order Button with Button-Push Effect */}
              <button
                type="button"
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
                disabled={selectedProduct.stock <= 0 || selectedAtMaxStock}
                className="w-full mt-5 py-2.5 bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] border-2 border-[#6B4227] rounded-sm font-handwriting text-base font-bold uppercase tracking-wider transition-all duration-150 ease-out shadow-[3px_3px_0px_#6B4227] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0px_#6B4227] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {selectedProduct.stock <= 0
                  ? 'Sold Out Today'
                  : selectedAtMaxStock
                    ? `Max Stock in Bag (${selectedCartQty})`
                    : `+ Add to Order • ${formatRupiah(effectivePrice(selectedProduct))}`}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 3. CHECKOUT SCREEN
  // =========================================================================
  if (step === 'checkout') {
    return (
      <div className="h-[100dvh] w-full bg-[#FAF0DA] flex flex-col overflow-hidden select-none">
        <header className="flex-shrink-0 h-14 px-4 sm:px-6 border-b-2 border-[#6B4227] bg-[#FAF0DA] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep('menu')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-handwriting text-sm font-bold text-[#6B4227] border-2 border-[#6B4227] bg-[#FAF0DA] hover:bg-[#6B4227] hover:text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 ease-out cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
            <span>Menu</span>
          </button>
          <h2 className="font-handwriting text-lg font-bold text-[#6B4227]">Review Order</h2>
          <div className="w-12"></div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-lg mx-auto w-full overflow-y-auto kiosk-scrollbar flex flex-col justify-between">
          <div className="bg-[#FAF0DA] rounded-sm border-2 border-[#6B4227] p-4 divide-y divide-[#6B4227]/20 shadow-[4px_4px_0px_#6B4227]">
            {cart.map((item) => {
              const eff = effectivePrice(item.product);
              const atMax = item.quantity >= item.product.stock;
              return (
                <div key={item.product.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="flex-1 pr-2">
                    <h4 className="font-handwriting text-base font-bold text-[#6B4227] line-clamp-1">{item.product.name}</h4>
                    <p className="font-handwriting text-sm text-[#6B4227]/80 mt-0.5">
                      {formatRupiah(eff)}
                      {atMax && <span className="ml-1.5 text-xs text-[#6B4227] font-bold">(Max stock)</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-[#FAF0DA] border-2 border-[#6B4227] rounded-sm shadow-[1px_1px_0px_#6B4227]">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1.5 text-[#6B4227] hover:bg-[#6B4227] hover:text-[#FAF0DA] active:scale-90 transition-all cursor-pointer"
                      >
                        <Minus className="h-3 w-3 stroke-[2.5]" />
                      </button>
                      <span className="font-handwriting text-sm font-bold text-[#6B4227] px-2.5">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => addToCart(item.product)}
                        disabled={atMax}
                        className="p-1.5 text-[#6B4227] hover:bg-[#6B4227] hover:text-[#FAF0DA] active:scale-90 disabled:opacity-30 transition-all cursor-pointer"
                      >
                        <Plus className="h-3 w-3 stroke-[2.5]" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteFromCart(item.product.id)}
                      className="p-1.5 text-[#6B4227] hover:bg-[#6B4227] hover:text-[#FAF0DA] border border-[#6B4227] rounded-sm transition-all active:scale-90 cursor-pointer"
                      title="Remove item"
                    >
                      <X className="h-3.5 w-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t-2 border-dashed border-[#6B4227] space-y-3">
            <div className="flex justify-between items-center font-handwriting text-sm text-[#6B4227]/80">
              <span>Total Items</span>
              <span className="font-bold text-[#6B4227] text-base">{totalQuantity}</span>
            </div>
            <div className="flex justify-between items-center font-handwriting text-base font-bold text-[#6B4227]">
              <span>Total Amount</span>
              <span className="text-xl font-extrabold text-[#6B4227]">{formatRupiah(totalAmount)}</span>
            </div>

            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => cart.length > 0 && setStep('biodata')}
              className="w-full py-2.5 bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] border-2 border-[#6B4227] rounded-sm font-handwriting text-base font-bold uppercase tracking-wider transition-all duration-150 ease-out shadow-[3px_3px_0px_#6B4227] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0px_#6B4227] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-40 cursor-pointer"
            >
              Continue to Details
            </button>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // 4. CUSTOMER DETAILS SCREEN
  // =========================================================================
  if (step === 'biodata') {
    return (
      <div className="h-[100dvh] w-full bg-[#FAF0DA] flex flex-col overflow-hidden select-none">
        <header className="flex-shrink-0 h-14 px-4 sm:px-6 border-b-2 border-[#6B4227] bg-[#FAF0DA] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep('checkout')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-handwriting text-sm font-bold text-[#6B4227] border-2 border-[#6B4227] bg-[#FAF0DA] hover:bg-[#6B4227] hover:text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 ease-out cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
            <span>Back</span>
          </button>
          <h2 className="font-handwriting text-lg font-bold text-[#6B4227]">Customer Details</h2>
          <div className="w-12"></div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-sm mx-auto w-full flex items-center">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              setCameraError('');
              setCameraReady(false);
              setStep('selfie');
            }}
            className="bg-[#FAF0DA] rounded-sm border-2 border-[#6B4227] p-5 w-full space-y-4 shadow-[4px_4px_0px_#6B4227]"
          >
            <div>
              <label className="block font-handwriting text-sm font-bold text-[#6B4227] mb-1">
                Your Name <span className="text-[#6B4227]">*</span>
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Enter your name"
                className="w-full px-3 py-2 font-handwriting text-base bg-[#FAF0DA] border-2 border-[#6B4227] rounded-sm text-[#6B4227] placeholder-[#6B4227]/40 focus:outline-none focus:ring-1 focus:ring-[#6B4227]"
              />
            </div>

            <div>
              <label className="block font-handwriting text-sm font-bold text-[#6B4227] mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={120}
                placeholder="email@example.com"
                className="w-full px-3 py-2 font-handwriting text-base bg-[#FAF0DA] border-2 border-[#6B4227] rounded-sm text-[#6B4227] placeholder-[#6B4227]/40 focus:outline-none focus:ring-1 focus:ring-[#6B4227]"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] border-2 border-[#6B4227] rounded-sm font-handwriting text-base font-bold transition-all duration-150 ease-out shadow-[3px_3px_0px_#6B4227] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0px_#6B4227] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none cursor-pointer"
            >
              Continue to Photo
            </button>
          </form>
        </main>
      </div>
    );
  }

  // =========================================================================
  // 5. CUSTOMER PHOTO SCREEN
  // =========================================================================
  if (step === 'selfie') {
    return (
      <div className="h-[100dvh] w-full bg-[#FAF0DA] flex flex-col overflow-hidden select-none">
        <header className="flex-shrink-0 h-14 px-4 sm:px-6 border-b-2 border-[#6B4227] bg-[#FAF0DA] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setPhoto(null);
              setCameraError('');
              setCameraReady(false);
              setError('');
              setStep('biodata');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-handwriting text-sm font-bold text-[#6B4227] border-2 border-[#6B4227] bg-[#FAF0DA] hover:bg-[#6B4227] hover:text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 ease-out cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
            <span>Back</span>
          </button>
          <h2 className="font-handwriting text-lg font-bold text-[#6B4227]">Customer Photo</h2>
          <div className="w-12"></div>
        </header>

        <main className="flex-1 p-4 max-w-sm mx-auto w-full flex flex-col items-center justify-center overflow-y-auto kiosk-scrollbar">
          {error && (
            <div className="w-full p-2.5 mb-3 rounded-sm bg-[#FAF0DA] border-2 border-[#6B4227] font-handwriting text-sm text-[#6B4227] text-center font-bold">
              {error}
            </div>
          )}
          {!error && cameraError && !photo && (
            <p className="font-handwriting text-sm text-[#6B4227] mb-2.5 text-center">{cameraError}</p>
          )}

          <div className="bg-[#FAF0DA] rounded-sm p-2 border-2 border-[#6B4227] shadow-[4px_4px_0px_#6B4227] w-full max-w-[240px] aspect-[3/4] max-h-[45vh] relative overflow-hidden mb-3">
            {!photo ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setCameraReady(true)}
                onCanPlay={() => setCameraReady(true)}
                className="w-full h-full object-cover rounded-sm bg-[#6B4227]"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={photo} alt="Customer Photo" className="w-full h-full object-cover rounded-sm" />
            )}
            <canvas ref={canvasRef} className="hidden" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {!photo ? (
            <div className="flex flex-col items-center gap-2.5 w-full max-w-[240px]">
              {!cameraError && (
                <button
                  type="button"
                  onClick={takePhoto}
                  disabled={!cameraReady || loading}
                  className="w-full py-2.5 bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] border-2 border-[#6B4227] disabled:opacity-50 rounded-sm font-handwriting text-base font-bold flex items-center justify-center gap-2 shadow-[3px_3px_0px_#6B4227] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0px_#6B4227] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150 ease-out cursor-pointer"
                >
                  <Camera className="h-4 w-4 stroke-[2.5]" />
                  <span>{cameraReady ? 'Take Photo' : 'Starting Camera...'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full py-2 bg-[#FAF0DA] border-2 border-[#6B4227] text-[#6B4227] hover:bg-[#6B4227] hover:text-[#FAF0DA] rounded-sm font-handwriting text-sm font-bold flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 ease-out cursor-pointer"
              >
                <Upload className="h-4 w-4 stroke-[2.5]" />
                <span>Upload / Device Camera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  handleSubmit('');
                }}
                disabled={loading}
                className="mt-1 font-handwriting text-sm text-[#6B4227] hover:underline font-bold cursor-pointer"
              >
                {loading ? 'Submitting Order...' : 'Skip Photo & Submit Order →'}
              </button>
            </div>
          ) : (
            <div className="flex w-full max-w-[260px] gap-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setCameraError('');
                  setCameraReady(false);
                  setPhoto(null);
                }}
                disabled={loading}
                className="flex-1 py-2.5 bg-[#FAF0DA] border-2 border-[#6B4227] text-[#6B4227] rounded-sm font-handwriting text-base font-bold hover:bg-[#6B4227] hover:text-[#FAF0DA] shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 ease-out cursor-pointer"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(photo)}
                disabled={loading}
                className="flex-1 py-2.5 bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] border-2 border-[#6B4227] rounded-sm font-handwriting text-base font-bold disabled:opacity-50 shadow-[2px_2px_0px_#6B4227] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#6B4227] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 ease-out cursor-pointer"
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
  // 6. SUCCESS SCREEN
  // =========================================================================
  if (step === 'success') {
    return (
      <div className="h-[100dvh] w-full bg-[#FAF0DA] flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-14 h-14 rounded-sm bg-[#FAF0DA] text-[#6B4227] border-2 border-[#6B4227] flex items-center justify-center mb-4 shadow-[3px_3px_0px_#6B4227]">
          <CheckCircle className="h-7 w-7 stroke-[2.5]" />
        </div>

        <h2 className="font-handwriting text-2xl font-bold text-[#6B4227] mb-1">
          Order Submitted!
        </h2>
        <p className="font-handwriting text-base text-[#6B4227]/90 max-w-xs mb-4 leading-relaxed">
          Thank you, <span className="font-bold underline">{name}</span>. Please proceed to the cashier counter to complete your payment.
        </p>

        {orderCode && (
          <div className="mb-6 px-5 py-3 bg-[#FAF0DA] border-2 border-[#6B4227] rounded-sm shadow-[4px_4px_0px_#6B4227]">
            <p className="font-handwriting text-xs uppercase tracking-widest font-bold text-[#6B4227]/70">Order Reference</p>
            <p className="font-mono text-lg font-extrabold text-[#6B4227] mt-0.5">{orderCode}</p>
          </div>
        )}

        <button
          type="button"
          onClick={resetFlow}
          className="px-8 py-3 bg-[#6B4227] text-[#FAF0DA] hover:bg-[#54311B] border-2 border-[#6B4227] rounded-sm font-handwriting text-base font-bold shadow-[4px_4px_0px_#6B4227] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#6B4227] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 ease-out cursor-pointer"
        >
          Start New Order
        </button>
      </div>
    );
  }

  return null;
}
