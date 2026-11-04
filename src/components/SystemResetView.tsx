'use client';

import { useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  Receipt,
  Clock,
  Boxes,
  UtensilsCrossed,
  WalletCards,
  ClipboardList,
  Camera,
  Check,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Lock,
  Layers,
  Database,
} from 'lucide-react';
import { clearAllTransactionsAndShifts } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';

interface ResetOptionItem {
  id: string;
  name: string;
  badge: string;
  countKey?: 'transactions' | 'shifts' | 'stock' | 'products' | 'expenses' | 'inventoryLogs';
  description: string;
  icon: React.ElementType;
  dangerous?: boolean;
}

const RESET_OPTIONS: ResetOptionItem[] = [
  {
    id: 'resetTransactions',
    name: 'Sales Transactions & Order Queue',
    badge: 'POS & Kiosk',
    countKey: 'transactions',
    description: 'Permanently remove all customer orders (Waiting Payment, Preparing, Ready, Completed, Cancelled) and transaction line items.',
    icon: Receipt,
  },
  {
    id: 'resetShifts',
    name: 'Cashier Shifts & Register Sessions',
    badge: 'Register System',
    countKey: 'shifts',
    description: 'Close and purge all register shift sessions (both active open shifts and historical closed records).',
    icon: Clock,
  },
  {
    id: 'resetStock',
    name: 'Zero Out Physical Stock (Stock = 0)',
    badge: 'Tray Inventory',
    countKey: 'stock',
    description: 'Reset physical inventory counts for all products and flavor variants to 0 pcs without deleting catalog menu items.',
    icon: Boxes,
  },
  {
    id: 'resetExpenses',
    name: 'Operational Expenses',
    badge: 'Finance',
    countKey: 'expenses',
    description: 'Purge all recorded event operational expenses (booth rent, ice blocks, packaging, logistics).',
    icon: WalletCards,
  },
  {
    id: 'resetInventoryLogs',
    name: 'Inventory Mutation Audit Logs',
    badge: 'Audit Trail',
    countKey: 'inventoryLogs',
    description: 'Remove all stock mutation audit records (sales deductions, manual restocks, cancellation restores).',
    icon: ClipboardList,
  },
  {
    id: 'resetSelfies',
    name: 'Customer Kiosk Photos',
    badge: 'Disk Storage',
    description: 'Permanently remove customer selfie photos from local server disk storage to reclaim space.',
    icon: Camera,
  },
  {
    id: 'resetProducts',
    name: 'Master Product Catalog & Categories',
    badge: 'Critical Catalog',
    countKey: 'products',
    description: 'Permanently delete all product items, bundle packages, flavor options, menu photos, and categories.',
    icon: UtensilsCrossed,
    dangerous: true,
  },
];

const DEFAULT_SELECTION: Record<string, boolean> = {
  resetTransactions: true,
  resetShifts: true,
  resetStock: true,
  resetExpenses: true,
  resetInventoryLogs: true,
  resetSelfies: true,
  resetProducts: false,
};

export interface SystemCounts {
  transactions: number;
  shifts: number;
  products: number;
  variants: number;
  expenses: number;
  inventoryLogs: number;
}

