import { timingSafeEqual } from "node:crypto";

export function isAdmin(req: Request): boolean {
    const expected = process.env.ADMIN_PASSWORD;
    const given = req.headers.get("x-admin-key") ?? "";
    if (!expected || !given) return false;
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}
