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
      className={`bg-gray-100 rounded-xl p-4 min-h-[300px] border-2 border-transparent transition-colors ${
        draggedId ? 'border-dashed border-gray-300' : ''
      }`}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      <div className="flex items-center gap-2 mb-4 px-1">
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>

        {status === 'Picked Up' && colOrders.length > 0 ? (
          <button
            type="button"
            onClick={onArchiveAll}
            className="ml-auto bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-[10px] font-bold px-2 py-1 rounded"
          >
            DONE ALL
          </button>
        ) : (
          <span className="ml-auto bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full">
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
            className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors group relative"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-gray-900">
                {generateTrxCode(order.id, order.createdAt, order.customer)}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewOrder(order);
                  }}
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 hover:bg-200 text-[10px] font-bold rounded transition-colors"
                >
                  VIEW
                </button>
                {status === 'Picked Up' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchiveSingle(order);
                    }}
                    className="px-2 py-0.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-[10px] font-bold rounded transition-opacity"
                  >
                    DONE
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm font-medium text-gray-800">{order.customer}</p>
          </div>
        ))}
        {colOrders.length === 0 && (
          <div className="text-center p-4 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 mb-4">
                <AlertCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{modalState.title}</h3>
              <p className="text-sm text-gray-500 mb-6">{modalState.message}</p>
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={modalState.onConfirm}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-900">Order Items</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {generateTrxCode(viewItemsModal.order.id, viewItemsModal.order.createdAt, viewItemsModal.order.customer)} - {viewItemsModal.order.customer}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewItemsModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 max-h-96 overflow-y-auto">
              {viewItemsModal.order.items && viewItemsModal.order.items.length > 0 ? (
                <div className="space-y-3">
                  {viewItemsModal.order.items.map((item: KanbanOrderItem) => (
                    <div key={item.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                      <div>
                        <span className="font-semibold text-gray-900">{item.quantity}x</span>
                        <span className="ml-2 text-gray-700">{item.productName}</span>
                      </div>
                      <span className="text-gray-500 text-xs">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm py-4">No items found for this order.</p>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
              <button
                type="button"
                onClick={() => setViewItemsModal(null)}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
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
