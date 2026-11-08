"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export type Testimonial = {
    quote: string;
    name: string;
    title: string;
    /** Optional client photo in /public. Falls back to a generated panel. */
    img?: string;
    /** Marks a slot waiting for a real testimonial. */
    pending?: boolean;
};

/** Angular spacing between two neighbouring cards. Small angle = wide, gentle arc. */
const STEP = 18;
const SLOTS = Math.round(360 / STEP);

/** Deterministic hash so a given name always gets the same panel colours. */
function hash(str: string) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
}

export const TestimonialWall = ({ items }: { items: Testimonial[] }) => {
    const stageRef = useRef<HTMLDivElement>(null);
    const drumRef = useRef<HTMLDivElement>(null);

    const rot = useRef(0);
    const target = useRef(0);
    const paused = useRef(false);
    const dragging = useRef(false);
    const dragX = useRef(0);
    const dragRot = useRef(0);

    const [geo, setGeo] = useState({ w: 360, h: 500, r: 1200 });
    const [focus, setFocus] = useState(0);

    const measure = useCallback(() => {
        const stage = stageRef.current;
        if (!stage) return;
        const sw = stage.clientWidth;
        const w = Math.max(210, Math.min(420, sw * 0.3));
        const h = Math.min(w * 1.42, stage.clientHeight - 8);
        const gap = w * 0.055;
        const r = (w + gap) / (2 * Math.tan((STEP * Math.PI) / 360));
        setGeo({ w, h, r });
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

    useEffect(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let raf = 0;
        let last = performance.now();

        const tick = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            if (!paused.current && !dragging.current && !reduce) target.current -= dt * 2.6;

            const k = dragging.current ? 16 : 4.5;
            rot.current += (target.current - rot.current) * (1 - Math.exp(-k * dt));

            const drum = drumRef.current;
            if (drum) {
                drum.style.transform = `translateZ(${geo.r}px) rotateY(${rot.current}deg)`;

                // Shade and cull each card by how far it sits from the front of the drum.
                const kids = drum.children;
                for (let i = 0; i < kids.length; i++) {
                    const card = kids[i] as HTMLElement;
                    let a = (i * STEP + rot.current) % 360;
                    if (a > 180) a -= 360;
                    if (a < -180) a += 360;
                    const away = Math.abs(a);
                    if (away > 54) {
                        if (card.style.visibility !== "hidden") card.style.visibility = "hidden";
                        continue;
                    }
                    if (card.style.visibility === "hidden") card.style.visibility = "visible";
                    card.style.setProperty("--dim", String(Math.min(0.72, (away / 54) ** 1.4 * 0.85)));
                }

                const front = Math.round(-rot.current / STEP);
                const idx = ((front % items.length) + items.length) % items.length;
                setFocus((f) => (f === idx ? f : idx));
            }
            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [geo.r, items.length]);

    const onPointerDown = (e: React.PointerEvent) => {
        dragging.current = true;
        dragX.current = e.clientX;
        dragRot.current = target.current;
        stageRef.current?.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragging.current) return;
        target.current = dragRot.current + (e.clientX - dragX.current) * 0.09;
    };
    const endDrag = () => {
        dragging.current = false;
    };
    const onWheel = (e: React.WheelEvent) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        target.current += e.deltaX * 0.06;
    };

    const cards = Array.from({ length: SLOTS }, (_, i) => items[i % items.length]);

    return (
        <div className="w-full">
            <div
                ref={stageRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onWheel={onWheel}
                className="relative h-[clamp(420px,66vh,660px)] w-full cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing"
                style={{ perspective: "1900px", perspectiveOrigin: "50% 50%" }}
            >
                {/* side fades so the wall reads as endless */}
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[18%] bg-gradient-to-r from-black-100 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[18%] bg-gradient-to-l from-black-100 to-transparent" />

                <div
                    ref={drumRef}
                    className="absolute left-1/2 top-1/2 h-0 w-0"
                    style={{ transformStyle: "preserve-3d" }}
                >
                    {cards.map((t, i) => {
                        const seed = hash(t.name + i);
                        return (
                            <article
                                key={i}
                                onPointerEnter={() => {
                                    paused.current = true;
                                }}
                                onPointerLeave={() => {
                                    paused.current = false;
                                }}
                                className="group absolute overflow-hidden rounded-xl border border-white/10 bg-black-200 shadow-[0_40px_90px_-30px_rgba(0,0,0,.9)]"
                                style={{
                                    width: geo.w,
                                    height: geo.h,
                                    left: -geo.w / 2,
                                    top: -geo.h / 2,
                                    transform: `rotateY(${i * STEP}deg) translateZ(${-geo.r}px)`,
                                    backfaceVisibility: "hidden",
                                }}
                            >
                                {/* portrait layer */}
                                {t.img ? (
                                    <img src={t.img} alt={t.name} className="absolute inset-0 h-full w-full object-cover" />
                                ) : (
                                    <div
                                        className="absolute inset-0"
                                        style={{
                                            background: `radial-gradient(120% 90% at ${20 + seed * 60}% ${15 + seed * 30}%, rgba(203,172,249,.26), transparent 62%), linear-gradient(${150 + seed * 90}deg, #161a2e 0%, #0b0e1c 58%, #05070f 100%)`,
                                        }}
                                    >
                                        <span className="absolute inset-0 grid place-items-center text-[clamp(72px,9vw,128px)] font-bold leading-none text-white/[.07]">
                                            {t.name.replace(/^(DR|Dr)\.?\s*/, "").slice(0, 1).toUpperCase()}
                                        </span>
                                    </div>
                                )}

                                {/* the recommendation sits over the photo */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black-100 via-black-100/80 to-black-100/10" />

                                {t.pending && (
                                    <span className="absolute left-4 top-4 rounded-full border border-purple/50 px-3 py-1 text-[10px] uppercase tracking-[.14em] text-purple">
                                        En attente
                                    </span>
                                )}

                                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-6">
                                    <p
                                        className={`text-[clamp(13px,1.05vw,15px)] leading-relaxed ${
                                            t.pending ? "italic text-white-200/55" : "text-white-100"
                                        }`}
                                    >
                                        {t.pending ? t.quote : `“${t.quote}”`}
                                    </p>
                                    <div className="border-t border-white/10 pt-4">
                                        <p className="text-[clamp(14px,1.1vw,17px)] font-semibold text-white">{t.name}</p>
                                        <p className="mt-1 text-[11px] uppercase tracking-[.1em] text-white-200/70">{t.title}</p>
                                    </div>
                                </div>

                                {/* depth shading, driven from the animation loop */}
                                <div
                                    className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-150"
                                    style={{ opacity: "var(--dim,0)" }}
                                />
                            </article>
                        );
                    })}
                </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                {items.map((t, i) => (
                    <button
                        key={i}
                        aria-label={`Voir le témoignage de ${t.name}`}
                        onClick={() => {
                            const front = Math.round(-target.current / STEP);
                            const cur = ((front % items.length) + items.length) % items.length;
                            let diff = i - cur;
                            if (diff > items.length / 2) diff -= items.length;
                            if (diff < -items.length / 2) diff += items.length;
                            target.current = -(front + diff) * STEP;
                        }}
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                            focus === i ? "w-10 bg-purple" : "w-4 bg-white/20 hover:bg-white/40"
                        }`}
                    />
                ))}
            </div>
        </div>
    );
};

export default TestimonialWall;
