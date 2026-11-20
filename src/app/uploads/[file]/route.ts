import { readFile } from "node:fs/promises";
import path from "node:path";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

/** Sirve los archivos subidos (logos) desde UPLOAD_DIR. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[a-z0-9-]+\.(png|jpg|webp)$/.test(file)) return new Response("No encontrado", { status: 404 });
  const ext = file.split(".").pop()!;
  try {
    const data = await readFile(path.join(path.resolve(process.env.UPLOAD_DIR || "./uploads"), file));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[ext]!, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
