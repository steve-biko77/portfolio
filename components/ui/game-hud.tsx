"use client";

import { useEffect, useRef, useState } from "react";

export type Level = { id: string; name: string };

/** Fixed HUD: XP bar on top, level badge bottom-left, clickable level rail on the right. */
export default function GameHud({ levels }: { levels: Level[] }) {
    const bar = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const [pct, setPct] = useState(0);

    useEffect(() => {
        let raf = 0;
        const update = () => {
            raf = 0;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
            if (bar.current) bar.current.style.transform = `scaleX(${p})`;
            setPct(Math.round(p * 100));
            const probe = window.innerHeight * 0.4;
            let idx = 0;
            levels.forEach((l, i) => {
                const el = document.getElementById(l.id);
                if (el && el.getBoundingClientRect().top <= probe) idx = i;
            });
            setActive(idx);
        };
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [levels]);

    const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

    return (
        <>
            <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] bg-white/5">
                <div
                    ref={bar}
                    className="h-full origin-left bg-gradient-to-r from-purple via-blue-100 to-white"
                    style={{ transform: "scaleX(0)" }}
                />
            </div>

            <div className="pointer-events-none fixed bottom-4 left-4 z-[60] font-mono text-[10px] uppercase tracking-[.16em] text-white-200/70 sm:bottom-6 sm:left-6">
                <div className="mb-1 text-purple">
                    Niveau {String(active + 1).padStart(2, "0")} / {String(levels.length).padStart(2, "0")}
                </div>
                <div className="text-white">{levels[active]?.name}</div>
                <div className="mt-1 text-white-200/50">XP {String(pct).padStart(3, "0")}%</div>
            </div>

            <nav
                aria-label="Niveaux"
                className="fixed right-3 top-1/2 z-[60] hidden -translate-y-1/2 flex-col items-end gap-3 md:flex"
            >
                {levels.map((l, i) => (
                    <button
                        key={l.id}
                        onClick={() => go(l.id)}
                        aria-label={l.name}
                        aria-current={i === active}
                        className="group flex items-center gap-3"
                    >
                        <span
                            className={`font-mono text-[10px] uppercase tracking-[.14em] transition-all duration-300 ${
                                i === active ? "translate-x-0 text-purple opacity-100" : "translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-80 text-white-200"
                            }`}
                        >
                            {l.name}
                        </span>
                        <span
                            className={`block rounded-full transition-all duration-300 ${
                                i === active ? "h-3 w-3 bg-purple shadow-[0_0_14px_3px_rgba(203,172,249,.6)]" : i < active ? "h-2 w-2 bg-purple/50" : "h-2 w-2 bg-white/25"
                            }`}
                        />
                    </button>
                ))}
            </nav>
        </>
    );
}
