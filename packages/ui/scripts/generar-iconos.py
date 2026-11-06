"""Genera packages/ui/src/espacio/iconos/iconosHubly.tsx desde el set «Hubly · Iconos de Tu espacio» (issue 148).

Uso: python3 packages/ui/scripts/generar-iconos.py <carpeta-del-set>
La carpeta debe tener claro/, oscuro/ y seleccion/. Los colores de la versión clara se cambian por variables
(--hi-*) que tokens.css define para cada tema, así un solo SVG sirve en claro, oscuro y seleccionado.
"""
import os, re, sys

COLORES = {
    "#262C36": "borde", "#515968": "tono-1", "#303743": "tono-2", "#E5EAF3": "relieve", "#DCE5F8": "brillo",
    "#1D4ED8": "acento", "#606A7B": "medio", "#FFFFFF": "fondo", "#8C1D18": "peligro", "#6E4506": "aviso",
    "#165632": "exito", "#F7F7F8": "papel",
}
ATRIBUTOS = {"stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap", "stroke-linejoin": "strokeLinejoin",
             "stop-color": "stopColor", "fill-rule": "fillRule"}

def convertir(nombre: str, svg: str) -> str:
    cuerpo = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
    cuerpo = re.sub(r"<title>.*?</title>", "", cuerpo)
    gid = re.search(r'id="([^"]+)"', cuerpo).group(1)
    cuerpo = cuerpo.replace(gid, f"hi-{nombre}")
    def color(m):
        valor = m.group(0).upper()
        if valor not in COLORES: raise SystemExit(f"{nombre}: color sin variable {valor}")
        return f"var(--hi-{COLORES[valor]})"
    cuerpo = re.sub(r"#[0-9A-Fa-f]{6}\b", color, cuerpo)
    for viejo, nuevo in ATRIBUTOS.items(): cuerpo = cuerpo.replace(f" {viejo}=", f" {nuevo}=")
    cuerpo = re.sub(r"<(\w+)([^>]*)></\1>", r"<\1\2 />", cuerpo)
    return cuerpo

def main(carpeta: str):
    claro = os.path.join(carpeta, "claro")
    nombres = sorted(f[:-4] for f in os.listdir(claro) if f.endswith(".svg"))
    filas = []
    for nombre in nombres:
        svg = open(os.path.join(claro, f"{nombre}.svg"), encoding="utf-8").read()
        filas.append(f'  "{nombre}": <>{convertir(nombre, svg)}</>,')
    tipos = " | ".join(f'"{n}"' for n in nombres)
    salida = os.path.join(os.path.dirname(__file__), "..", "src", "espacio", "iconos", "iconosHubly.tsx")
    with open(salida, "w", encoding="utf-8") as f:
        f.write("// Generado por packages/ui/scripts/generar-iconos.py desde «Hubly · Iconos de Tu espacio» (issue 148). No editar a mano.\n")
        f.write("import type { ReactElement } from \"react\";\n\n")
        f.write(f"export type IconoHublyNombre = {tipos};\n\n")
        f.write("export const ICONOS_HUBLY: Record<IconoHublyNombre, ReactElement> = {\n" + "\n".join(filas) + "\n};\n")
    print(f"{len(nombres)} iconos → {os.path.normpath(salida)}")

if __name__ == "__main__":
    main(sys.argv[1])
