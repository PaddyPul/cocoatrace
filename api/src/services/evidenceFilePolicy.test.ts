import { describe, expect, it } from 'vitest';
import { detectEvidenceMime, validateEvidenceContent, validateEvidenceMetadata } from './evidenceFilePolicy';

describe('evidence file policy', () => {
  it.each([
    ['proof.pdf', 'application/pdf'], ['proof.jpg', 'image/jpeg'], ['proof.jpeg', 'image/jpeg'], ['proof.png', 'image/png'],
  ])('accepts %s as %s', (name, mime) => expect(validateEvidenceMetadata(name, mime)).toEqual({ fileName: name, mimeType: mime }));
  it('sanitizes client paths', () => expect(validateEvidenceMetadata('C:\\fake\\proof.pdf', 'application/pdf').fileName).toBe('proof.pdf'));
  it('rejects extension and MIME mismatches', () => expect(() => validateEvidenceMetadata('proof.exe', 'application/pdf')).toThrow());
  it('detects supported signatures', () => {
    expect(detectEvidenceMime(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
    expect(detectEvidenceMime(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(detectEvidenceMime(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))).toBe('image/png');
  });
  it('rejects unsupported content', () => expect(() => detectEvidenceMime(Buffer.from('malware'))).toThrow());
  it('rejects signature spoofing', () => expect(() => validateEvidenceContent(Buffer.from('%PDF-1.7'), 'image/png')).toThrow());
});
