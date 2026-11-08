// Validación y limpieza de «Tu imagen» (#84, ADR 0008), sin dependencias: se reconoce el tipo real por su firma binaria
// y se quitan los metadatos (EXIF con GPS y cámara, XMP, IPTC, textos y comentarios) sin volver a comprimir la imagen.

export const WALLPAPER_MAX_BYTES = 5 * 1024 * 1024;

export type WallpaperImageType = "image/jpeg" | "image/png" | "image/webp";

export class WallpaperImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WallpaperImageError";
  }
}

const invalid = () => new WallpaperImageError("El archivo no es una imagen JPEG, PNG o WebP válida.");

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((value, index) => bytes[offset + index] === value);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

/** Tipo real según los primeros bytes; nunca según la extensión ni el Content-Type que manda el navegador. */
export function sniffWallpaperType(bytes: Uint8Array): WallpaperImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  return null;
}

const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

// JPEG: se conservan JFIF (APP0), el perfil de color ICC (APP2 «ICC_PROFILE») y Adobe (APP14); fuera EXIF/XMP (APP1),
// IPTC/Photoshop (APP13), el resto de APPn y los comentarios (COM). Dentro de un escaneo (SOS), los datos de entropía
// (incluidos FF 00 y los RST FF D0–FF D7) se copian byte a byte hasta el siguiente marcador real; ese marcador vuelve al
// bucle de segmentos y pasa por el mismo filtro. Al llegar a EOI se añade EOI y se descarta todo lo que venga después.
// Si el archivo acaba sin EOI, no es un JPEG válido.
function stripJpeg(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw invalid();
    let marker = bytes[offset + 1];
    while (marker === 0xff) {
      offset += 1;
      marker = bytes[offset + 1];
    }
    if (marker === undefined) throw invalid();
    if (marker === 0xd9) {
      parts.push(bytes.subarray(offset, offset + 2));
      return concat(parts);
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      parts.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) throw invalid();
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) throw invalid();
    const segment = bytes.subarray(offset, end);
    if (marker === 0xda) {
      parts.push(segment);
      offset = end;
      const dataStart = offset;
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const next = bytes[offset + 1];
        if (next === undefined) throw invalid();
        // FF 00 es el relleno de un byte de datos y FF D0–FF D7 es un reinicio: ambos son datos del escaneo.
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          offset += 2;
          continue;
        }
        // Cualquier otro FF xx es un marcador real (o relleno FF FF): aquí acaban los datos de entropía.
        break;
      }
      if (offset >= bytes.length) throw invalid();
      parts.push(bytes.subarray(dataStart, offset));
      continue;
    }
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const keep = !isApp && marker !== 0xfe
      ? true
      : marker === 0xe0 || marker === 0xee || (marker === 0xe2 && startsWith(segment, ascii("ICC_PROFILE"), 4));
    if (keep) parts.push(segment);
    offset = end;
  }
  throw invalid();
}

const PNG_METADATA_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

// PNG: se quitan los fragmentos de metadatos; los críticos (IHDR, IDAT, IEND…) y el perfil de color se conservan.
function stripPng(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let sawEnd = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw invalid();
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (end > bytes.length || !/^[A-Za-z]{4}$/.test(type)) throw invalid();
    if (!PNG_METADATA_CHUNKS.has(type)) parts.push(bytes.subarray(offset, end));
    offset = end;
    if (type === "IEND") {
      sawEnd = true;
      break;
    }
  }
  if (!sawEnd || parts.length < 3) throw invalid();
  return concat(parts);
}

// WebP: se quitan los fragmentos EXIF y XMP, se apagan sus banderas en VP8X y se recalcula el tamaño del RIFF.
function stripWebp(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffEnd = 8 + view.getUint32(4, true);
  if (riffEnd > bytes.length || riffEnd < 20) throw invalid();
  const chunks: Uint8Array[] = [];
  let offset = 12;
  let hasImage = false;
  while (offset < riffEnd) {
    if (offset + 8 > riffEnd) throw invalid();
    const fourcc = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    const end = offset + 8 + size + (size % 2);
    if (end > riffEnd + 1) throw invalid();
    if (fourcc === "VP8 " || fourcc === "VP8L" || fourcc === "ANIM") hasImage = true;
    if (fourcc !== "EXIF" && fourcc !== "XMP ") {
      const chunk = bytes.slice(offset, Math.min(end, riffEnd));
      // Bandera 0x08 = EXIF y 0x04 = XMP en el primer byte de VP8X.
      if (fourcc === "VP8X" && chunk.length > 8) chunk[8] = chunk[8]! & ~0x0c;
      chunks.push(chunk);
    }
    offset = end;
  }
  if (!hasImage) throw invalid();
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(ascii("RIFF"), 0);
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  header.set(ascii("WEBP"), 8);
  return concat([header, body]);
}

/** Valida tamaño y tipo real y devuelve la imagen sin metadatos. Lanza WallpaperImageError con un mensaje para la persona. */
export function sanitizeWallpaperImage(
  input: Uint8Array,
  maxBytes = WALLPAPER_MAX_BYTES,
): { bytes: Uint8Array; contentType: WallpaperImageType } {
  if (input.length === 0) throw invalid();
  if (input.length > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    throw new WallpaperImageError(`La imagen pesa más de ${limitMb} MB. Elige una más ligera.`);
  }
  const contentType = sniffWallpaperType(input);
  if (!contentType) throw invalid();
  const bytes = contentType === "image/jpeg" ? stripJpeg(input) : contentType === "image/png" ? stripPng(input) : stripWebp(input);
  return { bytes, contentType };
}
