import { put } from "@vercel/blob";
import { isAdmin } from "@/lib/admin-auth";
import { blobEnabled } from "@/lib/projects";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
    if (!isAdmin(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!blobEnabled()) return Response.json({ error: "Vercel Blob non configuré" }, { status: 503 });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return Response.json({ error: "fichier manquant" }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return Response.json({ error: "JPG, PNG ou WebP uniquement" }, { status: 415 });
    if (file.size > 4 * 1024 * 1024) return Response.json({ error: "4 Mo maximum" }, { status: 413 });
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const blob = await put(`portfolio/img/${Date.now()}.${ext}`, file, {
        access: "public",
        addRandomSuffix: true,
        contentType: file.type,
    });
    return Response.json({ url: blob.url });
}
