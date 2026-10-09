'use client';

import { useState, useRef, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, ArrowLeft, Camera, CheckCircle } from 'lucide-react';
import { submitKioskOrder } from '@/app/actions';

export default function KioskFlow({ products }: { products: any[] }) {
  const [step, setStep] = useState<'start' | 'menu' | 'checkout' | 'biodata' | 'selfie' | 'success'>('start');
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const totalAmount = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Cannot access camera. Please allow permissions.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  useEffect(() => {
    if (step === 'selfie' && !photo) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [step, photo]);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await submitKioskOrder({
        customerName: name,
        customerEmail: email,
        totalAmount,
        photoBase64: photo || '',
        items: cart.map(i => ({
          productId: i.product.id,
          productName: i.product.name,
          quantity: i.quantity,
          price: i.product.price
        }))
      });

      if (res.success) {
        setStep('success');
      } else {
        setError(res.error || "Failed to submit order");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    }
    setLoading(false);
  };

  const resetFlow = () => {
    setStep('start');
    setCart([]);
    setName('');
    setEmail('');
    setPhoto(null);
  };

  // 1. START
  if (step === 'start') {
    return (
      <div className="h-screen w-full bg-gray-900 flex flex-col items-center justify-center text-white cursor-pointer" onClick={() => setStep('menu')}>
        <h1 className="text-6xl font-black mb-6 tracking-tight">SORELIN</h1>
        <p className="text-2xl font-medium text-gray-300 mb-12">Self-Service Ordering</p>
        <div className="animate-bounce bg-white text-gray-900 px-8 py-4 rounded-full font-bold text-xl">
          TAP ANYWHERE TO ORDER
        </div>
      </div>
    );
  }

  // 2. MENU
  if (step === 'menu') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
        <header className="bg-white p-6 shadow-sm flex items-center justify-between sticky top-0 z-10">
          <button onClick={() => setStep('start')} className="p-2 border border-gray-200 rounded-lg">
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold">Select Your Items</h1>
          <div className="w-10"></div>
        </header>
        
        <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map(product => (
              <div key={product.id} onClick={() => addToCart(product)} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-all">
                <div className="h-40 bg-gray-100 w-full relative">
                  {product.images?.[0]?.url ? (
                    <img src={product.images[0].url} className="w-full h-full object-cover" alt={product.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 line-clamp-2">{product.name}</h3>
                  <p className="text-emerald-600 font-semibold mt-2">Rp {product.price.toLocaleString('id-ID')}</p>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Floating Cart Bar */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-6 shadow-2xl flex items-center justify-between z-20">
            <div>
              <p className="text-gray-400 text-sm">Total ({cart.reduce((s,i) => s + i.quantity, 0)} items)</p>
              <p className="text-2xl font-bold">Rp {totalAmount.toLocaleString('id-ID')}</p>
            </div>
            <button onClick={() => setStep('checkout')} className="bg-emerald-500 hover:bg-emerald-600 px-8 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Checkout
            </button>
          </div>
        )}
      </div>
    );
  }

  // 3. CHECKOUT
  if (step === 'checkout') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white p-6 shadow-sm flex items-center justify-between sticky top-0">
          <button onClick={() => setStep('menu')} className="p-2 border border-gray-200 rounded-lg">
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold">Review Order</h1>
          <div className="w-10"></div>
        </header>

        <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{item.product.name}</h3>
                  <p className="text-gray-500 mt-1">Rp {item.product.price.toLocaleString('id-ID')}</p>
                </div>
                <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-2 border border-gray-200">
                  <button onClick={() => removeFromCart(item.product.id)} className="p-2 text-gray-600 hover:bg-white rounded-lg">
                    <Minus className="h-5 w-5" />
                  </button>
                  <span className="font-bold w-6 text-center text-lg">{item.quantity}</span>
                  <button onClick={() => addToCart(item.product)} className="p-2 text-gray-600 hover:bg-white rounded-lg">
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
                <div className="w-32 text-right">
                  <p className="font-bold text-gray-900">Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}</p>
                </div>
              </div>
            ))}

            <div className="pt-6 border-t border-gray-200 flex justify-between items-end">
              <span className="text-xl text-gray-600">Total Amount</span>
              <span className="text-3xl font-black text-gray-900">Rp {totalAmount.toLocaleString('id-ID')}</span>
            </div>

            <button 
              onClick={() => setStep('biodata')}
              className="w-full mt-8 py-5 bg-gray-900 text-white rounded-xl font-bold text-xl hover:bg-gray-800"
            >
              Confirm & Continue
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 4. BIODATA
  if (step === 'biodata') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white p-6 shadow-sm flex items-center justify-between sticky top-0">
          <button onClick={() => setStep('checkout')} className="p-2 border border-gray-200 rounded-lg">
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold">Your Details</h1>
          <div className="w-10"></div>
        </header>

        <main className="flex-1 p-6 max-w-2xl mx-auto w-full flex items-center">
          <form 
            onSubmit={(e) => { e.preventDefault(); setStep('selfie'); }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full space-y-6"
          >
            <div>
              <label className="block text-gray-700 font-bold mb-2">Full Name</label>
              <input 
                required 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full text-lg p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none"
                placeholder="Enter your name"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-2">Email Address</label>
              <input 
                required 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-lg p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none"
                placeholder="Enter your email"
              />
            </div>
            <button type="submit" className="w-full py-5 bg-gray-900 text-white rounded-xl font-bold text-xl hover:bg-gray-800">
              Next Step
            </button>
          </form>
        </main>
      </div>
    );
  }

  // 5. SELFIE
  if (step === 'selfie') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white p-6 shadow-sm flex items-center justify-between sticky top-0">
          <button onClick={() => { stopCamera(); setPhoto(null); setStep('biodata'); }} className="p-2 border border-gray-200 rounded-lg">
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold">Take a Selfie</h1>
          <div className="w-10"></div>
        </header>

        <main className="flex-1 p-6 max-w-2xl mx-auto w-full flex flex-col items-center justify-center">
          {error && <p className="text-red-500 mb-4">{error}</p>}
          
          <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-sm w-full max-w-md aspect-[3/4] relative overflow-hidden mb-8">
            {!photo ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover rounded-2xl bg-gray-900"
              />
            ) : (
              <img src={photo} alt="Selfie" className="w-full h-full object-cover rounded-2xl" />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {!photo ? (
            <button onClick={takePhoto} className="flex flex-col items-center gap-2 group">
              <div className="h-20 w-20 rounded-full border-4 border-gray-300 p-1 group-hover:border-gray-400 transition-colors">
                <div className="w-full h-full bg-red-500 rounded-full group-hover:bg-red-600 transition-colors"></div>
              </div>
              <span className="font-bold text-gray-600">Snap Photo</span>
            </button>
          ) : (
            <div className="flex w-full max-w-md gap-4">
              <button 
                onClick={() => { setPhoto(null); startCamera(); }}
                className="flex-1 py-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50"
              >
                Retake
              </button>
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-70"
              >
                {loading ? 'Submitting...' : 'Complete Order'}
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // 6. SUCCESS
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle className="h-24 w-24 text-emerald-500 mb-8" />
        <h1 className="text-4xl font-black text-white mb-4">Order Received!</h1>
        <p className="text-xl text-gray-300 mb-12 max-w-md">
          Thank you, {name}. Please proceed to the cashier to complete your payment.
        </p>
        <button 
          onClick={resetFlow}
          className="px-10 py-5 bg-white text-gray-900 rounded-full font-bold text-xl hover:bg-gray-100 transition-colors"
        >
          New Order
        </button>
      </div>
    );
  }

  return null;
}
