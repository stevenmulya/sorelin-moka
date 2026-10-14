'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Memuat ulang data server secara berkala (hanya saat tab terlihat) tanpa menghilangkan state klien. */
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
