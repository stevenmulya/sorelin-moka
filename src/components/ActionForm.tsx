'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

type ActionFn = (formData: FormData) => Promise<{ error?: string } | void>;

/** Tombol submit yang otomatis nonaktif saat form diproses (mencegah klik ganda). */
export function SubmitButton({
  children,
  className,
  pendingText,
  title,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  title?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} title={title} className={`${className ?? ''} disabled:opacity-60 disabled:cursor-not-allowed`}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/**
 * Form untuk server action yang mengembalikan { error }. Menampilkan pesan error ke pengguna,
 * dengan opsi konfirmasi dan isian alasan (mis. alasan pembatalan).
 */
export default function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  reason,
}: {
  action: ActionFn;
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
  /** Minta teks dari pengguna lalu kirim sebagai field `name` (wajib diisi). */
  reason?: { name: string; message: string };
}) {
  return (
    <form
      className={className}
      action={async (formData: FormData) => {
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        if (reason) {
          const value = window.prompt(reason.message)?.trim();
          if (!value) {
            window.alert('Reason is required.');
            return;
          }
          formData.set(reason.name, value);
        }
        const res = (await action(formData)) as { error?: string } | undefined;
        if (res?.error) window.alert(res.error);
      }}
    >
      {children}
    </form>
  );
}
