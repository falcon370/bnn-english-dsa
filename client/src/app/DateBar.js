'use client';

import { useEffect, useState } from 'react';
import WeatherWidget from '@/components/WeatherWidget';

export default function DateBar() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const dateStr = mounted ? new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).toUpperCase() : '';

    return (
        <div className="bg-[#0e3a8a] border-t border-white/10">
            <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-8 flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-[0.15em] text-blue-200 whitespace-nowrap">
                <div className="flex items-center gap-2 md:gap-4 min-w-0">
                    {dateStr ? (
                        <>
                            <span className="hidden sm:inline">{dateStr}</span>
                            <span className="hidden sm:inline text-blue-400">|</span>
                        </>
                    ) : null}
                    
                    {mounted ? (
                        <WeatherWidget />
                    ) : (
                        <span className="text-[10px] font-bold uppercase text-blue-200 tracking-[0.1em]">
                            New Delhi, India
                        </span>
                    )}
                </div>
                <div className="flex gap-4 flex-shrink-0">
                    <span className="text-red-400 flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        Live Updates
                    </span>
                </div>
            </div>
        </div>
    );
}
