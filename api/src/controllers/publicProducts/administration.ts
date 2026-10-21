import { Request, Response } from 'express';
import { legacyProducts } from '../../modules/catalog/productProfiles';
import { withCatalogRead } from '../../modules/catalog/paging';
import * as workflow from '../../modules/publicProducts/administration';
import type { ProfileRow } from '../../modules/publicProducts/types';
import { publicProductUrl } from './publicUrl';

function profileLinks(profile: ProfileRow) {
  return {
    ...profile,
    profileUrl: publicProductUrl(profile.slug),
    qrSvgUrl: `/public/products/${profile.slug}/qr.svg`,
  };
}

export async function listProductProfiles(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => legacyProducts(execute, req.user!, req.query)));
}

export async function getProfileForBatch(req: Request, res: Response): Promise<void> {
  try {
    const profile = await workflow.getProfileForBatch(req.user!, req.params.batchId);
    res.json(profileLinks(profile));
  } catch (error) {
    if (!(error instanceof workflow.PublicProductWorkflowError)) throw error;
    res.status(error.statusCode).json({ error: error.message });
  }
}

export async function upsertProfile(req: Request, res: Response): Promise<void> {
  try {
    const profile = await workflow.upsertProfile(req.user!, req.body);
    res.status(201).json(profileLinks(profile));
  } catch (error) {
    if (!(error instanceof workflow.PublicProductWorkflowError)) throw error;
    res.status(error.statusCode).json({ error: error.message });
  }
}

export async function publishProfile(req: Request, res: Response): Promise<void> {
  try {
    const profile = await workflow.publishProfile(req.user!, req.params.id);
    res.json(profile);
  } catch (error) {
    if (!(error instanceof workflow.PublicProductWorkflowError)) throw error;
    res.status(error.statusCode).json({ error: error.message });
  }
}
