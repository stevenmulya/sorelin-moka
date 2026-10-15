'use client';

import { useState } from 'react';
import type { ComponentType } from 'react';
import { updateTransactionStatus, bulkArchiveOrders } from '@/app/actions';
import { generateTrxCode } from '@/lib/utils';
import { ChefHat, PackageCheck, CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface KanbanOrderItem {
  id: number;
  productName: string;
  quantity: number;
  price: number;
}

export interface KanbanOrder {
  id: number;
  customer: string;
  status: string;
  createdAt: Date | string;
  items?: KanbanOrderItem[];
}

interface ColumnProps {
  title: string;
  status: string;
  icon: ComponentType<{ className?: string }>;
  colorClass: string;
  orders: KanbanOrder[];
  draggedId: number | null;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: string) => void;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onViewOrder: (order: KanbanOrder) => void;
  onArchiveSingle: (order: KanbanOrder) => void;
  onArchiveAll: () => void;
}

function KanbanColumn({
  title,
  status,
  icon: Icon,
  colorClass,
  orders,
  draggedId,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
  onViewOrder,
  onArchiveSingle,
  onArchiveAll,
}: ColumnProps) {
  const colOrders = orders.filter((o) => o.status === status);

  return (
    <div
      className={`bg-[#FAF7F2] rounded-2xl p-4 min-h-[300px] border border-[#EADBCC] transition-colors ${
        draggedId ? 'border-dashed border-[#C69234]' : ''
      }`}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      <div className="flex items-center gap-2 mb-4 px-1">
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <h3 className="font-bold text-[#4A2E1B] text-sm">{title}</h3>

        {status === 'Picked Up' && colOrders.length > 0 ? (
          <button
            type="button"
            onClick={onArchiveAll}
            className="ml-auto bg-[#4A2E1B] text-[#FFFDF9] hover:bg-[#3D2413] transition-colors text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xs"
          >
            Archive All
          </button>
        ) : (
          <span className="ml-auto bg-[#FFFDF9] border border-[#EADBCC] text-[#7A6251] text-xs font-semibold px-2 py-0.5 rounded-full">
            {colOrders.length}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {colOrders.map((order) => (
          <div
            key={order.id}
            draggable
            onDragStart={(e) => onDragStart(e, order.id)}
            onDragEnd={onDragEnd}
            className="bg-[#FFFDF9] p-3.5 rounded-xl shadow-xs border border-[#EADBCC] cursor-grab active:cursor-grabbing hover:border-[#D8C6B5] transition-colors group relative"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-[#4A2E1B]">
                {generateTrxCode(order.id, order.createdAt, order.customer)}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewOrder(order);
                  }}
                  className="px-2 py-0.5 bg-[#FAF7F2] border border-[#EADBCC] text-[#7A6251] hover:text-[#4A2E1B] hover:bg-[#F3ECE1] text-[11px] font-semibold rounded-md transition-colors"
                >
                  View
                </button>
                {status === 'Picked Up' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchiveSingle(order);
                    }}
                    className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-[11px] font-semibold rounded-md transition-colors"
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm font-semibold text-[#382213]">{order.customer}</p>
          </div>
        ))}
        {colOrders.length === 0 && (
          <div className="text-center p-6 border border-dashed border-[#EADBCC] rounded-xl text-xs text-[#7A6251]">
            Drag orders here
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardKanban({ initialOrders }: { initialOrders: KanbanOrder[] }) {
  const [prevOrders, setPrevOrders] = useState(initialOrders);
  const [orders, setOrders] = useState(initialOrders);

  if (initialOrders !== prevOrders) {
    setPrevOrders(initialOrders);
    setOrders(initialOrders);
  }

  const [draggedId, setDraggedId] = useState<number | null>(null);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [viewItemsModal, setViewItemsModal] = useState<{ isOpen: boolean; order: KanbanOrder } | null>(null);

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    setModalState({ isOpen: true, title, message, onConfirm });
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      const el = e.target as HTMLElement;
      if (el) el.style.opacity = '0.5';
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const executeStatusChange = async (idToUpdate: number, newStatus: string) => {
    const orderToUpdate = orders.find((o) => o.id === idToUpdate);
    if (!orderToUpdate || orderToUpdate.status === newStatus) return;

    const prevOrders = [...orders];
    setOrders((prev) => prev.map((o) => (o.id === idToUpdate ? { ...o, status: newStatus } : o)));

    const formData = new FormData();
    formData.append('id', idToUpdate.toString());
    formData.append('status', newStatus);
    const res = await updateTransactionStatus(formData);
    if (res?.error) {
      window.alert(res.error);
      setOrders(prevOrders);
    }
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!draggedId) return;

    const currentDraggedId = draggedId;
    setDraggedId(null);
    await executeStatusChange(currentDraggedId, newStatus);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedId(null);
    const el = e.target as HTMLElement;
    if (el) el.style.opacity = '1';
  };

  const archiveAllPickedUp = async () => {
    const pickedUpOrders = orders.filter((o) => o.status === 'Picked Up');
    const ids = pickedUpOrders.map((o) => o.id);
    if (ids.length === 0) return;

    const prevOrders = [...orders];
    setOrders((prev) => prev.filter((o) => o.status !== 'Picked Up'));

    const res = await bulkArchiveOrders(ids);
    if (res?.error) {
      window.alert(res.error);
      setOrders(prevOrders);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KanbanColumn
          title="Preparing"
          status="Preparing"
          icon={ChefHat}
          colorClass="text-blue-600"
          orders={orders}
          draggedId={draggedId}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onViewOrder={(order) => setViewItemsModal({ isOpen: true, order })}
          onArchiveSingle={(order) =>
            confirmAction('Archive Order', `Archive order for ${order.customer}?`, () => {
              executeStatusChange(order.id, 'Closed');
              setModalState((prev) => ({ ...prev, isOpen: false }));
            })
          }
          onArchiveAll={() =>
            confirmAction('Archive All', 'Are you sure you want to archive all Picked Up orders?', () => {
              archiveAllPickedUp();
              setModalState((prev) => ({ ...prev, isOpen: false }));
            })
          }
        />
        <KanbanColumn
          title="Ready for Pickup"
          status="Ready for Pickup"
          icon={CheckCircle2}
          colorClass="text-purple-600"
          orders={orders}
          draggedId={draggedId}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onViewOrder={(order) => setViewItemsModal({ isOpen: true, order })}
          onArchiveSingle={(order) =>
            confirmAction('Archive Order', `Archive order for ${order.customer}?`, () => {
              executeStatusChange(order.id, 'Closed');
              setModalState((prev) => ({ ...prev, isOpen: false }));
            })
          }
          onArchiveAll={() =>
            confirmAction('Archive All', 'Are you sure you want to archive all Picked Up orders?', () => {
              archiveAllPickedUp();
              setModalState((prev) => ({ ...prev, isOpen: false }));
            })
          }
        />
        <KanbanColumn
          title="Picked Up"
          status="Picked Up"
          icon={PackageCheck}
          colorClass="text-emerald-600"
          orders={orders}
          draggedId={draggedId}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onViewOrder={(order) => setViewItemsModal({ isOpen: true, order })}
          onArchiveSingle={(order) =>
            confirmAction('Archive Order', `Archive order for ${order.customer}?`, () => {
              executeStatusChange(order.id, 'Closed');
              setModalState((prev) => ({ ...prev, isOpen: false }));
            })
          }
          onArchiveAll={() =>
            confirmAction('Archive All', 'Are you sure you want to archive all Picked Up orders?', () => {
              archiveAllPickedUp();
              setModalState((prev) => ({ ...prev, isOpen: false }));
            })
          }
        />
      </div>

      {/* Modal Konfirmasi */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#28170D]/50 backdrop-blur-xs transition-opacity">
          <div className="bg-[#FFFDF9] rounded-2xl border border-[#EADBCC] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-[#FDF0D0] mb-4">
                <AlertCircle className="h-6 w-6 text-[#C69234]" />
              </div>
              <h3 className="text-lg font-bold text-[#4A2E1B] mb-2">{modalState.title}</h3>
              <p className="text-sm text-[#7A6251] mb-6">{modalState.message}</p>
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                  className="flex-1 px-4 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] hover:bg-[#F3ECE1] text-[#4A2E1B] text-sm font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={modalState.onConfirm}
                  className="flex-1 px-4 py-2.5 bg-[#4A2E1B] hover:bg-[#3D2413] text-[#FFFDF9] text-sm font-semibold rounded-xl transition-colors shadow-xs"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Items Modal */}
      {viewItemsModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#28170D]/50 backdrop-blur-xs transition-opacity">
          <div className="bg-[#FFFDF9] rounded-2xl border border-[#EADBCC] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[#EADBCC] flex justify-between items-center bg-[#FAF7F2]">
              <div>
                <h3 className="font-bold text-[#4A2E1B]">Order Items</h3>
                <p className="text-xs text-[#7A6251] mt-0.5">
                  {generateTrxCode(viewItemsModal.order.id, viewItemsModal.order.createdAt, viewItemsModal.order.customer)} - {viewItemsModal.order.customer}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewItemsModal(null)}
                className="text-[#7A6251] hover:text-[#4A2E1B] hover:bg-[#FAF7F2] p-1.5 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 max-h-96 overflow-y-auto">
              {viewItemsModal.order.items && viewItemsModal.order.items.length > 0 ? (
                <div className="space-y-3">
                  {viewItemsModal.order.items.map((item: KanbanOrderItem) => (
                    <div key={item.id} className="flex justify-between items-center text-sm border-b border-[#EADBCC]/50 pb-2">
                      <div>
                        <span className="font-bold text-[#4A2E1B]">{item.quantity}x</span>
                        <span className="ml-2 font-medium text-[#382213]">{item.productName}</span>
                      </div>
                      <span className="text-[#7A6251] font-semibold text-xs">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-[#7A6251] text-sm py-4">No items found for this order.</p>
              )}
            </div>
            <div className="p-4 border-t border-[#EADBCC] bg-[#FAF7F2] text-right">
              <button
                type="button"
                onClick={() => setViewItemsModal(null)}
                className="px-5 py-2.5 bg-[#4A2E1B] text-[#FFFDF9] text-sm font-semibold rounded-xl hover:bg-[#3D2413] transition-colors shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
