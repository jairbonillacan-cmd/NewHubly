// Verifica contraste WCAG 2.2 AA de las 6 plantillas de la página social (#262). Uso: node docs/diseno/evidencia/pagina-social-contraste.mjs
const P = {
  "editorial-claro": {
    fondo: ["#F4EFE6"], texto: "#1F1B17", texto2: "#5A5047",
    enlaceBg: "#FBF8F2", enlaceBgHover: "#EFE7DA", enlaceTexto: "#1F1B17", enlaceTexto2: "#5A5047", enlaceBorde: "#8C8074",
    cristalBg: "rgba(255,255,255,0.55)", cristalBorde: "rgba(31,27,23,0.52)",
    acento: "#A3452A", sobreAcento: "#FFFFFF", acentoSuave: "#F1DED3", acentoSuaveTexto: "#7A3018", foco: "#A3452A",
  },
  "nocturno-grafito": {
    fondo: ["#121314"], texto: "#F2EDE4", texto2: "#BDB5A8",
    enlaceBg: "#1D1F21", enlaceBgHover: "#272A2D", enlaceTexto: "#F2EDE4", enlaceTexto2: "#BDB5A8", enlaceBorde: "#6B675F",
    cristalBg: "rgba(242,237,228,0.06)", cristalBorde: "rgba(242,237,228,0.40)",
    acento: "#4FC79A", sobreAcento: "#0B1511", acentoSuave: "#16302A", acentoSuaveTexto: "#8FE0BF", foco: "#E8B04B",
  },
  "cristal-bruma": {
    fondo: ["#D9E3F0", "#EDF0F6", "#E3E1EE"], texto: "#121722", texto2: "#3C4557",
    enlaceBg: "rgba(255,255,255,0.62)", enlaceBgHover: "rgba(255,255,255,0.82)", enlaceTexto: "#121722", enlaceTexto2: "#3C4557", enlaceBorde: "rgba(18,23,34,0.50)",
    cristalBg: "rgba(255,255,255,0.62)", cristalBorde: "rgba(18,23,34,0.50)",
    acento: "#2F4A8A", sobreAcento: "#FFFFFF", acentoSuave: "rgba(47,74,138,0.12)", acentoSuaveTexto: "#22386E", foco: "#2F4A8A",
  },
  "cristal-abismo": {
    fondo: ["#0B1222", "#141B33", "#0E1A24"], texto: "#EEF2FA", texto2: "#B4BED3",
    enlaceBg: "rgba(255,255,255,0.07)", enlaceBgHover: "rgba(255,255,255,0.13)", enlaceTexto: "#EEF2FA", enlaceTexto2: "#B4BED3", enlaceBorde: "rgba(176,204,255,0.50)",
    cristalBg: "rgba(255,255,255,0.07)", cristalBorde: "rgba(176,204,255,0.50)",
    acento: "#8FB4FF", sobreAcento: "#0B1222", acentoSuave: "rgba(143,180,255,0.16)", acentoSuaveTexto: "#C4D6FF", foco: "#A9C7FF",
  },
  "monocromo-tinta": {
    fondo: ["#FFFFFF"], texto: "#000000", texto2: "#3A3A3A",
    enlaceBg: "#FFFFFF", enlaceBgHover: "#F0F0F0", enlaceTexto: "#000000", enlaceTexto2: "#3A3A3A", enlaceBorde: "#000000",
    cristalBg: "rgba(0,0,0,0.04)", cristalBorde: "rgba(0,0,0,0.62)",
    acento: "#000000", sobreAcento: "#FFFFFF", acentoSuave: "#EDEDED", acentoSuaveTexto: "#000000", foco: "#000000",
  },
  "salvia-natural": {
    fondo: ["#E8E6DF"], texto: "#1C241E", texto2: "#4A544C",
    enlaceBg: "#F4F3EE", enlaceBgHover: "#E2E5DC", enlaceTexto: "#1C241E", enlaceTexto2: "#4A544C", enlaceBorde: "#7A8179",
    cristalBg: "rgba(255,255,255,0.45)", cristalBorde: "rgba(28,36,30,0.52)",
    acento: "#4B6852", sobreAcento: "#FFFFFF", acentoSuave: "#D5DDD3", acentoSuaveTexto: "#33493A", foco: "#3A5341",
  },
};

const parse = (c) => {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) { const [r, g, b, a = 1] = m[1].split(",").map(Number); return { r, g, b, a }; }
  const h = c.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
};
const over = (top, base) => { const t = parse(top), b = parse(base); return { r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 }; };
const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const solid = (c, base) => (parse(c).a < 1 ? over(c, base) : parse(c));

let fallos = 0;
const filas = [];
for (const [id, t] of Object.entries(P)) {
  let peor = {};
  for (const f of t.fondo) {
    const F = parse(f);
    const eBg = solid(t.enlaceBg, f), eBgH = solid(t.enlaceBgHover, f), cBg = solid(t.cristalBg, f), aS = solid(t.acentoSuave, f);
    const checks = {
      "texto/fondo": [ratio(parse(t.texto), F), 4.5],
      "texto2/fondo": [ratio(parse(t.texto2), F), 4.5],
      "enlace/enlaceBg": [ratio(parse(t.enlaceTexto), eBg), 4.5],
      "enlace2/enlaceBg": [ratio(parse(t.enlaceTexto2), eBg), 4.5],
      "enlace/hover": [ratio(parse(t.enlaceTexto), eBgH), 4.5],
      "enlace2/hover": [ratio(parse(t.enlaceTexto2), eBgH), 4.5],
      "enlace/cristal": [ratio(parse(t.enlaceTexto), cBg), 4.5],
      "enlace2/cristal": [ratio(parse(t.enlaceTexto2), cBg), 4.5],
      "borde/fondo": [ratio(solid(t.enlaceBorde, f), F), 3],
      "bordeCristal/fondo": [ratio(solid(t.cristalBorde, f), F), 3],
      "sobreAcento/acento": [ratio(parse(t.sobreAcento), parse(t.acento)), 4.5],
      "acento/fondo": [ratio(parse(t.acento), F), 3],
      "foco/fondo": [ratio(parse(t.foco), F), 3],
      "foco/enlaceBg": [ratio(parse(t.foco), eBg), 3],
      "inicial/acentoSuave": [ratio(parse(t.acentoSuaveTexto), aS), 4.5],
    };
    for (const [k, [v, min]] of Object.entries(checks)) if (!(k in peor) || v < peor[k][0]) peor[k] = [v, min];
  }
  for (const [k, [v, min]] of Object.entries(peor)) {
    const ok = v >= min; if (!ok) fallos++;
    filas.push(`${ok ? "ok " : "FALLA"} ${id.padEnd(17)} ${k.padEnd(20)} ${v.toFixed(2)}:1 (mín ${min})`);
  }
}
console.log(filas.join("\n"));
console.log(fallos ? `\n${fallos} fallos` : "\nTodas las parejas cumplen AA");
export { P };
