import path from 'path';
import { ValidationError } from '../errors';

export const ALLOWED_EVIDENCE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type AllowedEvidenceMime = (typeof ALLOWED_EVIDENCE_MIME_TYPES)[number];

const extensions: Record<AllowedEvidenceMime, readonly string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

export function validateEvidenceMetadata(fileName: string, mimeType: string): { fileName: string; mimeType: AllowedEvidenceMime } {
  // Filenames must strip control characters; this security filter deliberately matches them.
  // eslint-disable-next-line no-control-regex
  const cleanName = path.basename(fileName.replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleanName || cleanName.length > 255) throw new ValidationError('A valid evidence filename is required');
  if (!(ALLOWED_EVIDENCE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new ValidationError('Evidence must be a PDF, JPEG or PNG file');
  }
  const allowedMime = mimeType as AllowedEvidenceMime;
  if (!extensions[allowedMime].includes(path.extname(cleanName).toLowerCase())) {
    throw new ValidationError('Filename extension does not match the declared file type');
  }
  return { fileName: cleanName, mimeType: allowedMime };
}

export function detectEvidenceMime(content: Buffer): AllowedEvidenceMime {
  if (content.length >= 5 && content.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) return 'image/jpeg';
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (content.length >= png.length && content.subarray(0, png.length).equals(png)) return 'image/png';
  throw new ValidationError('File content is not a valid PDF, JPEG or PNG');
}

export function validateEvidenceContent(content: Buffer, claimedMimeType: AllowedEvidenceMime): AllowedEvidenceMime {
  const detected = detectEvidenceMime(content);
  if (detected !== claimedMimeType) throw new ValidationError('File content does not match the declared file type');
  return detected;
}
