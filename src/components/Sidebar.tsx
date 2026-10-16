'use client';

import { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  History,
  ClipboardList,
  Users,
  Wallet,
  LogOut,
  BarChart3,
  Menu,
  X,
  ChefHat,
  Clock,
  Receipt,
  ChevronDown,
  ShoppingBag,
  PlusCircle,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions";

interface SubItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuGroup {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SubItem[];
}

function isItemActive(pathname: string, itemHref: string): boolean {
  if (pathname === itemHref) return true;
  if (itemHref === '/transactions/new') {
    return pathname === '/transactions/new';
  }
  if (itemHref === '/transactions') {
    return pathname.startsWith('/transactions') && pathname !== '/transactions/new';
  }
  if (itemHref === '/products') {
    return pathname.startsWith('/products');
  }
  if (itemHref === '/inventory') {
    return pathname.startsWith('/inventory');
  }
  if (itemHref === '/shifts') {
    return pathname.startsWith('/shifts');
  }
  if (itemHref === '/shift') {
    return pathname === '/shift';
  }
  if (itemHref === '/expenses') {
    return pathname.startsWith('/expenses');
  }
  if (itemHref === '/customers') {
    return pathname.startsWith('/customers');
  }
  if (itemHref === '/report') {
    return pathname.startsWith('/report');
  }
  if (itemHref === '/orders') {
    return pathname.startsWith('/orders');
  }
  return false;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const groups: MenuGroup[] = [
    {
      id: 'orders',
      name: 'Orders',
      icon: ShoppingBag,
      items: [
        { name: 'New Order', href: '/transactions/new', icon: PlusCircle },
        { name: 'Kitchen Orders', href: '/orders', icon: ChefHat },
        { name: 'Order History', href: '/transactions', icon: History },
      ],
    },
    {
      id: 'shifts',
      name: 'Shifts',
      icon: Wallet,
      items: [
        { name: 'Active Shift', href: '/shift', icon: Wallet },
        { name: 'Shift History', href: '/shifts', icon: Clock },
        { name: 'Expenses', href: '/expenses', icon: Receipt },
      ],
    },
    {
      id: 'inventory',
      name: 'Inventory',
      icon: Package,
      items: [
        { name: 'Products', href: '/products', icon: Package },
        { name: 'Stock Inventory', href: '/inventory', icon: ClipboardList },
      ],
    },
    {
      id: 'reports',
      name: 'Reports',
      icon: BarChart3,
      items: [
        { name: 'Business Report', href: '/report', icon: BarChart3 },
        { name: 'Customers', href: '/customers', icon: Users },
      ],
    },
  ];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    orders: true,
    shifts: true,
    inventory: true,
    reports: true,
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const isDashboardActive = pathname === '/';

  return (
    <>
      {/* Mobile Drawer Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-3 left-4 z-50 p-2 bg-[#FFFDF8] rounded-xl border border-[#E5D5BC] shadow-xs text-[#6B4227] hover:bg-[#FAF0DA] transition-colors cursor-pointer"
        aria-label="Open Menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-[#3F2311]/40 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`w-64 flex-shrink-0 bg-[#FFFDF8] border-r border-[#E5D5BC] flex flex-col fixed md:relative h-full z-50 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#E5D5BC] bg-[#6B4227]">
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sorelin-logo-cream.png"
              alt="Sorelin Bakery"
              className="h-8 w-auto object-contain"
            />
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden p-1.5 text-[#FAF0DA]/80 hover:text-[#FAF0DA] hover:bg-[#54311B] rounded-lg transition-colors cursor-pointer"
            aria-label="Close Menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Body */}
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto no-scrollbar">
          {/* Top Level: Dashboard */}
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isDashboardActive
                ? 'bg-[#6B4227] text-[#FAF0DA] shadow-xs'
                : 'text-[#6B4227] hover:bg-[#FAF0DA] hover:text-[#3F2311]'
            }`}
          >
            <LayoutDashboard className={`h-4 w-4 ${isDashboardActive ? 'text-[#F3DBAA]' : 'text-[#8E6D53]'}`} />
            <span>Dashboard</span>
          </Link>

          {/* Grouped Submenus */}
          <div className="space-y-1.5 pt-1">
            {groups.map((group) => {
              const GroupIcon = group.icon;
              const isGroupOpen = openGroups[group.id] ?? true;
              const hasActiveChild = group.items.some((item) => isItemActive(pathname, item.href));

              return (
                <div key={group.id} className="rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                      hasActiveChild
                        ? 'text-[#3F2311] bg-[#FAF0DA]'
                        : 'text-[#8E6D53] hover:text-[#3F2311] hover:bg-[#FAF0DA]/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <GroupIcon className={`h-4 w-4 ${hasActiveChild ? 'text-[#C88A32]' : 'text-[#8E6D53]'}`} />
                      <span>{group.name}</span>
                    </div>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        hasActiveChild ? 'text-[#6B4227]' : 'text-[#8E6D53]'
                      } ${isGroupOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isGroupOpen && (
                    <div className="mt-1 ml-4 pl-3.5 border-l-2 border-[#E5D5BC] space-y-1 py-0.5">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const active = isItemActive(pathname, item.href);

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                              active
                                ? 'bg-[#6B4227] text-[#FAF0DA] font-semibold shadow-xs'
                                : 'text-[#6B4227] hover:bg-[#FAF0DA] hover:text-[#3F2311] font-medium'
                            }`}
                          >
                            <ItemIcon className={`h-3.5 w-3.5 ${active ? 'text-[#F3DBAA]' : 'text-[#8E6D53]'}`} />
                            <span>{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[#E5D5BC] space-y-1.5 bg-[#FFFDF8]">
          <Link
            href="/kiosk"
            target="_blank"
            className="w-full flex items-center justify-center py-2.5 bg-[#FAF0DA] text-[#6B4227] hover:bg-[#F2E6CF] border border-[#E5D5BC] rounded-xl font-semibold text-xs transition-colors shadow-xs cursor-pointer text-center"
          >
            <span>Self-Order Kiosk ↗</span>
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl font-semibold text-xs transition-colors text-left cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
