'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

interface Crumb {
  label: string;
  href?: string;
}

const ROUTE_MAP: Record<string, { label: string; parent?: { label: string; href: string } }> = {
  '': { label: 'Dashboard' },
  'orders': { label: 'Kitchen Orders', parent: { label: 'Orders', href: '/transactions' } },
  'transactions': { label: 'Order History', parent: { label: 'Orders', href: '/transactions' } },
  'transactions/new': { label: 'New Order (POS)', parent: { label: 'Orders', href: '/transactions' } },
  'products': { label: 'Products', parent: { label: 'Catalog', href: '/products' } },
  'products/new': { label: 'Add Product', parent: { label: 'Products', href: '/products' } },
  'bundles': { label: 'Bundles & Packages', parent: { label: 'Catalog', href: '/products' } },
  'bundles/new': { label: 'Create Bundle', parent: { label: 'Bundles', href: '/bundles' } },
  'categories': { label: 'Categories', parent: { label: 'Catalog', href: '/products' } },
  'inventory': { label: 'Stock Opname', parent: { label: 'Catalog', href: '/products' } },
  'shift': { label: 'Shift Management', parent: { label: 'Shifts', href: '/shift' } },
  'shifts': { label: 'Shift History', parent: { label: 'Shifts', href: '/shift' } },
  'expenses': { label: 'Operational Expenses', parent: { label: 'Finance', href: '/expenses' } },
  'report': { label: 'Business Report', parent: { label: 'Finance', href: '/report' } },
  'customers': { label: 'Customer Directory' },
  'reset': { label: 'System Reset', parent: { label: 'Settings', href: '/reset' } },
};

export default function AdminBreadcrumb() {
  const pathname = usePathname() || '/';

  // Normalize path without trailing slash
  const cleanPath = pathname === '/' ? '' : pathname.replace(/^\/+|\/+$/g, '');

  const crumbs: Crumb[] = [{ label: 'Home', href: '/' }];

  if (!cleanPath) {
    // On Dashboard root
    return (
      <nav aria-label="Breadcrumb" className="flex items-center text-xs text-[#8E6D53]">
        <div className="flex items-center gap-1.5 font-semibold text-[#6B4227]">
          <Home className="h-3.5 w-3.5 text-[#C88A32]" />
          <span>Dashboard</span>
        </div>
      </nav>
    );
  }

  // Check static lookup first
  const match = ROUTE_MAP[cleanPath];
  if (match) {
    if (match.parent) {
      crumbs.push({ label: match.parent.label, href: match.parent.href });
    }
    crumbs.push({ label: match.label });
  } else {
    // Dynamic segments resolution (e.g. /transactions/15, /products/2/edit, /bundles/3/edit)
    const segments = cleanPath.split('/');

    if (segments[0] === 'transactions' && segments.length >= 2) {
      crumbs.push({ label: 'Orders', href: '/transactions' });
      crumbs.push({ label: 'Order History', href: '/transactions' });
      crumbs.push({ label: `Invoice #${segments[1]}` });
    } else if (segments[0] === 'products' && segments.length >= 3 && segments[2] === 'edit') {
      crumbs.push({ label: 'Catalog', href: '/products' });
      crumbs.push({ label: 'Products', href: '/products' });
      crumbs.push({ label: `Edit Product #${segments[1]}` });
    } else if (segments[0] === 'bundles' && segments.length >= 3 && segments[2] === 'edit') {
      crumbs.push({ label: 'Catalog', href: '/products' });
      crumbs.push({ label: 'Bundles', href: '/bundles' });
      crumbs.push({ label: `Edit Bundle #${segments[1]}` });
    } else {
      // Generic fallback
      let accumulated = '';
      segments.forEach((seg, idx) => {
        accumulated += `/${seg}`;
        const isLast = idx === segments.length - 1;
        const capitalized = seg.charAt(0).toUpperCase() + seg.slice(1);
        crumbs.push({
          label: capitalized,
          href: isLast ? undefined : accumulated,
        });
      });
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#8E6D53] overflow-x-auto no-scrollbar py-0.5">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const isFirst = index === 0;

        return (
          <div key={`${crumb.label}-${index}`} className="flex items-center gap-1.5 whitespace-nowrap">
            {index > 0 && (
              <ChevronRight className="h-3 w-3 text-[#D5C1A1] flex-shrink-0" strokeWidth={2} />
            )}

            {isLast ? (
              <span className="font-bold text-[#6B4227] px-1.5 py-0.5 rounded-md bg-[#FAF0DA]/80 border border-[#E5D5BC]">
                {crumb.label}
              </span>
            ) : crumb.href ? (
              <Link
                href={crumb.href}
                className="flex items-center gap-1 hover:text-[#6B4227] transition-colors font-medium px-1 py-0.5 rounded hover:bg-[#FAF0DA]/60"
              >
                {isFirst && <Home className="h-3.5 w-3.5 text-[#C88A32]" />}
                <span>{crumb.label}</span>
              </Link>
            ) : (
              <span className="font-medium text-[#8E6D53]">
                {crumb.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
