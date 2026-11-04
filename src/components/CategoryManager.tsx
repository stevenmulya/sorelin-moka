'use client';

import { useState } from 'react';
import { createCategory, updateCategory, deleteCategory } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { Plus, Edit2, Trash2, FolderTree, Package, Check, X } from 'lucide-react';
import type { CategoryWithCount } from '@/lib/services/categories';

export default function CategoryManager({ categories }: { categories: CategoryWithCount[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  const handleStartEdit = (cat: CategoryWithCount) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="space-y-6">
      {/* Add Category Card */}
      <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-6 shadow-xs">
        <h2 className="font-semibold text-sm sm:text-base text-[#3F2311] mb-1 flex items-center gap-2">
          <Plus className="h-4 w-4 text-[#C88A32]" strokeWidth={1.5} />
          <span>Add New Category</span>
        </h2>
        <p className="text-xs text-[#8E6D53] mb-4 font-normal">
          Create categories such as Saltbread, Coffee, Tea, Snack, or Merchandise.
        </p>

        <ActionForm
          action={createCategory}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <input
            type="text"
            name="name"
            required
            maxLength={50}
            placeholder="Category Name (e.g. Coffee, Tea, Pastry)"
            className="flex-1 px-4 py-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm font-medium text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227] transition-all"
          />
          <SubmitButton
            pendingText="Saving..."
            className="px-5 py-2.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl font-medium text-xs hover:bg-[#54311B] transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            <span>Add Category</span>
          </SubmitButton>
        </ActionForm>
      </div>

      {/* Categories List Table */}
      <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5D5BC] bg-[#FAF0DA]/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-[#C88A32]" strokeWidth={1.5} />
            <h3 className="font-semibold text-sm text-[#3F2311]">Category Directory</h3>
          </div>
          <span className="text-xs font-semibold text-[#6B4227] bg-[#FAF0DA] px-2.5 py-0.5 rounded-full border border-[#E5D5BC]">
            {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
          </span>
        </div>

        {categories.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#8E6D53] font-light">
            No categories found. Use the form above to create your first category.
          </div>
        ) : (
          <div className="divide-y divide-[#E5D5BC]/60">
            {categories.map((cat) => {
              const isEditing = editingId === cat.id;

              return (
                <div
                  key={cat.id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF0DA]/30 transition-colors"
                >
                  {isEditing ? (
                    <ActionForm
                      action={updateCategory}
                      onSuccess={handleCancelEdit}
                      className="flex-1 flex items-center gap-2"
                    >
                      <input type="hidden" name="id" value={cat.id} />
                      <input
                        type="text"
                        name="name"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        required
                        maxLength={50}
                        className="flex-1 px-3 py-1.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg text-sm font-medium text-[#3F2311] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/15 focus:border-[#6B4227]"
                      />
                      <SubmitButton
                        pendingText="..."
                        className="p-2 bg-[#6B4227] text-[#FAF0DA] rounded-lg hover:bg-[#54311B] transition-colors cursor-pointer"
                        title="Save"
                      >
                        <Check className="h-4 w-4" strokeWidth={1.5} />
                      </SubmitButton>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="p-2 bg-[#FFFDF8] border border-[#E5D5BC] text-[#8E6D53] hover:text-[#3F2311] rounded-lg transition-colors cursor-pointer"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </ActionForm>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#FAF0DA] border border-[#E5D5BC] flex items-center justify-center text-[#6B4227] font-semibold text-xs">
                        {cat.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-[#3F2311]">{cat.name}</p>
                        <p className="text-xs text-[#8E6D53] flex items-center gap-1 mt-0.5 font-light">
                          <Package className="h-3 w-3" strokeWidth={1.5} />
                          <span>{cat.productCount} Active product{cat.productCount === 1 ? '' : 's'}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {!isEditing && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        className="px-3 py-1.5 bg-[#FFFDF8] hover:bg-[#FAF0DA] text-[#6B4227] border border-[#E5D5BC] rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span>Edit</span>
                      </button>

                      <ActionForm
                        action={deleteCategory}
                        confirmMessage={`Are you sure you want to delete category "${cat.name}"?`}
                      >
                        <input type="hidden" name="id" value={cat.id} />
                        <SubmitButton
                          pendingText="..."
                          disabled={cat.productCount > 0}
                          title={
                            cat.productCount > 0
                              ? `Cannot delete: category has ${cat.productCount} active products`
                              : 'Delete category'
                          }
                          className="px-3 py-1.5 bg-[#FFFDF8] hover:bg-red-50 text-red-600 border border-red-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          <span>Delete</span>
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
