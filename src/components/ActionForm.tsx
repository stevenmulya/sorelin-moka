'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

type ActionFn = (formData: FormData) => Promise<{ error?: string } | void>;

/** Submit button that automatically disables while its parent form is pending. */
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
    <button
      type="submit"
      disabled={pending || disabled}
      title={title}
      className={`${className ?? ''} disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer`}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/**
 * Form wrapper for server actions returning `{ error?: string }`.
 * Supports optional confirmation dialog, required reason prompt, and onSuccess callback.
 */
export default function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  reason,
  onSuccess,
}: {
  action: ActionFn;
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
  /** Prompt user for a required reason string and append it as `reason.name`. */
  reason?: { name: string; message: string };
  onSuccess?: () => void;
}) {
  return (
    <form
      className={className}
      action={async (formData: FormData) => {
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        if (reason) {
          const value = window.prompt(reason.message)?.trim();
          if (!value) {
            window.alert('A reason is required to proceed.');
            return;
          }
          formData.set(reason.name, value);
        }
        const res = (await action(formData)) as { error?: string } | undefined;
        if (res?.error) {
          window.alert(res.error);
        } else {
          onSuccess?.();
        }
      }}
    >
      {children}
    </form>
  );
}
