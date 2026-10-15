'use client';

import { createProduct, updateProduct, deleteProductImage } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { ArrowLeft, Save, Image as ImageIcon, X } from 'lucide-react';
import Link from 'next/link';

type Product = {
  id?: number;
  name?: string;
  type?: { name: string } | null;
  variant?: { name: string } | null;
  description?: string | null;
  images?: { id: number; url: string }[];
  costPrice?: number;
  price?: number;
  discountPrice?: number | null;
};

export default function ProductForm({ initialData }: { initialData?: Product }) {
  const isEditing = !!initialData?.id;

  const handleDeleteImage = async (imageId: number) => {
    if (!initialData?.id) return;
    if (!window.confirm('Delete this image?')) return;
    const fd = new FormData();
    fd.set('id', String(initialData.id));
    fd.set('imageId', String(imageId));
    const res = await deleteProductImage(fd);
    if (res?.error) window.alert(res.error);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/products" className="p-2.5 bg-[#FFFDF9] border border-[#EADBCC] rounded-xl text-[#7A6251] hover:text-[#4A2E1B] hover:bg-[#FAF7F2] transition-colors shadow-xs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#4A2E1B] tracking-tight">
              {isEditing ? 'Edit Product' : 'Add New Product'}
            </h1>
          </div>
        </div>
      </div>

      <ActionForm action={isEditing ? updateProduct : createProduct} className="space-y-6">
        {isEditing && <input type="hidden" name="id" value={initialData.id} />}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-[#FFFDF9] border border-[#EADBCC] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="font-bold text-[#4A2E1B] border-b border-[#EADBCC]/60 pb-3">Basic Information</h2>
              
              <div>
                <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Product Name</label>
                <input 
                  type="text" 
                  name="name" 
                  defaultValue={initialData?.name} 
                  required 
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B] focus:bg-[#FFFDF9] transition-all" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Type / Category</label>
                  <input 
                    type="text" 
                    name="type" 
                    defaultValue={initialData?.type?.name || 'Food'} 
                    required 
                    maxLength={50}
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B] focus:bg-[#FFFDF9] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Variant (Optional)</label>
                  <input 
                    type="text" 
                    name="variant" 
                    defaultValue={initialData?.variant?.name || ''} 
                    maxLength={50}
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B] focus:bg-[#FFFDF9] transition-all" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Description</label>
                <textarea 
                  name="description" 
                  rows={3} 
                  defaultValue={initialData?.description || ''} 
                  maxLength={500}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B] focus:bg-[#FFFDF9] transition-all" 
                />
              </div>
            </div>

            <div className="bg-[#FFFDF9] border border-[#EADBCC] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="font-bold text-[#4A2E1B] border-b border-[#EADBCC]/60 pb-3">Pricing</h2>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Cost Price</label>
                  <input 
                    type="number" 
                    name="costPrice" 
                    defaultValue={initialData?.costPrice ?? 0} 
                    min={0}
                    required 
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B] focus:bg-[#FFFDF9] transition-all font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Selling Price</label>
                  <input 
                    type="number" 
                    name="price" 
                    defaultValue={initialData?.price ?? 0} 
                    min={1}
                    required 
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B] focus:bg-[#FFFDF9] transition-all font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Discount Price (Opt)</label>
                  <input 
                    type="number" 
                    name="discountPrice" 
                    defaultValue={initialData?.discountPrice || ''} 
                    min={1}
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B] focus:bg-[#FFFDF9] transition-all font-semibold" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Images */}
          <div className="space-y-6">
            <div className="bg-[#FFFDF9] border border-[#EADBCC] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="font-bold text-[#4A2E1B] border-b border-[#EADBCC]/60 pb-3 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[#C69234]" /> Product Images
              </h2>
              
              {initialData?.images && initialData.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {initialData.images.map((img) => (
                    <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden bg-[#FAF7F2] border border-[#EADBCC] group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="Product" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        className="absolute top-1.5 right-1.5 p-1 bg-red-600/80 hover:bg-red-700 text-white rounded-full transition-colors shadow-xs cursor-pointer"
                        title="Delete image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">
                  {initialData?.images?.length ? 'Upload More Images (Multi)' : 'Upload Images (Multi)'}
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  name="images" 
                  multiple 
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-xs text-[#7A6251] focus:outline-none file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#4A2E1B] file:text-[#FFFDF9] hover:file:bg-[#3D2413] file:cursor-pointer" 
                />
              </div>
            </div>

            <SubmitButton 
              pendingText="Saving..."
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl font-semibold text-sm hover:bg-[#3D2413] transition-colors shadow-xs cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {isEditing ? 'Save Changes' : 'Create Product'}
            </SubmitButton>
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
