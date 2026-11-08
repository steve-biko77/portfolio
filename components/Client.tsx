import React from 'react';
import TestimonialWall from "@/components/ui/testimonial-wall";
import {testimonials} from "@/data";

const Client = () => {
    const live = testimonials.filter((t) => !t.pending).length;

    return (
        <section className="py-20" id="testimonials">
            <h1 className="heading scroll-m-20 text-4xl font-bold tracking-tight lg:text-5xl">
                Kind words from
                <span className="text-purple"> satisfied clients</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-white-200/70">
                Faites tourner le mur, survolez une carte pour l&apos;arrêter et la lire.
            </p>

            <div className="mt-12">
                <TestimonialWall items={testimonials}/>
            </div>

            <p className="mt-6 text-center text-[11px] uppercase tracking-[.12em] text-white-200/45">
                {live} recommandation{live > 1 ? "s" : ""} publiée{live > 1 ? "s" : ""} · les autres emplacements attendent le retour des clients concernés
            </p>
        </section>
    );
};

export default Client;
