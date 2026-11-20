import { describe, expect, it } from "vitest";
import { sanitizeEmailHtml } from "@/lib/sanitize";

describe("sanitizeEmailHtml", () => {
  it("elimina scripts y manejadores", () => {
    const out = sanitizeEmailHtml('<p onclick="x()">Hola<script>alert(1)</script></p><img src="x" onerror="alert(1)">');
    expect(out).toBe("<p>Hola</p><img>");
  });
  it("mantiene enlaces con variables y quita javascript:", () => {
    expect(sanitizeEmailHtml('<a href="{enlace_gestion}">ok</a>')).toBe('<a href="{enlace_gestion}">ok</a>');
    expect(sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
  });
  it("conserva tablas y estilos simples", () => {
    expect(sanitizeEmailHtml('<table cellpadding="4"><tr><td style="color:red">a</td></tr></table>')).toBe('<table cellpadding="4"><tr><td style="color:red">a</td></tr></table>');
  });
  it("elimina iframes", () => {
    expect(sanitizeEmailHtml('<iframe src="https://x"></iframe><b>b</b>')).toBe("<b>b</b>");
  });
});
