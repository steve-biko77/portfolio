import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import { blobEnabled, getProjects, saveProjects } from "@/lib/projects";
import { iconsFromStack } from "@/lib/icons";
import type { ShelfProject } from "@/components/ui/project-shelf";

export const dynamic = "force-dynamic";

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const safeUrl = (v: unknown) => {
    const s = str(v, 500);
    return /^(https?:\/\/|\/)/.test(s) ? s : "";
};

function clean(raw: unknown, index: number): ShelfProject | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const title = str(r.title, 120).trim();
    if (!title) return null;
    const stack = Array.isArray(r.stack) ? r.stack.map((s) => str(s, 40).trim()).filter(Boolean).slice(0, 12) : [];
    const photos = Array.isArray(r.photos) ? r.photos.map(safeUrl).filter(Boolean).slice(0, 6) : [];
    return {
        id: Number(r.id) || index + 1,
        title,
        des: str(r.des, 400),
        long: str(r.long, 2000),
        year: Number(r.year) || new Date().getFullYear(),
        kind: str(r.kind, 80),
        stack,
        img: safeUrl(r.img),
        photos,
        iconLists: iconsFromStack(stack),
        link: safeUrl(r.link),
        hue: Math.max(0, Math.min(360, Number(r.hue) || 268)),
    };
}

export async function GET(req: Request) {
    if (!isAdmin(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
    return Response.json({ projects: await getProjects(), storage: blobEnabled() });
}

export async function PUT(req: Request) {
    if (!isAdmin(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!blobEnabled()) return Response.json({ error: "Vercel Blob non configuré" }, { status: 503 });
    const body = (await req.json().catch(() => null)) as { projects?: unknown[] } | null;
    if (!body || !Array.isArray(body.projects)) return Response.json({ error: "bad request" }, { status: 400 });
    const items = body.projects.map(clean).filter((p): p is ShelfProject => p !== null);
    if (!items.length) return Response.json({ error: "aucun projet valide" }, { status: 400 });
    await saveProjects(items);
    revalidatePath("/");
    return Response.json({ ok: true, count: items.length });
}
