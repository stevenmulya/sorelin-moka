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
  PlusCircle
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

  // Clean, consistent, and intuitive domain groupings (Title Case)
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

  // All groups open by default for rapid one-click cashier access
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
        className="md:hidden fixed top-3 left-4 z-50 p-2 bg-[#FFFDF9] rounded-xl border border-[#EADBCC] shadow-xs text-[#4A2E1B] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
        aria-label="Open Menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-[#3D2413]/40 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`w-64 flex-shrink-0 bg-[#FFFDF9] border-r border-[#EADBCC] flex flex-col fixed md:relative h-full z-50 transition-transform duration-200 ease-in-out md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#EADBCC]/80 bg-[#FFFDF9]">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-extrabold text-lg tracking-tight text-[#4A2E1B]">
              Sorelin <span className="text-[#C69234] font-medium">Moka</span>
            </span>
          </Link>
          <button 
            onClick={() => setIsOpen(false)} 
            className="md:hidden p-1.5 text-[#7A6251] hover:text-[#4A2E1B] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer" 
            aria-label="Close Menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Body with Hidden Scrollbar (Scroll Functional) */}
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* Top Level: Dashboard */}
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isDashboardActive 
                ? 'bg-[#4A2E1B] text-[#FFFDF9] shadow-xs' 
                : 'text-[#6B5344] hover:bg-[#FAF7F2] hover:text-[#4A2E1B]'
            }`}
          >
            <LayoutDashboard className={`h-4 w-4 ${isDashboardActive ? 'text-[#FDF0D0]' : 'text-[#7A6251]'}`} />
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
                  {/* Category Header Button (Strict Title Case, Consistent Tokens) */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                      hasActiveChild 
                        ? 'text-[#4A2E1B] bg-[#FAF7F2]' 
                        : 'text-[#7A6251] hover:text-[#4A2E1B] hover:bg-[#FAF7F2]/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <GroupIcon className={`h-4 w-4 ${hasActiveChild ? 'text-[#C69234]' : 'text-[#7A6251]'}`} />
                      <span>{group.name}</span>
                    </div>
                    <ChevronDown 
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        hasActiveChild ? 'text-[#4A2E1B]' : 'text-[#A89687]'
                      } ${isGroupOpen ? 'rotate-180' : ''}`} 
                    />
                  </button>

                  {/* Submenu Items */}
                  {isGroupOpen && (
                    <div className="mt-1 ml-4 pl-3.5 border-l-2 border-[#EADBCC] space-y-1 py-0.5">
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
                                ? 'bg-[#4A2E1B] text-[#FFFDF9] font-semibold shadow-xs'
                                : 'text-[#6B5344] hover:bg-[#FAF7F2] hover:text-[#4A2E1B] font-medium'
                            }`}
                          >
                            <ItemIcon className={`h-3.5 w-3.5 ${active ? 'text-[#FDF0D0]' : 'text-[#8A7160]'}`} />
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
        <div className="p-3 border-t border-[#EADBCC] space-y-1.5 bg-[#FFFDF9]">
          <Link
            href="/kiosk"
            target="_blank"
            className="w-full flex items-center justify-center py-2.5 bg-[#FAF7F2] text-[#4A2E1B] hover:bg-[#F3ECE1] border border-[#EADBCC] rounded-xl font-semibold text-xs transition-colors shadow-xs cursor-pointer text-center"
          >
            <span>Customer Kiosk ↗</span>
          </Link>
          <form action={logoutAction}>
            <button 
              type="submit" 
              className="w-full flex items-center gap-2.5 px-3 py-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl font-semibold text-xs transition-colors text-left cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
