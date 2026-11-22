"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { ShelfProject } from "@/components/ui/project-shelf";

const blank = (id: number): ShelfProject => ({
    id,
    title: "",
    des: "",
    long: "",
    year: new Date().getFullYear(),
    kind: "",
    stack: [],
    img: "",
    photos: [],
    iconLists: [],
    link: "",
    hue: 268,
});

/** Downscale in the browser so uploads stay well under the 4 Mo limit. */
async function shrink(file: File, max = 1600): Promise<Blob> {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * k);
    cv.height = Math.round(bmp.height * k);
    cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("compression"))), "image/jpeg", 0.86));
}

const field =
    "w-full rounded border border-white/15 bg-black-200 px-3 py-2 text-sm text-white outline-none focus:border-purple";
const label = "mb-1 block font-mono text-[10px] uppercase tracking-[.12em] text-white-200/60";

export default function AdminPage() {
    const [key, setKey] = useState("");
    const [authed, setAuthed] = useState(false);
    const [items, setItems] = useState<ShelfProject[]>([]);
    const [sel, setSel] = useState(0);
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);
    const [storage, setStorage] = useState(true);

    const load = useCallback(async (k: string) => {
        const res = await fetch("/api/admin/projects", { headers: { "x-admin-key": k } });
        if (!res.ok) {
            setAuthed(false);
            setMsg(res.status === 401 ? "Mot de passe incorrect." : "Erreur de chargement.");
            return;
        }
        const data = await res.json();
        setItems(data.projects);
        setStorage(data.storage);
        setAuthed(true);
        setMsg("");
        try { sessionStorage.setItem("admin-key", k); } catch {}
    }, []);

    useEffect(() => {
        try {
            const k = sessionStorage.getItem("admin-key");
            if (k) { setKey(k); load(k); }
        } catch {}
    }, [load]);

    const cur = items[sel];
    const patch = (p: Partial<ShelfProject>) =>
        setItems((all) => all.map((x, i) => (i === sel ? { ...x, ...p } : x)));

    const upload = async (files: FileList | null, as: "cover" | "gallery") => {
        if (!files?.length) return;
        setBusy(true);
        setMsg("Envoi des photos…");
        try {
            const urls: string[] = [];
            for (const f of Array.from(files)) {
                const body = new FormData();
                body.append("file", await shrink(f), "photo.jpg");
                const res = await fetch("/api/admin/upload", { method: "POST", headers: { "x-admin-key": key }, body });
                const j = await res.json();
                if (!res.ok) throw new Error(j.error || "envoi refusé");
                urls.push(j.url);
            }
            if (as === "cover") patch({ img: urls[0] });
            else patch({ photos: [...(cur.photos ?? []), ...urls].slice(0, 6) });
            setMsg("Photos ajoutées. Pense à enregistrer.");
        } catch (e) {
            setMsg(`Échec : ${(e as Error).message}`);
        }
        setBusy(false);
    };

    const save = async () => {
        setBusy(true);
        setMsg("Enregistrement…");
        const res = await fetch("/api/admin/projects", {
            method: "PUT",
            headers: { "x-admin-key": key, "content-type": "application/json" },
            body: JSON.stringify({ projects: items }),
        });
        const j = await res.json().catch(() => ({}));
        setMsg(res.ok ? "Enregistré. Le site se met à jour sous 30 s." : `Échec : ${j.error ?? res.status}`);
        setBusy(false);
    };

    if (!authed) {
        return (
            <main className="grid min-h-screen place-items-center bg-black-100 px-5 text-white">
                <form
                    className="w-full max-w-sm space-y-4"
                    onSubmit={(e) => { e.preventDefault(); load(key); }}
                >
                    <h1 className="text-2xl font-bold">Admin portfolio</h1>
                    <input
                        type="password"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="Mot de passe"
                        className={field}
                        autoFocus
                    />
                    <button className="w-full rounded border border-purple px-4 py-2 text-purple hover:bg-purple hover:text-black-100">
                        Entrer
                    </button>
                    {msg && <p className="text-sm text-red-400">{msg}</p>}
                </form>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black-100 px-4 py-8 text-white">
            <div className="mx-auto max-w-3xl space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Projets</h1>
                    <a href="/#projects" className="text-sm text-purple underline">Voir le site</a>
                </div>

                {!storage && (
                    <p className="rounded border border-yellow-500/40 p-3 text-sm text-yellow-300">
                        Vercel Blob n&apos;est pas relié : tu peux éditer mais pas enregistrer. Ajoute le stockage Blob au projet Vercel.
                    </p>
                )}

                <div className="flex flex-wrap gap-2">
                    {items.map((p, i) => (
                        <button
                            key={p.id + "-" + i}
                            onClick={() => setSel(i)}
                            className={`rounded border px-3 py-1.5 text-xs ${i === sel ? "border-purple text-purple" : "border-white/15 text-white-200"}`}
                        >
                            {p.title || "Sans titre"}
                        </button>
                    ))}
                    <button
                        onClick={() => {
                            setItems([...items, blank(Math.max(0, ...items.map((x) => x.id)) + 1)]);
                            setSel(items.length);
                        }}
                        className="rounded border border-dashed border-white/30 px-3 py-1.5 text-xs"
                    >
                        + Nouveau
                    </button>
                </div>

                {cur && (
                    <div className="space-y-4 rounded-lg border border-white/10 p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div><label className={label}>Titre</label>
                                <input className={field} value={cur.title} onChange={(e) => patch({ title: e.target.value })} /></div>
                            <div><label className={label}>Type</label>
                                <input className={field} value={cur.kind} onChange={(e) => patch({ kind: e.target.value })} placeholder="Machine learning" /></div>
                            <div><label className={label}>Année</label>
                                <input className={field} type="number" value={cur.year} onChange={(e) => patch({ year: Number(e.target.value) })} /></div>
                            <div><label className={label}>Lien (optionnel)</label>
                                <input className={field} value={cur.link} onChange={(e) => patch({ link: e.target.value })} placeholder="https://…" /></div>
                        </div>
                        <div><label className={label}>Résumé (une phrase)</label>
                            <input className={field} value={cur.des} onChange={(e) => patch({ des: e.target.value })} /></div>
                        <div><label className={label}>Description complète</label>
                            <textarea className={field} rows={5} value={cur.long} onChange={(e) => patch({ long: e.target.value })} /></div>
                        <div><label className={label}>Technologies (séparées par des virgules)</label>
                            <input
                                className={field}
                                value={cur.stack.join(", ")}
                                onChange={(e) => patch({ stack: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                                placeholder="Python, SQL, Next.js"
                            /></div>
                        <div><label className={label}>Teinte de la couverture : {cur.hue}°</label>
                            <input type="range" min={0} max={360} value={cur.hue} onChange={(e) => patch({ hue: Number(e.target.value) })} className="w-full" /></div>

                        <div>
                            <label className={label}>Photo de couverture</label>
                            <div className="flex items-center gap-3">
                                {cur.img && <img src={cur.img} alt="" className="h-16 w-24 rounded object-cover" />}
                                <input type="file" accept="image/*" disabled={busy} onChange={(e) => upload(e.target.files, "cover")} className="text-xs" />
                                {cur.img && <button onClick={() => patch({ img: "" })} className="text-xs text-red-400">Retirer</button>}
                            </div>
                        </div>
                        <div>
                            <label className={label}>Galerie (jusqu&apos;à 6 photos)</label>
                            <div className="flex flex-wrap items-center gap-2">
                                {(cur.photos ?? []).map((src) => (
                                    <div key={src} className="relative">
                                        <img src={src} alt="" className="h-16 w-24 rounded object-cover" />
                                        <button
                                            onClick={() => patch({ photos: (cur.photos ?? []).filter((x) => x !== src) })}
                                            className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs"
                                        >×</button>
                                    </div>
                                ))}
                                <input type="file" accept="image/*" multiple disabled={busy} onChange={(e) => upload(e.target.files, "gallery")} className="text-xs" />
                            </div>
                        </div>

                        <button
                            onClick={() => { setItems(items.filter((_, i) => i !== sel)); setSel(0); }}
                            className="text-xs text-red-400"
                        >
                            Supprimer ce projet
                        </button>
                    </div>
                )}

                <div className="sticky bottom-4 flex items-center gap-3 rounded-lg border border-white/10 bg-black-200 p-3">
                    <button
                        onClick={save}
                        disabled={busy || !storage}
                        className="rounded border border-purple px-5 py-2 text-sm text-purple hover:bg-purple hover:text-black-100 disabled:opacity-40"
                    >
                        Enregistrer
                    </button>
                    <span className="text-xs text-white-200">{msg}</span>
                </div>
            </div>
        </main>
    );
}
