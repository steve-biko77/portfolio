"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaLocationArrow } from "react-icons/fa";

export type ShelfProject = {
    id: number;
    title: string;
    des: string;
    long: string;
    year: number;
    kind: string;
    stack: string[];
    img: string;
    iconLists: string[];
    link: string;
    hue: number;
};

const EASE = "cubic-bezier(.2,.8,.2,1)";
const SHEET_EASE = "cubic-bezier(.76,0,.18,1)";
const smoothstep = (x: number) => x * x * (3 - 2 * x);

/** Neighbours step aside by half the open cover's extra width, continuously. */
const bump = (r: number) =>
    Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : r > 0 ? 0.5 : -0.5;

function rng(seed: number) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** Cover art: a nebula field in the project's hue, matching the site's space theme. */
function paintCover(cv: HTMLCanvasElement, hue: number, seed: number) {
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr;
    cv.height = h * dpr;
    const g = cv.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = rng(seed * 7919 + 13);

    g.fillStyle = "#04060F";
    g.fillRect(0, 0, w, h);

    // nebula clouds
    for (let i = 0; i < 5; i++) {
        const cx = w * (0.15 + r() * 0.7);
        const cy = h * (0.12 + r() * 0.72);
        const rad = Math.max(w, h) * (0.22 + r() * 0.42);
        const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
        const hh = hue + (r() - 0.5) * 48;
        grd.addColorStop(0, `hsla(${hh} 78% ${44 + r() * 18}% / ${0.3 + r() * 0.3})`);
        grd.addColorStop(1, "hsla(230 70% 8% / 0)");
        g.fillStyle = grd;
        g.beginPath();
        g.arc(cx, cy, rad, 0, Math.PI * 2);
        g.fill();
    }

    // orbital arcs
    const ox = w * (0.3 + r() * 0.4);
    const oy = h * (0.35 + r() * 0.3);
    for (let i = 5; i > 0; i--) {
        g.beginPath();
        g.ellipse(ox, oy, Math.min(w, h) * 0.13 * i * (0.6 + r() * 0.3),
            Math.min(w, h) * 0.055 * i * (0.6 + r() * 0.4), r() * Math.PI, 0, Math.PI * 2);
        g.strokeStyle = `hsla(${hue} 70% 76% / ${0.07 + r() * 0.14})`;
        g.lineWidth = 0.7 + r();
        g.stroke();
    }

    // a planet
    const px = w * (0.28 + r() * 0.44);
    const py = h * (0.3 + r() * 0.34);
    const pr = Math.min(w, h) * (0.11 + r() * 0.1);
    const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, `hsl(${hue} 72% 70%)`);
    pg.addColorStop(1, `hsl(${hue + 20} 60% 20%)`);
    g.fillStyle = pg;
    g.beginPath();
    g.arc(px, py, pr, 0, Math.PI * 2);
    g.fill();

    // star field
    for (let i = 0; i < 150; i++) {
        const sx = r() * w;
        const sy = r() * h;
        const sr = r() * 1.1 + 0.2;
        g.beginPath();
        g.arc(sx, sy, sr, 0, Math.PI * 2);
        g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.75})`;
        g.fill();
    }
}

export const ProjectShelf = ({ items }: { items: ShelfProject[] }) => {
    const n = items.length;
    const copies = Math.max(3, Math.ceil(27 / n));
    const total = n * copies;

    const wrapRef = useRef<HTMLDivElement>(null);
    const tapeRefs = useRef<(HTMLDivElement | null)[]>([]);
    const coverRefs = useRef<(HTMLDivElement | null)[]>([]);
    const dialogRef = useRef<HTMLDivElement>(null);
    const detailCanvas = useRef<HTMLCanvasElement>(null);

    const pos = useRef(n + Math.floor(n / 2));
    const target = useRef(pos.current);
    const hovered = useRef(-1);
    const lifts = useRef<number[]>(new Array(total).fill(0));
    const point = useRef({ x: 0, y: 0 });
    const tilt = useRef({ x: 0, y: 0 });
    const drag = useRef({ on: false, moved: false, x0: 0, t0: 0 });
    const painted = useRef<Set<number>>(new Set());
    const openRef = useRef(false);
    /** Auto-advance so the shelf keeps turning for a visitor who is only scrolling past. */
    const inside = useRef(false);
    const autoClock = useRef(0);
    const AUTO_EVERY = 1.5;

    const [dims, setDims] = useState({ H: 340, ws: 57, d: 179, gap: 10 });
    const [active, setActive] = useState(pos.current % n);
    const [open, setOpen] = useState(false);

    const measure = useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const H = Math.max(250, Math.min(wrap.clientWidth * 0.3, window.innerHeight * 0.46));
        setDims({ H, ws: (H * 142) / 840, d: (H * 474) / 900, gap: H * 0.03 });
        painted.current.clear();
    }, []);

    useEffect(() => {
        measure();
        let t: ReturnType<typeof setTimeout>;
        const onResize = () => {
            clearTimeout(t);
            t = setTimeout(measure, 150);
        };
        window.addEventListener("resize", onResize);
        return () => {
            window.removeEventListener("resize", onResize);
            clearTimeout(t);
        };
    }, [measure]);

    const relative = useCallback(
        (v: number) => {
            let r = (v - pos.current) % total;
            if (r > total / 2) r -= total;
            if (r < -total / 2) r += total;
            return r;
        },
        [total]
    );

    useEffect(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const { H, ws, d, gap } = dims;
        let raf = 0;
        let last = performance.now();

        const tick = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            if (!reduce && !inside.current && !drag.current.on && !openRef.current) {
                autoClock.current += dt;
                if (autoClock.current >= AUTO_EVERY) {
                    autoClock.current = 0;
                    target.current = Math.round(target.current) + 1;
                }
            } else {
                autoClock.current = 0;
            }

            const k = reduce ? 1 : drag.current.on ? 18 : 5.2;
            pos.current += (target.current - pos.current) * (1 - Math.exp(-k * dt));
            if (Math.abs(target.current - pos.current) < 1e-4) pos.current = target.current;
            if (Math.abs(pos.current) > total * 4) {
                const shift = Math.round(pos.current / total) * total;
                pos.current -= shift;
                target.current -= shift;
            }

            const vw = wrapRef.current?.clientWidth ?? 1200;
            const ease = 1 - Math.exp(-7 * dt);
            tilt.current.y += ((point.current.x / Math.max(1, vw)) * 12 - tilt.current.y) * ease;
            tilt.current.x += (point.current.y * 6 - tilt.current.x) * ease;

            for (let v = 0; v < total; v++) {
                const el = tapeRefs.current[v];
                if (!el) continue;
                const r = relative(v);
                const x = r * (ws + gap) + (d - ws + 1.6 * gap) * bump(r);
                if (Math.abs(x) > vw / 2 + 1.6 * d) {
                    if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
                    continue;
                }
                if (el.style.visibility === "hidden") el.style.visibility = "visible";

                const o = smoothstep(Math.max(0, 1 - Math.abs(r)));
                const want = hovered.current === v && Math.abs(r) > 0.5 ? 1 : 0;
                lifts.current[v] += (want - lifts.current[v]) * (reduce ? 1 : 1 - Math.exp(-12 * dt));

                el.style.transform =
                    `translate3d(${x}px,${-o * 0.025 * H - lifts.current[v] * 0.045 * H}px,${o * 0.2 * H}px)` +
                    ` rotateZ(${-4.5 * o}deg) rotateX(${tilt.current.x * o}deg) rotateY(${-90 * o + tilt.current.y * o}deg)`;
                el.style.zIndex = String(Math.round(100 - Math.abs(r) * 4));
                el.style.setProperty("--spine-dim", (o * 0.55).toFixed(3));
                el.style.setProperty("--cover-dim", ((1 - o) * 0.5).toFixed(3));

                if (o > 0.02 && !painted.current.has(v)) {
                    const cv = coverRefs.current[v]?.querySelector("canvas");
                    if (cv) {
                        paintCover(cv as HTMLCanvasElement, items[v % n].hue, items[v % n].id);
                        painted.current.add(v);
                    }
                }
            }

            const a = ((Math.round(pos.current) % n) + n) % n;
            setActive((p) => (p === a ? p : a));

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [dims, n, total, relative, items]);

    /* ---------- opening a book ---------- */
    const openBook = useCallback(() => {
        if (openRef.current) return;
        openRef.current = true;
        target.current = Math.round(target.current);

        const v = tapeRefs.current.findIndex((_, i) => Math.abs(relative(i)) < 0.5);
        const face = v >= 0 ? coverRefs.current[v] : null;
        const box = face?.getBoundingClientRect();
        setOpen(true);

        requestAnimationFrame(() => {
            const dlg = dialogRef.current;
            if (!dlg) return;
            const cv = detailCanvas.current;
            if (cv) paintCover(cv, items[active].hue, items[active].id);

            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (box) {
                dlg.animate(
                    [
                        {
                            clipPath: `inset(${box.top}px ${innerWidth - box.right}px ${innerHeight - box.bottom}px ${box.left}px round 4px)`,
                            transform: "rotate(-4.5deg)",
                        },
                        { clipPath: "inset(0 0 0 0 round 0)", transform: "rotate(0)" },
                    ],
                    { duration: reduce ? 1 : 1000, easing: SHEET_EASE, fill: "both" }
                );
            }
            dlg.querySelectorAll<HTMLElement>("[data-rise]").forEach((el, i) => {
                el.animate([{ transform: "translateY(110%)" }, { transform: "translateY(0)" }], {
                    duration: reduce ? 1 : 880,
                    delay: reduce ? 0 : 420 + i * 75,
                    easing: EASE,
                    fill: "both",
                });
            });
        });
    }, [relative, active, items]);

    const closeBook = useCallback(() => {
        if (!openRef.current) return;
        const dlg = dialogRef.current;
        const v = tapeRefs.current.findIndex((_, i) => Math.abs(relative(i)) < 0.5);
        const box = v >= 0 ? coverRefs.current[v]?.getBoundingClientRect() : null;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const done = () => {
            setOpen(false);
            openRef.current = false;
            dlg?.getAnimations().forEach((a) => a.cancel());
        };
        if (!dlg || !box) return done();
        const an = dlg.animate(
            [
                { clipPath: "inset(0 0 0 0 round 0)", transform: "rotate(0)" },
                {
                    clipPath: `inset(${box.top}px ${innerWidth - box.right}px ${innerHeight - box.bottom}px ${box.left}px round 4px)`,
                    transform: "rotate(-4.5deg)",
                },
            ],
            { duration: reduce ? 1 : 820, easing: SHEET_EASE, fill: "both" }
        );
        an.onfinish = done;
    }, [relative]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") return closeBook();
            if (openRef.current) return;
            if (e.key === "ArrowLeft") target.current = Math.round(target.current) - 1;
            if (e.key === "ArrowRight") target.current = Math.round(target.current) + 1;
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [closeBook]);

    const years = Array.from(new Set(items.map((p) => p.year))).sort();
    const current = items[active];
    const allTools = Array.from(new Set(items.flatMap((p) => p.stack)));

    return (
        <div className="w-full">
            {/* year tabs */}
            <nav aria-label="Années" className="mb-6 flex flex-wrap justify-center">
                {years.map((y) => {
                    const on = current.year === y;
                    return (
                        <button
                            key={y}
                            onClick={() => {
                                const i = items.findIndex((p) => p.year === y);
                                const cur = ((Math.round(target.current) % n) + n) % n;
                                let diff = i - cur;
                                if (diff > n / 2) diff -= n;
                                if (diff < -n / 2) diff += n;
                                target.current = Math.round(target.current) + diff;
                            }}
                            className={`-ml-px h-7 border px-3 font-mono text-[11px] tracking-[.1em] transition-colors first:ml-0 ${
                                on
                                    ? "z-10 border-purple bg-purple text-black-100"
                                    : "border-white/15 text-white-200/70 hover:text-white"
                            }`}
                        >
                            {y}
                        </button>
                    );
                })}
            </nav>

            <div
                ref={wrapRef}
                onPointerMove={(e) => {
                    const b = wrapRef.current?.getBoundingClientRect();
                    if (b) {
                        point.current.x = e.clientX - b.left - b.width / 2;
                        point.current.y = -((e.clientY - b.top - b.height / 2) / (b.height / 2));
                    }
                    if (drag.current.on) {
                        const dx = e.clientX - drag.current.x0;
                        if (Math.abs(dx) > 5) drag.current.moved = true;
                        if (drag.current.moved) target.current = drag.current.t0 - dx / (dims.ws + dims.gap);
                    }
                }}
                onPointerEnter={() => (inside.current = true)}
                onPointerDown={(e) => {
                    if (openRef.current) return;
                    drag.current = { on: true, moved: false, x0: e.clientX, t0: target.current };
                    wrapRef.current?.setPointerCapture(e.pointerId);
                }}
                onPointerUp={() => {
                    if (!drag.current.on) return;
                    drag.current.on = false;
                    target.current = Math.round(target.current);
                    setTimeout(() => (drag.current.moved = false), 30);
                }}
                onPointerLeave={() => {
                    hovered.current = -1;
                    inside.current = false;
                    point.current = { x: 0, y: 0 };
                }}
                onWheel={(e) => {
                    if (openRef.current || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
                    target.current = Math.round(target.current + (e.deltaX / (dims.ws + dims.gap)) * 0.5);
                }}
                className="relative w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
                style={{ height: dims.H + 130, perspective: "2200px", perspectiveOrigin: "50% 46%" }}
            >
                <div className="absolute left-1/2 h-0 w-0" style={{ top: "46%", transformStyle: "preserve-3d" }}>
                    {Array.from({ length: total }, (_, v) => {
                        const p = items[v % n];
                        return (
                            <div
                                key={v}
                                ref={(el) => {
                                    tapeRefs.current[v] = el;
                                }}
                                onPointerEnter={() => (hovered.current = v)}
                                onClick={() => {
                                    if (drag.current.moved || openRef.current) return;
                                    const r = relative(v);
                                    if (Math.abs(r) >= 0.5) target.current = Math.round(target.current + r);
                                }}
                                onDoubleClick={() => {
                                    if (openRef.current) return;
                                    const r = relative(v);
                                    if (Math.abs(r) >= 0.5) {
                                        target.current = Math.round(target.current + r);
                                        setTimeout(openBook, 420);
                                    } else openBook();
                                }}
                                className="absolute h-0 w-0 cursor-pointer"
                                style={{ transformStyle: "preserve-3d", willChange: "transform" }}
                            >
                                {/* spine */}
                                <div
                                    className="absolute overflow-hidden rounded-[3px]"
                                    style={{
                                        width: dims.ws,
                                        height: dims.H,
                                        left: -dims.ws / 2,
                                        top: -dims.H / 2,
                                        transform: `translateZ(${dims.d / 2}px)`,
                                        backfaceVisibility: "hidden",
                                        background: `linear-gradient(168deg, hsl(${p.hue} 26% 17%), #05070F 62%)`,
                                        border: `1px solid hsl(${p.hue} 60% 62% / .28)`,
                                        boxShadow: `inset 0 0 ${dims.ws * 0.5}px hsl(${p.hue} 70% 50% / .12)`,
                                    }}
                                >
                                    <div className="flex h-full flex-col items-center justify-between py-[9px]">
                                        <span
                                            className="rounded-[2px]"
                                            style={{
                                                width: "58%",
                                                aspectRatio: "1",
                                                background: `linear-gradient(140deg, hsl(${p.hue} 72% 64%), hsl(${p.hue + 28} 60% 38%))`,
                                                boxShadow: `0 0 ${dims.ws * 0.35}px hsl(${p.hue} 80% 58% / .5)`,
                                            }}
                                        />
                                        <span
                                            className="overflow-hidden font-bold uppercase leading-none text-white/90"
                                            style={{
                                                writingMode: "vertical-rl",
                                                fontSize: dims.ws * 0.25,
                                                letterSpacing: ".04em",
                                                maxHeight: "56%",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {p.title}
                                        </span>
                                        <span className="flex flex-col items-center gap-1">
                                            <i
                                                className="font-mono not-italic text-white-200/55"
                                                style={{ fontSize: dims.ws * 0.16 }}
                                            >
                                                {p.year}
                                            </i>
                                            <i
                                                className="border border-white/20 px-[3px] font-mono not-italic text-white-200/45"
                                                style={{ fontSize: dims.ws * 0.13 }}
                                            >
                                                SBWK
                                            </i>
                                        </span>
                                    </div>
                                    <span
                                        className="pointer-events-none absolute inset-0 bg-black"
                                        style={{ opacity: "var(--spine-dim,0)" }}
                                    />
                                </div>

                                {/* cover */}
                                <div
                                    ref={(el) => {
                                        coverRefs.current[v] = el;
                                    }}
                                    className="absolute flex flex-col overflow-hidden rounded-[5px] p-[6%]"
                                    style={{
                                        width: dims.d,
                                        height: dims.H,
                                        left: -dims.d / 2,
                                        top: -dims.H / 2,
                                        transform: `rotateY(90deg) translateZ(${dims.ws / 2}px)`,
                                        backfaceVisibility: "hidden",
                                        background: "#060810",
                                        border: `1px solid hsl(${p.hue} 60% 62% / .35)`,
                                        boxShadow: `0 34px 70px -24px #000, 0 0 60px -20px hsl(${p.hue} 70% 50% / .5)`,
                                    }}
                                >
                                    <div
                                        className="flex items-center justify-between font-mono uppercase tracking-[.12em] text-white-200/55"
                                        style={{ fontSize: dims.d * 0.031 }}
                                    >
                                        <span>Steve Biko</span>
                                        <span>{p.year}</span>
                                    </div>

                                    <div className="relative my-[5%] flex-1 overflow-hidden rounded-[3px]">
                                        <canvas className="absolute inset-0 h-full w-full" />
                                        {p.img && (
                                            <img
                                                src={p.img}
                                                alt=""
                                                className="absolute inset-x-0 bottom-0 w-full object-contain opacity-95"
                                            />
                                        )}
                                    </div>

                                    <h3
                                        className="font-bold uppercase leading-[1.04] text-white"
                                        style={{ fontSize: dims.d * 0.088 }}
                                    >
                                        {p.title}
                                    </h3>
                                    <p
                                        className="mt-[2%] font-mono uppercase tracking-[.08em]"
                                        style={{ fontSize: dims.d * 0.03, color: `hsl(${p.hue} 70% 72%)` }}
                                    >
                                        {p.kind}
                                    </p>

                                    <div className="mt-[4%] flex items-center justify-between border-t border-white/10 pt-[4%]">
                                        <span
                                            className="font-mono uppercase tracking-[.1em] text-white-200/45"
                                            style={{ fontSize: dims.d * 0.028 }}
                                        >
                                            {p.stack.length} technos
                                        </span>
                                        <span
                                            className="font-mono uppercase tracking-[.1em] text-purple"
                                            style={{ fontSize: dims.d * 0.03 }}
                                        >
                                            Double-clic
                                        </span>
                                    </div>
                                    <span
                                        className="pointer-events-none absolute inset-0 bg-black"
                                        style={{ opacity: "var(--cover-dim,0)" }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={() => (target.current = Math.round(target.current) - 1)}
                    aria-label="Projet précédent"
                    className="absolute left-2 top-[46%] z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded border border-white/15 bg-black-200 text-white backdrop-blur transition-colors hover:border-purple hover:text-purple"
                >
                    <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.3">
                        <path d="M5 1 L1 5 L5 9 M1 5 H17" />
                    </svg>
                </button>
                <button
                    onClick={() => (target.current = Math.round(target.current) + 1)}
                    aria-label="Projet suivant"
                    className="absolute right-2 top-[46%] z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded border border-white/15 bg-black-200 text-white backdrop-blur transition-colors hover:border-purple hover:text-purple"
                >
                    <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.3">
                        <path d="M13 1 L17 5 L13 9 M17 5 H1" />
                    </svg>
                </button>
            </div>

            {/* caption */}
            <div className="mx-auto mt-1 max-w-2xl px-4 text-center" aria-live="polite">
                <h3 className="text-2xl font-bold uppercase tracking-wide text-white md:text-3xl">{current.title}</h3>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[.14em] text-purple">{current.kind}</p>
                <p className="mt-1 font-mono text-[11px] tracking-[.1em] text-white-200/55">{current.year}</p>

                <div className="mt-4 flex items-center justify-center">
                    {current.iconLists.map((icon, i) => (
                        <span
                            key={icon}
                            className="flex h-9 w-9 items-center justify-center rounded-full border bg-black transition-colors duration-500"
                            style={{
                                transform: `translateX(-${5 * i}px)`,
                                borderColor: `hsl(${current.hue} 60% 62% / .45)`,
                                boxShadow: `0 0 14px -4px hsl(${current.hue} 70% 55% / .6)`,
                            }}
                        >
                            <img src={icon} alt="" className="h-1/2 w-1/2 object-contain" />
                        </span>
                    ))}
                </div>

                <button
                    onClick={openBook}
                    className="mt-5 inline-flex items-center gap-2 rounded border border-purple/60 px-5 py-2 text-sm text-purple transition-colors hover:bg-purple hover:text-black-100"
                >
                    Ouvrir le livre <FaLocationArrow size={11} />
                </button>
            </div>

            {/* the toolbox: every technology used across the shelf, lit for the open book */}
            <div className="mx-auto mt-12 max-w-5xl px-4">
                <div className="flex flex-wrap justify-center gap-2">
                    {allTools.map((tool) => {
                        const on = current.stack.includes(tool);
                        return (
                            <span
                                key={tool}
                                className="rounded border px-3 py-1.5 font-mono text-[11px] tracking-[.04em] transition-all duration-500"
                                style={
                                    on
                                        ? {
                                              borderColor: `hsl(${current.hue} 70% 62%)`,
                                              color: `hsl(${current.hue} 80% 76%)`,
                                              background: `hsl(${current.hue} 70% 50% / .12)`,
                                              boxShadow: `0 0 18px -6px hsl(${current.hue} 80% 58% / .8)`,
                                          }
                                        : {
                                              borderColor: "rgba(255,255,255,.12)",
                                              color: "rgba(190,193,221,.45)",
                                          }
                                }
                            >
                                {tool}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* the opened book */}
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={current.title}
                className="fixed inset-0 z-[60] overflow-auto bg-black-100"
                style={{ visibility: open ? "visible" : "hidden" }}
            >
                <button
                    onClick={closeBook}
                    className="fixed left-6 top-6 z-[62] rounded border border-white/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.12em] text-white transition-colors hover:border-purple hover:text-purple"
                >
                    Fermer
                </button>

                <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-24 md:grid-cols-2 md:px-10">
                    <div className="flex flex-col gap-4">
                        <div className="overflow-hidden">
                            <p data-rise className="font-mono text-[11px] uppercase tracking-[.16em] text-purple">
                                {current.kind}
                            </p>
                        </div>
                        <div className="overflow-hidden">
                            <h2
                                data-rise
                                className="text-[clamp(34px,5vw,68px)] font-bold uppercase leading-[.98] tracking-tight text-white"
                            >
                                {current.title}
                            </h2>
                        </div>
                        <div className="overflow-hidden">
                            <p data-rise className="font-mono text-[11px] uppercase tracking-[.12em] text-white-200/60">
                                {current.year} / {current.stack.length} technologies
                            </p>
                        </div>
                        <div className="overflow-hidden">
                            <p data-rise className="max-w-[46ch] text-[15.5px] leading-relaxed text-white-100">
                                {current.long}
                            </p>
                        </div>
                        <div className="overflow-hidden">
                            <div data-rise className="flex flex-wrap gap-2">
                                {current.stack.map((s) => (
                                    <span
                                        key={s}
                                        className="rounded border border-white/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.08em] text-white-200/75"
                                    >
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                        {current.link && (
                            <div className="overflow-hidden">
                                <a
                                    data-rise
                                    href={current.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-2 rounded border border-purple px-5 py-3 text-sm text-purple transition-colors hover:bg-purple hover:text-black-100"
                                >
                                    Voir le projet <FaLocationArrow size={12} />
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="grid place-items-center">
                        <div
                            className="relative w-full max-w-[390px] overflow-hidden rounded-lg border"
                            style={{
                                aspectRatio: "474/760",
                                borderColor: `hsl(${current.hue} 60% 62% / .4)`,
                                boxShadow: `0 40px 90px -30px #000, 0 0 80px -24px hsl(${current.hue} 70% 50% / .55)`,
                            }}
                        >
                            <canvas ref={detailCanvas} className="absolute inset-0 h-full w-full" />
                            {current.img && (
                                <img src={current.img} alt="" className="absolute inset-x-0 bottom-0 w-full object-contain" />
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black-100 to-transparent p-6 pt-16">
                                <p className="text-sm text-white-100">{current.des}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectShelf;
