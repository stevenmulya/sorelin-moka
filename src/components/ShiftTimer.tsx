'use client';

import { useState, useEffect } from 'react';

export default function ShiftTimer({ startTime }: { startTime: Date }) {
  const [duration, setDuration] = useState('');

  useEffect(() => {
    const start = new Date(startTime).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, now - start);

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      let text = '';
      if (hours > 0) text += `${hours}h `;
      text += `${minutes}m`;
      
      setDuration(text);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // update every minute

    return () => clearInterval(interval);
  }, [startTime]);

  return <span className="font-semibold">{duration || '0m'}</span>;
}
