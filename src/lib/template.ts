const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

export const TEMPLATE_VARIABLES = [
  "cliente",
  "servicio",
  "fecha",
  "hora",
  "profesional",
  "enlace_gestion",
  "negocio",
  "direccion",
  "telefono_negocio",
  "precio",
  "estado",
  "notas",
  "enlace",
] as const;

export type TemplateVars = Partial<Record<(typeof TEMPLATE_VARIABLES)[number], string>>;

/**
 * Sustituye {variable} por su valor. En modo html los valores se escapan
 * para que el contenido del cliente (nombre, notas) no inyecte HTML.
 * Las variables desconocidas se dejan tal cual.
 */
export function renderTemplate(tpl: string, vars: TemplateVars, opts: { html: boolean }): string {
  return tpl.replace(/\{([a-z_]+)\}/g, (match, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    if (v === undefined) return match;
    return opts.html ? escapeHtml(v) : v;
  });
}

/** Versión de texto plano aproximada de un HTML sencillo. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
