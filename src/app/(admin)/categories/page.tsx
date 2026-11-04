import { connection } from 'next/server';
import { listCategoriesService } from '@/lib/services/categories';
import CategoryManager from '@/components/CategoryManager';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
export const instant = false;

export default async function CategoriesPage() {
  await connection();
  const categories = await listCategoriesService();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#6B4227] tracking-tight">Master Categories</h1>
        <p className="text-sm text-[#8E6D53] mt-1">
          Manage product categories (Saltbread, Coffee, Tea, Snack, etc.) for catalog organization and bundle rules.
        </p>
      </div>

      <CategoryManager categories={categories} />
    </div>
  );
}
