const MAP: Record<string, string> = {
    python: "/python.svg",
    "next.js": "/next.svg",
    next: "/next.svg",
    typescript: "/ts.svg",
    ts: "/ts.svg",
    react: "/re.svg",
    "react.js": "/re.svg",
    sql: "/sql.svg",
    git: "/git.svg",
    github: "/github.svg",
    "ci/cd": "/git.svg",
    pandas: "/panda.svg",
    "scikit-learn": "/scikit.svg",
    svm: "/scikit.svg",
    "machine learning": "/scikit.svg",
    c: "/c.svg",
    "c++": "/c.svg",
    aws: "/cloud.svg",
    cloud: "/cloud.svg",
    "hébergement": "/host.svg",
    docker: "/dock.svg",
    tailwind: "/tail.svg",
    "three.js": "/three.svg",
    solidity: "/solidity.svg",
    kivy: "/kivy.svg",
    gsap: "/gsap.svg",
};

/** Derive the small tech bubbles from a free-form stack list. */
export function iconsFromStack(stack: string[]): string[] {
    const out: string[] = [];
    for (const s of stack) {
        const icon = MAP[s.trim().toLowerCase()];
        if (icon && !out.includes(icon)) out.push(icon);
    }
    if (!out.includes("/git.svg")) out.push("/git.svg");
    return out.slice(0, 6);
}
