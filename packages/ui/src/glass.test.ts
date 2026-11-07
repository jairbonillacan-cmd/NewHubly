import { readFileSync } from "node:fs";
import postcss, { type Rule } from "postcss";
import { describe, expect, it } from "vitest";
import { esFondoDeImagen } from "./espacio/fondos";

const css = postcss.parse(readFileSync(new URL("./tokens.css", import.meta.url), "utf8"));
const inReducedTransparency = (rule: Rule) => rule.parent?.type === "atrule" && /prefers-reduced-transparency:\s*reduce/.test((rule.parent as { params?: string }).params ?? "");
const selectorsOf = (rule: Rule) => rule.selectors.map((selector) => selector.trim());

describe("Cristal con reducción de transparencia (issue 224)", () => {
  it("el respaldo opaco va después de toda regla que aplica desenfoque al mismo selector", () => {
    const rules: Rule[] = [];
    css.walkRules((rule) => { rules.push(rule); });
    const blurred = new Map<string, number>();
    const fallback = new Map<string, number>();
    rules.forEach((rule, index) => {
      const target = inReducedTransparency(rule) ? fallback : rule.some((node) => node.type === "decl" && node.prop === "backdrop-filter" && node.value !== "none") ? blurred : null;
      for (const selector of selectorsOf(rule)) target?.set(selector, index);
    });
    expect([...blurred.keys()]).toEqual(expect.arrayContaining([".glass-panel", ".hubly-glass", ".hubly-pop-surface", ".hubly-carril-asa"]));
    for (const [selector, lastBlur] of blurred) {
      if (!selector.startsWith(".glass-panel") && !selector.startsWith(".hubly-glass") && !selector.startsWith(".hubly-pop-surface") && !selector.startsWith(".hubly-carril-asa")) continue;
      expect(fallback.get(selector), `${selector} sin respaldo de reducción de transparencia`).toBeDefined();
      expect(fallback.get(selector)!, `${selector}: el respaldo queda antes de un desenfoque posterior`).toBeGreaterThan(lastBlur);
    }
  });

  // Peor caso: una imagen totalmente blanca o negra bajo el velo, el panel a su opacidad mínima y, encima, el brillo superior.
  it("sobre cualquier imagen, el texto tenue llega a 4,5:1 y el borde de control a 3:1 en claro y en oscuro", () => {
    const vars = (selector: string) => {
      const found = new Map<string, string>();
      css.walkRules((rule) => {
        if (rule.selector.trim() === selector && rule.parent?.type === "root") rule.walkDecls((decl) => { found.set(decl.prop, decl.value); });
      });
      return found;
    };
    const light = vars(":root"), dark = new Map([...light, ...vars(':root[data-theme="dark"]')]);
    const hex = (value: string) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
    const rgba = (value: string) => { const n = /rgba\(([^)]+)\)/.exec(value)![1]!.split(",").map(Number); return { rgb: n.slice(0, 3), alpha: n[3]! }; };
    const channel = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
    const ratio = (a: number[], b: number[]) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
    const over = (top: number[], alpha: number, bottom: number[]) => top.map((t, i) => t * alpha + bottom[i]! * (1 - alpha));

    for (const [name, theme] of [["claro", light], ["oscuro", dark]] as const) {
      const glass = theme.get("--glass-rgb")!.split(/\s+/).map(Number);
      const floor = Number(theme.get("--panel-alpha-min-image"));
      const veil = rgba(theme.get("--wallpaper-image-veil")!);
      const sheen = rgba(theme.get("--glass-sheen")!.split("0%")[0]!);
      for (const image of [[0, 0, 0], [255, 255, 255]]) {
        for (const shine of [0, sheen.alpha]) {
          const surface = over(sheen.rgb, shine, over(glass, floor, over(veil.rgb, veil.alpha, image)));
          expect(ratio(hex(theme.get("--text-muted")!), surface), `${name}: texto tenue`).toBeGreaterThanOrEqual(4.5);
          expect(ratio(hex(theme.get("--border-control")!), surface), `${name}: borde de control`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it("los paneles respetan la opacidad mínima solo cuando hay una imagen detrás", () => {
    let glassBackground = "";
    css.walkRules(".hubly-glass", (rule) => { rule.walkDecls("background-color", (decl) => { glassBackground = decl.value; }); });
    expect(glassBackground).toContain("max(var(--panel-alpha), var(--panel-alpha-min, 0))");
    expect(["imagen", "bosque-de-niebla", "tokio-nocturno"].every(esFondoDeImagen)).toBe(true);
    expect(["contornos", "aurora", "arena"].some(esFondoDeImagen)).toBe(false);
  });
});
