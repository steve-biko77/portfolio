"use client";

import { useEffect, useRef } from "react";

type Star = { x: number; y: number; z: number; hue: number };

/** Fixed deep-space backdrop. Stars drift with scroll and stretch into streaks at speed. */
export default function StarField() {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const cv = ref.current;
        if (!cv) return;
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let w = 0, h = 0, raf = 0;
        let stars: Star[] = [];
        let lastY = window.scrollY;
        let vel = 0;
        let t = 0;

        const resize = () => {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            w = window.innerWidth;
            h = window.innerHeight;
            cv.width = w * dpr;
            cv.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = Math.min(320, Math.round((w * h) / 5500));
            stars = Array.from({ length: n }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                z: Math.random() * 0.9 + 0.1,
                hue: [0, 0, 0, 215, 268][Math.floor(Math.random() * 5)],
            }));
        };

        const frame = () => {
            const y = window.scrollY;
            const d = y - lastY;
            lastY = y;
            vel += (d - vel) * 0.18;
            t += 0.016;
            ctx.clearRect(0, 0, w, h);
            for (const s of stars) {
                s.y -= vel * s.z * 0.55 + 0.05 * s.z;
                if (s.y < -20) { s.y = h + 10; s.x = Math.random() * w; }
                if (s.y > h + 20) { s.y = -10; s.x = Math.random() * w; }
                const tw = 0.65 + 0.35 * Math.sin(t * 2 + s.x);
                const a = (0.25 + s.z * 0.7) * tw;
                const col = s.hue ? `hsla(${s.hue},80%,75%,${a})` : `rgba(255,255,255,${a})`;
                const streak = Math.min(90, Math.abs(vel) * s.z * 2.2);
                ctx.strokeStyle = col;
                ctx.fillStyle = col;
                if (streak > 3) {
                    ctx.lineWidth = s.z * 1.4;
                    ctx.beginPath();
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(s.x, s.y + Math.sign(vel) * streak);
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, s.z * 1.25, 0, 6.283);
                    ctx.fill();
                }
            }
            if (!reduce) raf = requestAnimationFrame(frame);
        };

        resize();
        frame();
        window.addEventListener("resize", resize);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-black-100">
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(60% 50% at 15% 20%, rgba(203,172,249,.10), transparent 70%), radial-gradient(50% 45% at 85% 70%, rgba(60,110,255,.09), transparent 70%)",
                }}
            />
            <canvas ref={ref} className="absolute inset-0 h-full w-full" />
        </div>
    );
}
