import { list, put } from "@vercel/blob";
import { projects as seed } from "@/data";
import type { ShelfProject } from "@/components/ui/project-shelf";

const KEY = "portfolio/projects.json";

export const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** Live projects from Vercel Blob, falling back to the ones bundled in data/index.ts. */
export async function getProjects(): Promise<ShelfProject[]> {
    const fallback = seed as ShelfProject[];
    if (!blobEnabled()) return fallback;
    try {
        const { blobs } = await list({ prefix: KEY, limit: 5 });
        const file = blobs.find((b) => b.pathname === KEY);
        if (!file) return fallback;
        const res = await fetch(`${file.url}?v=${new Date(file.uploadedAt).getTime()}`, {
            next: { revalidate: 30 },
        });
        if (!res.ok) return fallback;
        const data = (await res.json()) as ShelfProject[];
        return Array.isArray(data) && data.length ? data : fallback;
    } catch {
        return fallback;
    }
}

export async function saveProjects(items: ShelfProject[]) {
    await put(KEY, JSON.stringify(items), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 0,
    });
}
