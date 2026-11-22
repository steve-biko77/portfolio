"use client";

import { useEffect, useRef, useState } from "react";

/** Section intertitle: "NIVEAU 03 — PROJETS", revealed once when it enters the viewport. */
export function LevelTitle({ n, name }: { n: number; name: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [on, setOn] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.6 });
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <div ref={ref} className="game-anim mx-auto flex max-w-3xl items-center gap-4 px-4 pt-24 font-mono text-[11px] uppercase tracking-[.22em]">
            <span
                className="h-px flex-1 origin-right bg-gradient-to-l from-purple/70 to-transparent transition-transform duration-[900ms]"
                style={{ transform: on ? "scaleX(1)" : "scaleX(0)" }}
            />
            <span className={`whitespace-nowrap text-white-200 transition-all duration-700 ${on ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
                <span className="text-purple">Niveau {String(n).padStart(2, "0")}</span> — {name}
            </span>
            <span
                className="h-px flex-1 origin-left bg-gradient-to-r from-purple/70 to-transparent transition-transform duration-[900ms]"
                style={{ transform: on ? "scaleX(1)" : "scaleX(0)" }}
            />
        </div>
    );
}

/** Fade/slide a block in the first time it scrolls into view. */
export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [on, setOn] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.08 });
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <div ref={ref} className={`game-anim transition-all duration-[900ms] ease-out ${on ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"} ${className}`}>
            {children}
        </div>
    );
}
