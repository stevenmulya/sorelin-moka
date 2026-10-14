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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/products" className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
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
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-3">Basic Information</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input 
                  type="text" 
                  name="name" 
                  defaultValue={initialData?.name} 
                  required 
                  maxLength={100}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <input 
                    type="text" 
                    name="type" 
                    defaultValue={initialData?.type?.name || 'Food'} 
                    required 
                    maxLength={50}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Variant (Optional)</label>
                  <input 
                    type="text" 
                    name="variant" 
                    defaultValue={initialData?.variant?.name || ''} 
                    maxLength={50}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  name="description" 
                  rows={3} 
                  defaultValue={initialData?.description || ''} 
                  maxLength={500}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all" 
                />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-3">Pricing</h2>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
                  <input 
                    type="number" 
                    name="costPrice" 
                    defaultValue={initialData?.costPrice ?? 0} 
                    min={0}
                    required 
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price</label>
                  <input 
                    type="number" 
                    name="price" 
                    defaultValue={initialData?.price ?? 0} 
                    min={1}
                    required 
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Price (Opt)</label>
                  <input 
                    type="number" 
                    name="discountPrice" 
                    defaultValue={initialData?.discountPrice || ''} 
                    min={1}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Images */}
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Product Images
              </h2>
              
              {initialData?.images && initialData.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {initialData.images.map((img) => (
                    <div key={img.id} className="relative aspect-square rounded-md overflow-hidden bg-gray-100 border border-gray-200 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="Product" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        className="absolute top-1 right-1 p-1 bg-red-600/80 hover:bg-red-700 text-white rounded-full transition-colors shadow"
                        title="Delete image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {initialData?.images?.length ? 'Upload More Images (Multi)' : 'Upload Images (Multi)'}
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  name="images" 
                  multiple 
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 transition-all file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" 
                />
              </div>
            </div>

            <SubmitButton 
              pendingText="Saving..."
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm"
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
