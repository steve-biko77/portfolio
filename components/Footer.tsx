import React from 'react';
import MagicButton from "@/components/ui/MagicButton";
import {FaLocationArrow} from "react-icons/fa";
import {socialMedia} from "@/data";

const Footer = () => {
    return (
        <footer className="w-full pt-20 pb-10" id="contact">
            {/* background grid */}
            <div className="w-full absolute left-0 -bottom-72 min-h-96">
                <img
                    src="/footer-grid.svg"
                    alt="grid"
                    className="w-full h-full opacity-50 "
                />
            </div>

            <div className="flex flex-col items-center">
                <h1 className="heading scroll-m-20 text-4xl font-bold tracking-tight lg:text-5xl">
                    Ready to take <span className="text-purple">your</span> digital
                    presence to the next level?
                </h1>
                <p className="text-white-200 md:mt-10 my-5 text-center">
                    Reach out to me today and let&apos;s discuss how I can help you
                    achieve your goals.
                </p>
                <a href="mailto:wkstevebiko1@gmail.com">
                    <MagicButton
                        title="Let's get in touch"
                        icon={<FaLocationArrow />}
                        position="right"
                    />
                </a>
            </div>
            {/* the closing statement */}
            <div className="relative z-10 mt-28">
                <h2 className="text-[clamp(32px,6.4vw,84px)] font-bold uppercase leading-[.94] tracking-tight text-white">
                    Un jeu de données<br />qui dort quelque part&nbsp;?
                </h2>

                <div className="mt-9 flex flex-wrap gap-2.5">
                    <a
                        href="mailto:wkstevebiko1@gmail.com"
                        className="inline-flex h-11 items-center rounded border border-purple px-5 font-mono text-[11px] uppercase tracking-[.1em] text-purple transition-colors hover:bg-purple hover:text-black-100"
                    >
                        wkstevebiko1@gmail.com
                    </a>
                    <a
                        href="https://www.malt.fr/profile/stevebikowafokamga"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center rounded border border-white/15 px-5 font-mono text-[11px] uppercase tracking-[.1em] text-white transition-colors hover:border-purple hover:text-purple"
                    >
                        Malt
                    </a>
                    <a
                        href="https://github.com/steve-biko77"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center rounded border border-white/15 px-5 font-mono text-[11px] uppercase tracking-[.1em] text-white transition-colors hover:border-purple hover:text-purple"
                    >
                        GitHub
                    </a>
                    <a
                        href="https://www.credly.com/earner/earned/badge/f9b8504d-47ea-49aa-8141-d63dc10bdf43"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center rounded border border-white/15 px-5 font-mono text-[11px] uppercase tracking-[.1em] text-white transition-colors hover:border-purple hover:text-purple"
                    >
                        Certification IBM
                    </a>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
                    <p className="font-mono text-[11px] uppercase tracking-[.1em] text-white-200/60">
                        © 2026 Steve Biko Wafo Kamga
                    </p>

                    <div className="flex items-center gap-5">
                        <p className="font-mono text-[11px] uppercase tracking-[.1em] text-white-200/60">
                            Champigny-sur-Marne
                        </p>
                        <div className="flex items-center gap-3">
                            {socialMedia.map((info) => {
                                const face = <img src={info.img} alt="" width={20} height={20} />;
                                const box =
                                    "flex h-10 w-10 items-center justify-center rounded-lg border border-black-300 bg-black-200 bg-opacity-75 backdrop-blur-lg backdrop-filter transition-colors";
                                return info.link ? (
                                    <a
                                        key={info.id}
                                        href={info.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`${box} cursor-pointer hover:border-purple`}
                                    >
                                        {face}
                                    </a>
                                ) : (
                                    <div key={info.id} className={box}>
                                        {face}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;