import { describe, expect, it } from "vitest";
import { WALLPAPER_MAX_BYTES, WallpaperImageError, sanitizeWallpaperImage, sniffWallpaperType } from "../src/server/composition/wallpaper-image";

const bytes = (...parts: Array<number[] | string | Uint8Array>) => {
  const arrays = parts.map((p) => (typeof p === "string" ? Uint8Array.from(p, (c) => c.charCodeAt(0)) : p instanceof Uint8Array ? p : Uint8Array.from(p)));
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrays) { out.set(a, o); o += a.length; }
  return out;
};
const text = (b: Uint8Array) => Buffer.from(b).toString("latin1");
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

const jpegSegment = (marker: number, payload: Uint8Array) => bytes([0xff, marker, ...be16(payload.length + 2)], payload);
const scanData = bytes([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78]);
const sampleJpeg = () => bytes(
  [0xff, 0xd8],
  jpegSegment(0xe0, bytes("JFIF\0", [1, 1, 0, 0, 1, 0, 1, 0, 0])),
  jpegSegment(0xe1, bytes("Exif\0\0", "GPSLatitude=19.43;Model=CamaraX")),
  jpegSegment(0xe1, bytes("http://ns.adobe.com/xap/1.0/\0", "<x:xmpmeta>GPS</x:xmpmeta>")),
  jpegSegment(0xe2, bytes("ICC_PROFILE\0", [1, 1, 9, 9])),
  jpegSegment(0xed, bytes("Photoshop 3.0\0", "IPTC autor")),
  jpegSegment(0xfe, bytes("comentario privado")),
  jpegSegment(0xdb, bytes([0, ...new Array(64).fill(1)])),
  jpegSegment(0xda, bytes([1, 1, 0, 0, 0x3f, 0])),
  scanData,
  [0xff, 0xd9],
);

const pngChunk = (type: string, data: Uint8Array) => bytes(be32(data.length), type, data, [0, 0, 0, 0]);
const samplePng = () => bytes(
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  pngChunk("IHDR", bytes(be32(1), be32(1), [8, 6, 0, 0, 0])),
  pngChunk("tEXt", bytes("Author\0Ana")),
  pngChunk("eXIf", bytes("MM\0*GPS")),
  pngChunk("iCCP", bytes("perfil\0", [0, 1, 2])),
  pngChunk("IDAT", bytes([1, 2, 3, 4])),
  pngChunk("tIME", bytes([7, 234, 11, 5, 10, 0, 0])),
  pngChunk("IEND", new Uint8Array(0)),
);

