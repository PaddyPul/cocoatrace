import { Request, Response } from 'express';
import QRCode from 'qrcode';
import {
  readPublishedProduct,
  publishedQrSlug,
  recordPublishedScan,
} from '../../modules/publicProducts/projection';
import { publicProductUrl } from './publicUrl';

export async function getPublicProduct(req: Request, res: Response): Promise<void> {
  const result = await readPublishedProduct(req.params.slug);
  if (!result) {
    res.status(404).json({ error: 'Product profile not found' });
    return;
  }
  res.set('Cache-Control', 'no-store');
  res.json({
    ...result,
    profile: { ...result.profile, profileUrl: publicProductUrl(result.profile.slug) },
  });
}

export async function getProductQr(req: Request, res: Response): Promise<void> {
  const slug = await publishedQrSlug(req.params.slug);
  if (!slug) {
    res.status(404).json({ error: 'Product profile not found' });
    return;
  }
  const svg = await QRCode.toString(publicProductUrl(slug), {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: { dark: '#17251b', light: '#ffffff' },
  });
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svg);
}

export async function recordScan(req: Request, res: Response): Promise<void> {
  if (!(await recordPublishedScan(req.params.slug))) {
    res.status(404).json({ error: 'Product profile not found' });
    return;
  }
  res.status(204).send();
}
