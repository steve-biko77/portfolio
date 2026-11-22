"use client";

import React, { useEffect, useRef, useState } from "react";
import MagicButton from "@/components/ui/MagicButton";
import { FaLocationArrow } from "react-icons/fa";

const ROLES = ["Data Analyst", "Développeur IA", "Automatisation", "Dashboards sur mesure"];
const NAME = ["STEVE", "BIKO"];

const Hero = () => {
    const wrap = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const [role, setRole] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setRole((r) => (r + 1) % ROLES.length), 2600);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        let raf = 0;
        const apply = () => {
            raf = 0;
            const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9)));
            if (content.current) {
                content.current.style.transform = `translateY(${p * 90}px) scale(${1 - p * 0.08})`;
                content.current.style.opacity = String(Math.max(0, 1 - p * 1.5));
            }
        };
        const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
        apply();
        window.addEventListener("scroll", queue, { passive: true });
        return () => {
            window.removeEventListener("scroll", queue);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []);

    return (
        <div ref={wrap} id="top" className="game-anim relative flex min-h-screen flex-col items-center justify-center overflow-hidden pb-16 pt-28">
            <div ref={content} className="relative z-10 flex w-full flex-col items-center px-4 text-center will-change-transform">
                <p
                    className="font-mono text-[11px] uppercase tracking-[.3em] text-purple"
                    style={{ animation: "fade-up .8s .1s both" }}
                >
                    Mission 01 — Portfolio de Steve Biko Wafo Kamga
                </p>

                <h1 className="mt-6 select-none font-bold uppercase leading-[.86] tracking-tighter text-white" style={{ fontSize: "clamp(64px, 15vw, 210px)" }}>
                    {NAME.map((word, w) => (
                        <span key={word} className="block overflow-hidden pb-[.06em]">
                            {word.split("").map((ch, i) => (
                                <span
                                    key={i}
                                    className="inline-block"
                                    style={{ animation: `letter-rise 1s cubic-bezier(.2,.8,.2,1) ${0.15 + w * 0.35 + i * 0.07}s both` }}
                                >
                                    {ch}
                                </span>
                            ))}
                        </span>
                    ))}
                </h1>

                <div
                    className="mt-8 flex h-9 items-center gap-3 overflow-hidden font-mono text-sm uppercase tracking-[.18em] text-white-100 md:text-lg"
                    style={{ animation: "fade-up .8s .9s both" }}
                >
                    <span className="text-white-200/60">&gt;</span>
                    <span key={role} className="inline-block text-purple" style={{ animation: "role-swap 2.6s ease both" }}>
                        {ROLES[role]}
                    </span>
                </div>

                <p
                    className="mt-6 max-w-xl text-balance text-sm text-white-200 md:text-base"
                    style={{ animation: "fade-up .8s 1.1s both" }}
                >
                    Je transforme des données brutes et des idées floues en produits qui tournent : analyses, automatisations, applications web et IA.
                    Basé à Champigny-sur-Marne, je travaille avec des clients partout.
                </p>

                <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row" style={{ animation: "fade-up .8s 1.3s both" }}>
                    <a href="#about">
                        <MagicButton title="Lancer la mission" icon={<FaLocationArrow />} position="right" />
                    </a>
                    <a href="#projects" className="font-mono text-xs uppercase tracking-[.2em] text-white-200 underline-offset-8 hover:text-purple hover:underline">
                        Voir les projets
                    </a>
                </div>
            </div>

            <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2" style={{ animation: "fade-up .8s 1.8s both" }}>
                <span className="font-mono text-[10px] uppercase tracking-[.3em] text-white-200/60">Scroll pour avancer</span>
                <span className="relative block h-10 w-px overflow-hidden bg-white/15">
                    <span className="absolute inset-0 bg-purple" style={{ animation: "cue-drop 1.8s ease-in-out infinite" }} />
                </span>
            </div>
        </div>
    );
};

export default Hero;
