/**
 * Sanitizador sencillo (lista blanca) para el HTML de las plantillas de correo
 * editadas por el administrador: elimina scripts, iframes, manejadores on*,
 * y URLs javascript:. Los correos no ejecutan JS, pero la vista previa del
 * panel sí se muestra en el navegador.
 */
const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "h1", "h2", "h3", "h4", "table", "thead", "tbody", "tr", "td", "th", "div", "span", "img", "hr", "blockquote", "small"]);
const ALLOWED_ATTRS = new Set(["href", "src", "alt", "style", "cellpadding", "cellspacing", "width", "height", "align", "border", "title", "target"]);

export function sanitizeEmailHtml(html: string): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<(script|style|iframe|object|embed|form|input|textarea|select|button|svg|math)[\s\S]*?<\/\1\s*>/gi, "");
  out = out.replace(/<(script|style|iframe|object|embed|form|input|textarea|select|button|svg|math|meta|link|base)\b[^>]*\/?>/gi, "");
  out = out.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return "";
    if (full.startsWith("</")) return `</${t}>`;
    const kept: string[] = [];
    const re = /([a-zA-Z-:]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(attrs))) {
      const name = m[1]!.toLowerCase();
      const value = (m[3] ?? m[4] ?? m[5] ?? "").replace(/"/g, "&quot;");
      if (!ALLOWED_ATTRS.has(name)) continue;
      if ((name === "href" || name === "src") && !/^(https?:|mailto:|tel:|\{[a-z_]+\}|\/)/i.test(value.trim())) continue;
      if (name === "style" && /expression|javascript:|url\(/i.test(value)) continue;
      kept.push(`${name}="${value}"`);
    }
    return `<${t}${kept.length ? " " + kept.join(" ") : ""}>`;
  });
  return out;
}