export default function SystemResetView({ counts }: { counts: SystemCounts }) {
  const [selected, setSelected] = useState<Record<string, boolean>>(DEFAULT_SELECTION);
  const [confirmText, setConfirmText] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setSelected((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handlePresetBazaar = () => {
    setSelected({
      resetTransactions: true,
      resetShifts: true,
      resetStock: true,
      resetExpenses: true,
      resetInventoryLogs: true,
      resetSelfies: true,
      resetProducts: false,
    });
  };

  const handleSelectAll = () => {
    const allTrue: Record<string, boolean> = {};
    RESET_OPTIONS.forEach((item) => {
      allTrue[item.id] = true;
    });
    setSelected(allTrue);
  };

  const handleDeselectAll = () => {
    const allFalse: Record<string, boolean> = {};
    RESET_OPTIONS.forEach((item) => {
      allFalse[item.id] = false;
    });
    setSelected(allFalse);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const isKeywordValid = ['DELETE', 'HAPUS', 'RESET'].includes(confirmText.trim().toUpperCase());
  const isResetValid = selectedCount > 0 && adminPassword.trim().length > 0 && isKeywordValid;

  const getCountDisplay = (item: ResetOptionItem) => {
    if (item.id === 'resetTransactions') return `${counts.transactions} records`;
    if (item.id === 'resetShifts') return `${counts.shifts} sessions`;
    if (item.id === 'resetStock') return `${counts.variants} flavor trays`;
    if (item.id === 'resetExpenses') return `${counts.expenses} expenses`;
    if (item.id === 'resetInventoryLogs') return `${counts.inventoryLogs} logs`;
    if (item.id === 'resetProducts') return `${counts.products} items (${counts.variants} flavors)`;
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5C3A21] flex items-center justify-center border border-[#6B4227] shrink-0 text-[#FAF0DA]">
            <ShieldAlert className="h-5 w-5 text-[#FAF0DA]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#3F2311]">System Data & Storage Reset</h1>
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-[#5C2E22] text-[#FCD3C1] border border-[#8E4A38]/40">
                Danger Zone
              </span>
            </div>
            <p className="text-[11px] text-[#8E6D53] mt-0.5">
              Selectively purge transactions, shifts, physical stock, or catalog data before starting a new bazaar event.
            </p>
          </div>
        </div>

        {/* Quick presets toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handlePresetBazaar}
            className="px-2.5 py-1.5 rounded-lg bg-[#6B4227] text-[#FAF0DA] hover:bg-[#5C3A21] font-medium text-[11px] flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#E8C589]" />
            <span>New Event (Safe Catalog)</span>
          </button>
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-2.5 py-1.5 rounded-lg bg-[#FAF0DA] text-[#5C3A21] hover:bg-[#EBDDC8] border border-[#E5D5BC] font-medium text-[11px] transition-colors cursor-pointer"
          >
            <span>Select All</span>
          </button>
          <button
            type="button"
            onClick={handleDeselectAll}
            className="px-2.5 py-1.5 rounded-lg bg-white text-[#6B4227] border border-[#E5D5BC] hover:bg-[#FAF0DA] font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Deselect All</span>
          </button>
        </div>
      </div>

      {/* Live System Data Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg p-3 text-center">
          <p className="text-[10px] font-medium text-[#8E6D53]">Transactions</p>
          <p className="text-sm font-bold text-[#3F2311] mt-0.5">{counts.transactions}</p>
        </div>
        <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg p-3 text-center">
          <p className="text-[10px] font-medium text-[#8E6D53]">Shifts</p>
          <p className="text-sm font-bold text-[#3F2311] mt-0.5">{counts.shifts}</p>
        </div>
        <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg p-3 text-center">
          <p className="text-[10px] font-medium text-[#8E6D53]">Catalog Items</p>
          <p className="text-sm font-bold text-[#3F2311] mt-0.5">{counts.products}</p>
        </div>
        <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg p-3 text-center">
          <p className="text-[10px] font-medium text-[#8E6D53]">Flavor Trays</p>
          <p className="text-sm font-bold text-[#3F2311] mt-0.5">{counts.variants}</p>
        </div>
        <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg p-3 text-center">
          <p className="text-[10px] font-medium text-[#8E6D53]">Expenses</p>
          <p className="text-sm font-bold text-[#3F2311] mt-0.5">{counts.expenses}</p>
        </div>
        <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg p-3 text-center">
          <p className="text-[10px] font-medium text-[#8E6D53]">Audit Logs</p>
          <p className="text-sm font-bold text-[#3F2311] mt-0.5">{counts.inventoryLogs}</p>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-[#FDF2F0] border border-[#F2C4BC] text-[#8E2818] rounded-xl flex items-start gap-2.5 text-xs">
          <AlertTriangle className="h-4 w-4 text-[#8E2818] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Reset Operation Failed:</span> {errorMessage}
          </div>
        </div>
      )}

      {/* Form & Card Checklist */}
      <ActionForm
        action={async (formData) => {
          setErrorMessage(null);
          const res = await clearAllTransactionsAndShifts(formData);
          if (res?.error) {
            setErrorMessage(res.error);
          }
          return res;
        }}
        className="space-y-5"
      >
        {/* Hidden inputs for selected categories */}
        {RESET_OPTIONS.map((item) => (
          <input
            key={item.id}
            type="hidden"
            name={item.id}
            value={selected[item.id] ? 'true' : 'false'}
          />
        ))}

        {/* Checklist Cards (2 Columns) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B4227]">
              Select Modules to Purge:
            </span>
            <span className="text-[11px] font-semibold text-[#8E6D53]">
              {selectedCount} of {RESET_OPTIONS.length} categories marked for deletion
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {RESET_OPTIONS.map((item) => {
              const isChecked = Boolean(selected[item.id]);
              const Icon = item.icon;
              const countDisplay = getCountDisplay(item);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3 ${
                    isChecked
                      ? item.dangerous
                        ? 'bg-[#FBF1EF] border-[#E2A69A] ring-1 ring-[#E2A69A]'
                        : 'bg-[#F7EFE4] border-[#D6C1A4] ring-1 ring-[#D6C1A4]'
                      : 'bg-[#FFFDF8] border-[#E5D5BC] hover:bg-[#FAF0DA]/40'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="mt-0.5 shrink-0">
                    {isChecked ? (
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center text-white ${
                          item.dangerous ? 'bg-[#8E2818]' : 'bg-[#6B4227]'
                        }`}
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded border border-[#C5B094] bg-white flex items-center justify-center" />
                    )}
                  </div>

                  {/* Module Icon */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isChecked
                        ? item.dangerous
                          ? 'bg-[#F3D5CF] text-[#8E2818]'
                          : 'bg-[#EBDDC8] text-[#5C3A21]'
                        : 'bg-[#FAF0DA] text-[#8E6D53]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-xs font-bold ${
                          isChecked
                            ? item.dangerous
                              ? 'text-[#6D1B0F]'
                              : 'text-[#3F2311]'
                            : 'text-[#5C3A21]'
                        }`}
                      >
                        {item.name}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                          item.dangerous
                            ? 'bg-[#F3D5CF] text-[#8E2818]'
                            : isChecked
                            ? 'bg-[#EBDDC8] text-[#5C3A21]'
                            : 'bg-[#FAF0DA] text-[#8E6D53]'
                        }`}
                      >
                        {item.badge}
                      </span>
                      {countDisplay && (
                        <span className="text-[9px] text-[#8E6D53] font-medium ml-auto">
                          {countDisplay}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#6B4227]/85 leading-relaxed mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Catalog Deletion Warning Banner */}
        {selected.resetProducts && (
          <div className="p-3 bg-[#FBF1EF] border border-[#E2A69A] rounded-xl text-[#6D1B0F] flex items-start gap-2.5 text-xs leading-relaxed animate-in fade-in">
            <AlertTriangle className="h-4 w-4 text-[#8E2818] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">CRITICAL WARNING — MASTER CATALOG SELECTED:</span> You have selected{' '}
              <span className="underline font-bold">Master Product Catalog & Categories</span>. All products, flavor variations, prices, menu photos, and category definitions will be permanently erased.
            </div>
          </div>
        )}

        {/* Security Verification Card */}
        <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E5D5BC]">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#8E6D53]" />
              <h2 className="text-xs font-bold text-[#3F2311]">Security Authorization</h2>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                selectedCount > 0 ? 'bg-[#EBDDC8] text-[#5C3A21]' : 'bg-[#FAF0DA] text-[#8E6D53]'
              }`}
            >
              {selectedCount} Categories Selected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Password */}
            <div>
              <label className="block font-semibold text-[#3F2311] mb-1.5 text-[11px]">
                Admin Password <span className="text-[#8E2818]">*</span>
              </label>
              <input
                type="password"
                name="adminPassword"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-3 py-2 bg-[#FAF0DA]/40 border border-[#E5D5BC] rounded-lg text-xs text-[#3F2311] focus:ring-1 focus:ring-[#6B4227] focus:outline-none placeholder:text-[#A89178]"
              />
            </div>

            {/* Keyword Confirmation */}
            <div>
              <label className="block font-semibold text-[#3F2311] mb-1.5 text-[11px]">
                Type <span className="font-mono font-bold text-[#8E2818]">DELETE</span> to confirm <span className="text-[#8E2818]">*</span>
              </label>
              <input
                type="text"
                name="confirmText"
                required
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Enter DELETE"
                className="w-full px-3 py-2 bg-[#FAF0DA]/40 border border-[#E5D5BC] rounded-lg text-xs font-mono font-bold text-[#3F2311] focus:ring-1 focus:ring-[#6B4227] focus:outline-none uppercase placeholder:text-[#A89178]"
              />
            </div>
          </div>

          {!isKeywordValid && confirmText.trim().length > 0 && (
            <p className="text-[10px] text-[#8E2818] font-medium">
              Confirmation keyword must match <code className="font-bold">DELETE</code>.
            </p>
          )}

          {selectedCount === 0 && (
            <p className="text-[10px] text-[#8E6D53] font-medium">
              Please select at least one data category above to proceed with the purge.
            </p>
          )}

          {/* Action Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handlePresetBazaar}
              className="px-3.5 py-2 bg-[#FAF0DA] hover:bg-[#F2E6CF] text-[#6B4227] border border-[#E5D5BC] rounded-lg font-semibold text-xs transition-colors cursor-pointer"
            >
              Reset to Recommended
            </button>
            <SubmitButton
              pendingText="Executing System Purge..."
              disabled={!isResetValid}
              className="px-5 py-2 bg-[#8E2818] hover:bg-[#782214] text-white rounded-lg font-bold text-xs shadow-2xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>
                {selectedCount === 0
                  ? 'Select Categories to Purge'
                  : `Permanently Purge ${selectedCount} Categories`}
              </span>
            </SubmitButton>
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
