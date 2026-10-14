'use client';

import { useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Package, History, ClipboardList, Users, Wallet, LogOut, PieChart, Menu, X, ChefHat, Clock, Receipt } from "lucide-react";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions";

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Shift Management', href: '/shift', icon: Wallet },
    { name: 'Kitchen Orders', href: '/orders', icon: ChefHat },
    { name: 'Transactions', href: '/transactions', icon: History },
    { name: 'Expenses', href: '/expenses', icon: Receipt },
    { name: 'Business Report', href: '/report', icon: PieChart },
    { name: 'Shift History', href: '/shifts', icon: Clock },
    { name: 'Products Menu', href: '/products', icon: Package },
    { name: 'Stock Inventory', href: '/inventory', icon: ClipboardList },
    { name: 'Customers', href: '/customers', icon: Users },
  ];

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-3 left-4 z-50 p-2 bg-white rounded-md border border-gray-200 shadow-sm"
        aria-label="Open Menu"
      >
        <Menu className="h-5 w-5 text-gray-700" />
      </button>

      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-gray-900/50 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col fixed md:relative h-full z-50 transition-transform duration-200 ease-in-out md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <div className="font-bold text-xl tracking-tight text-gray-900">Sorelin <span className="text-gray-400 font-normal">Moka</span></div>
          <button onClick={() => setIsOpen(false)} className="md:hidden p-1 text-gray-500 hover:bg-gray-100 rounded-md transition-colors" aria-label="Close Menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors ${
                  isActive ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-200 space-y-1">
          <form action={logoutAction}>
            <button 
              type="submit" 
              className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-md font-medium text-sm transition-colors text-left"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
