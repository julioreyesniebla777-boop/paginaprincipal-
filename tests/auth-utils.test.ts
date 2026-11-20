import { describe, expect, it } from "vitest";
import { generateToken, hashToken, safeEqual } from "@/lib/tokens";
import { normalizePhone, safeRedirectPath } from "@/lib/utils";
import { renderTemplate, htmlToText } from "@/lib/template";
import { registerSchema, resetPasswordSchema } from "@/lib/validation/auth";

describe("tokens", () => {
  it("genera tokens únicos y largos", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });
  it("el hash es determinista y distinto del token", () => {
    const t = generateToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
    expect(safeEqual(hashToken(t), hashToken(t))).toBe(true);
    expect(safeEqual("a", "ab")).toBe(false);
  });
});

describe("utils", () => {
  it("normaliza teléfonos", () => {
    expect(normalizePhone("+1 (407) 555-0100")).toBe("14075550100");
    expect(normalizePhone("")).toBeNull();
  });
  it("bloquea redirecciones abiertas", () => {
    expect(safeRedirectPath("/panel")).toBe("/panel");
    expect(safeRedirectPath("//evil.com")).toBe("/cuenta");
    expect(safeRedirectPath("https://evil.com")).toBe("/cuenta");
    expect(safeRedirectPath("/\\evil.com")).toBe("/cuenta");
  });
});

describe("plantillas", () => {
  it("sustituye variables y escapa HTML", () => {
    const out = renderTemplate("Hola {cliente}, {desconocida}", { cliente: "<b>Ana</b>" }, { html: true });
    expect(out).toBe("Hola &lt;b&gt;Ana&lt;/b&gt;, {desconocida}");
  });
  it("no escapa en el asunto (texto plano)", () => {
    expect(renderTemplate("Cita de {servicio}", { servicio: "Corte & barba" }, { html: false })).toBe("Cita de Corte & barba");
  });
  it("convierte HTML a texto", () => {
    expect(htmlToText('<p>Hola</p><a href="https://x.com">enlace</a>')).toBe("Hola\nenlace (https://x.com)");
  });
});

describe("validación de auth", () => {
  it("exige contraseñas iguales y seguras", () => {
    const base = { name: "Ana Pérez", email: "ANA@Mail.com ", password: "abc12345", confirmPassword: "abc12345" };
    const ok = registerSchema.safeParse(base);
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.email).toBe("ana@mail.com");
    expect(registerSchema.safeParse({ ...base, confirmPassword: "x" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "abcdefgh", confirmPassword: "abcdefgh" }).success).toBe(false);
  });
  it("valida el token de restablecimiento", () => {
    expect(resetPasswordSchema.safeParse({ token: "corto", password: "abc12345", confirmPassword: "abc12345" }).success).toBe(false);
  });
});
