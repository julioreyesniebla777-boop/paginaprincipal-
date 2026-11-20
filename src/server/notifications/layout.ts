import { escapeHtml } from "@/lib/template";

/** Envoltura HTML común para todos los correos. */
export function emailLayout(opts: { businessName: string; color: string; logoUrl?: string | null; body: string }) {
  const logo = opts.logoUrl
    ? `<img src="${escapeHtml(opts.logoUrl)}" alt="${escapeHtml(opts.businessName)}" style="max-height:48px;margin-bottom:8px">`
    : "";
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
<div style="background:${escapeHtml(opts.color)};padding:16px 24px;color:#fff">${logo}<div style="font-size:18px;font-weight:bold">${escapeHtml(opts.businessName)}</div></div>
<div style="padding:24px;font-size:15px;line-height:1.5">${opts.body}</div>
</div>
<p style="font-size:12px;color:#71717a;text-align:center;margin-top:16px">${escapeHtml(opts.businessName)}</p>
</div></body></html>`;
}
