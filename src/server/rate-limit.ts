import "server-only";
import { prisma } from "./db";

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: Date };

/**
 * Limitador de ventana fija guardado en MySQL (sin Redis).
 * Es atómico gracias a INSERT … ON DUPLICATE KEY UPDATE.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  const k = key.slice(0, 191);

  await prisma.$executeRaw`
    INSERT INTO RateLimit (\`key\`, \`count\`, \`resetAt\`) VALUES (${k}, 1, ${resetAt})
    ON DUPLICATE KEY UPDATE
      \`count\`   = IF(\`resetAt\` <= ${now}, 1, \`count\` + 1),
      \`resetAt\` = IF(\`resetAt\` <= ${now}, ${resetAt}, \`resetAt\`)`;

  const row = await prisma.rateLimit.findUnique({ where: { key: k } });
  const count = row?.count ?? 1;
  return { ok: count <= limit, remaining: Math.max(0, limit - count), resetAt: row?.resetAt ?? resetAt };
}

/** Borra entradas vencidas (se llama desde el cron). */
export async function purgeRateLimits(): Promise<number> {
  const res = await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return res.count;
}
