import { AppError } from '../../../common/http/app.error.js';

const MAX_DECODED = 2 * 1024 * 1024;

export type ImageKind = 'jpeg' | 'png' | 'webp';

export function decodeDataUrl(dataUrl: string): Buffer {
  const match =
    /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(
      dataUrl.trim(),
    );
  if (!match) {
    throw new AppError('Fichier image invalide.', 422);
  }
  const bytes = Buffer.from(match[2]!, 'base64');
  if (bytes.length > MAX_DECODED) {
    throw new AppError('Cette photo dépasse 2 Mo.', 422);
  }
  return bytes;
}

export function sniffImage(bytes: Buffer): ImageKind {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  throw new AppError('Fichier image invalide.', 422);
}

export function inspectPhoto(dataUrl: string): {
  bytes: Buffer;
  kind: ImageKind;
} {
  const bytes = decodeDataUrl(dataUrl);
  return { bytes, kind: sniffImage(bytes) };
}
