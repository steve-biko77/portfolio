"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaLocationArrow } from "react-icons/fa";

export type ShelfProject = {
    id: number;
    title: string;
    des: string;
    img: string;
    iconLists: string[];
    link: string;
};

/** Deterministic hue per project, so a spine always keeps its colour. */
function hue(str: string) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % 360;
}

const smoothstep = (x: number) => x * x * (3 - 2 * x);

/** Neighbours step aside by half the open cover's extra width, smoothly. */
function bump(r: number) {
    return Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : r > 0 ? 0.5 : -0.5;
}

export const ProjectShelf = ({ items }: { items: ShelfProject[] }) => {
    const n = items.length;
    const copies = Math.max(3, Math.ceil(24 / n));
    const total = n * copies;

    const wrapRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const tapeRefs = useRef<(HTMLDivElement | null)[]>([]);

    const pos = useRef(Math.floor(n / 2) + n);
    const target = useRef(pos.current);
    const hovered = useRef(-1);
    const lifts = useRef<number[]>(new Array(total).fill(0));
    const pointer = useRef({ x: 0, y: 0 });
    const tilt = useRef({ x: 0, y: 0 });
    const drag = useRef({ on: false, moved: false, x0: 0, t0: 0 });

    const [dims, setDims] = useState({ H: 360, ws: 61, d: 190, gap: 11 });
    const [active, setActive] = useState(pos.current % n);

    const measure = useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const H = Math.max(260, Math.min(wrap.clientWidth * 0.3, window.innerHeight * 0.46));
        setDims({ H, ws: (H * 142) / 840, d: (H * 474) / 900, gap: H * 0.03 });
    }, []);

    useEffect(() => {
        measure();
        let t: ReturnType<typeof setTimeout>;
        const onResize = () => {
            clearTimeout(t);
            t = setTimeout(measure, 140);
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
            tilt.current.y += ((pointer.current.x / Math.max(1, vw)) * 10 - tilt.current.y) * ease;
            tilt.current.x += (pointer.current.y * 6 - tilt.current.x) * ease;

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

                const open = smoothstep(Math.max(0, 1 - Math.abs(r)));
                const wantLift = hovered.current === v && Math.abs(r) > 0.5 ? 1 : 0;
                lifts.current[v] += (wantLift - lifts.current[v]) * (reduce ? 1 : 1 - Math.exp(-12 * dt));

                const ry = -90 * open + tilt.current.y * open;
                const rx = tilt.current.x * open;
                const y = -open * 0.025 * H - lifts.current[v] * 0.045 * H;
                el.style.transform =
                    `translate3d(${x}px,${y}px,${open * 0.2 * H}px) rotateZ(${-4.5 * open}deg) rotateX(${rx}deg) rotateY(${ry}deg)`;
                el.style.zIndex = String(Math.round(100 - Math.abs(r) * 4));
                el.style.setProperty("--spine-dim", (open * 0.55).toFixed(3));
                el.style.setProperty("--cover-dim", ((1 - open) * 0.5).toFixed(3));
            }

            const a = ((Math.round(pos.current) % n) + n) % n;
            setActive((p) => (p === a ? p : a));

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [dims, n, total, relative]);

    const onPointerMove = (e: React.PointerEvent) => {
        const box = wrapRef.current?.getBoundingClientRect();
        if (box) {
            pointer.current.x = e.clientX - box.left - box.width / 2;
            pointer.current.y = -((e.clientY - box.top - box.height / 2) / (box.height / 2));
        }
        if (drag.current.on) {
            const dx = e.clientX - drag.current.x0;
            if (Math.abs(dx) > 5) drag.current.moved = true;
            if (drag.current.moved) target.current = drag.current.t0 - dx / (dims.ws + dims.gap);
        }
    };
    const endDrag = () => {
        if (!drag.current.on) return;
        drag.current.on = false;
        target.current = Math.round(target.current);
        setTimeout(() => {
            drag.current.moved = false;
        }, 30);
    };

    const step = (dir: number) => {
        target.current = Math.round(target.current) + dir;
    };

    const current = items[active];

    return (
        <div className="w-full">
            <div
                ref={wrapRef}
                onPointerMove={onPointerMove}
                onPointerDown={(e) => {
                    drag.current = { on: true, moved: false, x0: e.clientX, t0: target.current };
                    wrapRef.current?.setPointerCapture(e.pointerId);
                }}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onPointerLeave={() => {
                    hovered.current = -1;
                    pointer.current = { x: 0, y: 0 };
                }}
                onWheel={(e) => {
                    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
                    target.current = Math.round(target.current + e.deltaX / (dims.ws + dims.gap) * 0.5);
                }}
                className="relative w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
                style={{ height: dims.H + 150, perspective: "2200px", perspectiveOrigin: "50% 44%" }}
            >
                <div
                    ref={stageRef}
                    className="absolute left-1/2 h-0 w-0"
                    style={{ top: "44%", transformStyle: "preserve-3d" }}
                >
                    {Array.from({ length: total }, (_, v) => {
                        const p = items[v % n];
                        const h = hue(p.title);
                        const spine = `linear-gradient(170deg, hsl(${h} 42% 74%), hsl(${h} 34% 58%))`;
                        return (
                            <div
                                key={v}
                                ref={(el) => {
                                    tapeRefs.current[v] = el;
                                }}
                                onPointerEnter={() => {
                                    hovered.current = v;
                                }}
                                onClick={() => {
                                    if (drag.current.moved) return;
                                    const r = relative(v);
                                    if (Math.abs(r) < 0.5) window.open(p.link, "_blank", "noopener");
                                    else target.current = Math.round(target.current + r);
                                }}
                                className="absolute h-0 w-0 cursor-pointer"
                                style={{ transformStyle: "preserve-3d", willChange: "transform" }}
                            >
                                {/* spine: the book standing on the shelf */}
                                <div
                                    className="absolute overflow-hidden rounded-[3px] border border-black/50"
                                    style={{
                                        width: dims.ws,
                                        height: dims.H,
                                        left: -dims.ws / 2,
                                        top: -dims.H / 2,
                                        transform: `translateZ(${dims.d / 2}px)`,
                                        backfaceVisibility: "hidden",
                                        background: spine,
                                    }}
                                >
                                    <div className="flex h-full flex-col items-center justify-between py-[9px]">
                                        <span
                                            className="rounded-[1px] bg-black/25"
                                            style={{ width: "60%", aspectRatio: "1" }}
                                        />
                                        <span
                                            className="overflow-hidden font-bold uppercase leading-none text-black-100"
                                            style={{
                                                writingMode: "vertical-rl",
                                                fontSize: dims.ws * 0.26,
                                                letterSpacing: ".02em",
                                                maxHeight: "58%",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {p.title}
                                        </span>
                                        <span
                                            className="border border-black/60 px-[3px] py-px font-mono text-black-100/80"
                                            style={{ fontSize: dims.ws * 0.15 }}
                                        >
                                            SBWK
                                        </span>
                                    </div>
                                    <span
                                        className="pointer-events-none absolute inset-0 bg-black"
                                        style={{ opacity: "var(--spine-dim,0)" }}
                                    />
                                </div>

                                {/* cover: the face that turns towards the reader */}
                                <div
                                    className="absolute flex flex-col overflow-hidden rounded-[4px] bg-black-100 p-[5%] shadow-[0_34px_70px_-26px_rgba(0,0,0,.95)]"
                                    style={{
                                        width: dims.d,
                                        height: dims.H,
                                        left: -dims.d / 2,
                                        top: -dims.H / 2,
                                        transform: `rotateY(90deg) translateZ(${dims.ws / 2}px)`,
                                        backfaceVisibility: "hidden",
                                        border: `1px solid hsl(${h} 34% 58% / .5)`,
                                    }}
                                >
                                    <div
                                        className="flex items-center justify-between font-mono uppercase text-white-200/60"
                                        style={{ fontSize: dims.d * 0.032, letterSpacing: ".1em" }}
                                    >
                                        <span>Steve Biko</span>
                                        <span>{String(p.id).padStart(2, "0")}</span>
                                    </div>

                                    <div
                                        className="relative my-[5%] flex-1 overflow-hidden rounded-[3px]"
                                        style={{ background: `hsl(${h} 30% 16%)` }}
                                    >
                                        <img src={p.img} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
                                    </div>

                                    <h3
                                        className="font-bold uppercase leading-[1.05] text-white"
                                        style={{ fontSize: dims.d * 0.085 }}
                                    >
                                        {p.title}
                                    </h3>

                                    <div className="mt-[4%] flex items-center justify-between">
                                        <div className="flex items-center">
                                            {p.iconLists.slice(0, 5).map((icon, i) => (
                                                <span
                                                    key={icon}
                                                    className="flex items-center justify-center rounded-full border border-white/20 bg-black"
                                                    style={{
                                                        width: dims.d * 0.1,
                                                        height: dims.d * 0.1,
                                                        transform: `translateX(-${4 * i}px)`,
                                                    }}
                                                >
                                                    <img src={icon} alt="" className="h-1/2 w-1/2 object-contain" />
                                                </span>
                                            ))}
                                        </div>
                                        <FaLocationArrow color="#CBACF9" size={dims.d * 0.05} />
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
                    onClick={() => step(-1)}
                    aria-label="Projet précédent"
                    className="absolute left-2 top-[44%] z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded border border-white/15 bg-black-200 text-white transition-colors hover:border-purple hover:text-purple"
                >
                    <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.3">
                        <path d="M5 1 L1 5 L5 9 M1 5 H17" />
                    </svg>
                </button>
                <button
                    onClick={() => step(1)}
                    aria-label="Projet suivant"
                    className="absolute right-2 top-[44%] z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded border border-white/15 bg-black-200 text-white transition-colors hover:border-purple hover:text-purple"
                >
                    <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.3">
                        <path d="M13 1 L17 5 L13 9 M17 5 H1" />
                    </svg>
                </button>
            </div>

            <div className="mx-auto mt-2 max-w-2xl px-4 text-center" aria-live="polite">
                <h3 className="text-xl font-bold text-white md:text-2xl">{current.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-white-200/75">{current.des}</p>
                <a
                    href={current.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm text-purple hover:underline"
                >
                    Check Project <FaLocationArrow size={12} />
                </a>
            </div>
        </div>
    );
};

export default ProjectShelf;
