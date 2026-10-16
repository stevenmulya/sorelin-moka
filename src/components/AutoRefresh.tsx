'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Periodically refreshes server data while the browser tab is visible without losing client state. */
export default function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);

  return null;
}
