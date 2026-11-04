import { prisma } from '@/lib/prisma';
import { UserError, cleanStr, requireInteger } from '@/lib/validation';

export interface CategoryWithCount {
  id: number;
  name: string;
  productCount: number;
}

export async function listCategoriesService(): Promise<CategoryWithCount[]> {
  const categories = await prisma.productType.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          products: {
            where: { isActive: true },
          },
        },
      },
    },
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    productCount: c._count.products,
  }));
}

export async function createCategoryService(nameRaw: FormDataEntryValue | string | null | undefined): Promise<{ id: number; name: string }> {
  const name = cleanStr(nameRaw, 50);
  if (!name) throw new UserError('Category name is required.');

  const existing = await prisma.productType.findFirst({
    where: { name: { equals: name } },
  });
  if (existing) throw new UserError(`Category "${name}" already exists.`);

  return prisma.productType.create({
    data: { name },
  });
}

export async function updateCategoryService(id: number, nameRaw: FormDataEntryValue | string | null | undefined): Promise<{ id: number; name: string }> {
  const name = cleanStr(nameRaw, 50);
  if (!name) throw new UserError('Category name is required.');

  const category = await prisma.productType.findUnique({ where: { id } });
  if (!category) throw new UserError('Category not found.');

  const existing = await prisma.productType.findFirst({
    where: { name: { equals: name }, id: { not: id } },
  });
  if (existing) throw new UserError(`Category "${name}" is already in use by another category.`);

  return prisma.productType.update({
    where: { id },
    data: { name },
  });
}

export async function deleteCategoryService(id: number): Promise<void> {
  const category = await prisma.productType.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          products: {
            where: { isActive: true },
          },
        },
      },
    },
  });

  if (!category) throw new UserError('Category not found.');
  if (category._count.products > 0) {
    throw new UserError(
      `Cannot delete category "${category.name}" because it still has ${category._count.products} active product(s). Please reassign or delete the products first.`
    );
  }

  await prisma.$transaction(async (tx) => {
    // Unlink any archived or inactive products that still reference this category
    await tx.product.updateMany({
      where: { typeId: id },
      data: { typeId: null },
    });
    await tx.productType.delete({
      where: { id },
    });
  });
}