const webpChunk = (fourcc: string, data: Uint8Array) => bytes(fourcc, le32(data.length), data, data.length % 2 ? [0] : []);
const sampleWebp = () => {
  const body = bytes(
    webpChunk("VP8X", bytes([0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
    webpChunk("VP8 ", bytes([9, 8, 7, 6, 5])),
    webpChunk("EXIF", bytes("MM\0*GPSLatitude")),
    webpChunk("XMP ", bytes("<x:xmpmeta/>")),
  );
  return bytes("RIFF", le32(body.length + 4), "WEBP", body);
};

describe("«Tu imagen»: tipo real y limpieza de metadatos sin dependencias (#84)", () => {
  it("reconoce el tipo por la firma binaria, no por la extensión", () => {
    expect(sniffWallpaperType(sampleJpeg())).toBe("image/jpeg");
    expect(sniffWallpaperType(samplePng())).toBe("image/png");
    expect(sniffWallpaperType(sampleWebp())).toBe("image/webp");
    expect(sniffWallpaperType(bytes("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffWallpaperType(bytes("GIF89a"))).toBeNull();
  });

  it("JPEG: quita EXIF, XMP, IPTC y comentarios; conserva JFIF, el perfil de color y los datos de la imagen", () => {
    const { bytes: out, contentType } = sanitizeWallpaperImage(sampleJpeg());
    const s = text(out);
    expect(contentType).toBe("image/jpeg");
    for (const gone of ["Exif", "GPS", "CamaraX", "xmpmeta", "IPTC", "comentario privado"]) expect(s).not.toContain(gone);
    expect(s).toContain("JFIF");
    expect(s).toContain("ICC_PROFILE");
    expect([...out.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    expect([...out.subarray(-2)]).toEqual([0xff, 0xd9]);
    expect(s).toContain(text(scanData));
  });

  it("PNG: quita textos, EXIF y fecha; conserva los fragmentos de la imagen y el perfil de color", () => {
    const s = text(sanitizeWallpaperImage(samplePng()).bytes);
    for (const gone of ["tEXt", "Ana", "eXIf", "GPS", "tIME"]) expect(s).not.toContain(gone);
    for (const kept of ["IHDR", "iCCP", "IDAT", "IEND"]) expect(s).toContain(kept);
  });

  it("WebP: quita EXIF y XMP, apaga sus banderas en VP8X y recalcula el tamaño del RIFF", () => {
    const out = sanitizeWallpaperImage(sampleWebp()).bytes;
    const s = text(out);
    expect(s).not.toContain("EXIF");
    expect(s).not.toContain("GPS");
    expect(s).not.toContain("XMP ");
    expect(s).toContain("VP8 ");
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    expect(view.getUint32(4, true)).toBe(out.length - 8);
    expect(out[20]! & 0x0c).toBe(0);
  });

  it("rechaza lo que no es una imagen válida o pesa más de 5 MB", () => {
    const reject = (input: Uint8Array) => expect(() => sanitizeWallpaperImage(input)).toThrow(WallpaperImageError);
    reject(new Uint8Array(0));
    reject(bytes("esto es texto plano, no una imagen"));
    reject(bytes("<svg onload='alert(1)'/>"));
    reject(samplePng().subarray(0, 40));
    reject(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], pngChunk("IHDR", bytes(be32(1), be32(1), [8, 6, 0, 0, 0]))));
    reject(sampleJpeg().subarray(0, 30));
    reject(bytes("RIFF", le32(12), "WEBP", webpChunk("EXIF", bytes("GPS1"))));
    const huge = new Uint8Array(WALLPAPER_MAX_BYTES + 1);
    huge.set(sampleJpeg());
    expect(() => sanitizeWallpaperImage(huge)).toThrow(/5 MB/);
  });
});

// JPEG construidos byte a byte para comprobar los barridos y la cola tras EOI (#84, hallazgo 1 de Claude).
const jpegStart = () => bytes(
  [0xff, 0xd8],
  jpegSegment(0xe0, bytes("JFIF\0", [1, 1, 0, 0, 1, 0, 1, 0, 0])),
  jpegSegment(0xdb, bytes([0, ...new Array(64).fill(1)])),
  jpegSegment(0xc2, bytes([8, 0, 1, 0, 1, 1, 1, 0x11, 0])),
);
const firstScanHeader = () => jpegSegment(0xda, bytes([1, 1, 0, 0, 0x3f, 0]));
const secondScanHeader = () => jpegSegment(0xda, bytes([1, 1, 0, 1, 0x3f, 0]));
const firstScanData = bytes([0x11, 0x22, 0xff, 0x00, 0x33]);
const secondScanData = bytes([0x44, 0x55, 0xff, 0xd3, 0x66]);
const cleanJpeg = () => bytes(jpegStart(), firstScanHeader(), scanData, [0xff, 0xd9]);

describe("«Tu imagen»: JPEG progresivos, marcadores entre barridos y cola tras EOI (#84)", () => {
  it("quita el APP1 Exif entre dos barridos y conserva los dos escaneos íntegros", () => {
    const image = bytes(
      jpegStart(),
      firstScanHeader(),
      firstScanData,
      jpegSegment(0xe1, bytes("Exif\0\0", "GPSLatitude=19.43;Model=CamaraX")),
      secondScanHeader(),
      secondScanData,
      [0xff, 0xd9],
    );
    const out = sanitizeWallpaperImage(image).bytes;
    const expected = bytes(jpegStart(), firstScanHeader(), firstScanData, secondScanHeader(), secondScanData, [0xff, 0xd9]);
    expect(text(out)).not.toContain("Exif");
    expect(text(out)).not.toContain("GPSLatitude");
    expect([...out]).toEqual([...expected]);
    expect(text(out)).toContain(text(firstScanData));
    expect(text(out)).toContain(text(secondScanData));
  });

  it("quita un COM después del primer escaneo", () => {
    const image = bytes(jpegStart(), firstScanHeader(), scanData, jpegSegment(0xfe, bytes("comentario tras el escaneo")), [0xff, 0xd9]);
    const out = sanitizeWallpaperImage(image).bytes;
    expect(text(out)).not.toContain("comentario tras el escaneo");
    expect([...out]).toEqual([...cleanJpeg()]);
  });

  it("descarta los bytes basura después de EOI y termina exactamente en FF D9", () => {
    const garbage = bytes("<html><script>alert('pegado tras EOI')</script></html>");
    const out = sanitizeWallpaperImage(bytes(cleanJpeg(), garbage)).bytes;
    expect(text(out)).not.toContain("pegado tras EOI");
    expect([...out.subarray(-2)]).toEqual([0xff, 0xd9]);
    expect([...out]).toEqual([...cleanJpeg()]);
  });

  it("conserva byte a byte los FF 00 y los RST FF D0–FF D7 de los datos de entropía", () => {
    const entropy = bytes([
      0x01, 0xff, 0x00, 0x02,
      0xff, 0xd0, 0xff, 0xd1, 0xff, 0xd2, 0xff, 0xd3,
      0xff, 0xd4, 0xff, 0xd5, 0xff, 0xd6, 0xff, 0xd7,
      0x03, 0xff, 0x00, 0x04,
    ]);
    const image = bytes(jpegStart(), firstScanHeader(), entropy, [0xff, 0xd9]);
    const out = sanitizeWallpaperImage(image).bytes;
    expect(text(out)).toContain(text(entropy));
    expect([...out]).toEqual([...image]);
  });

  it("rechaza un JPEG sin EOI", () => {
    const image = bytes(jpegStart(), firstScanHeader(), scanData);
    expect(() => sanitizeWallpaperImage(image)).toThrow(WallpaperImageError);
    expect(() => sanitizeWallpaperImage(image)).toThrow("El archivo no es una imagen JPEG, PNG o WebP válida.");
  });

  it("conserva el APP2 «ICC_PROFILE» entre dos escaneos", () => {
    const icc = jpegSegment(0xe2, bytes("ICC_PROFILE\0", [1, 1, 9, 9]));
    const image = bytes(jpegStart(), firstScanHeader(), firstScanData, icc, secondScanHeader(), secondScanData, [0xff, 0xd9]);
    const out = sanitizeWallpaperImage(image).bytes;
    expect(text(out)).toContain("ICC_PROFILE");
    expect([...out]).toEqual([...image]);
  });
});
