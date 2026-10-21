import * as workflow from '../modules/organizationWorkflow/commands';
import { Request, Response } from 'express';
import { withCatalogRead } from '../modules/catalog/paging';
import {
  legacyOrganizations,
  organizationPage,
  organizationSummary,
  legacyMembers,
  memberPage,
  memberSummary,
} from '../modules/catalog/organizationRecords';

export async function listOrganizations(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await withCatalogRead((execute) => legacyOrganizations(execute, req.user!, req.query)));
}
export async function listOrganizationPage(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await withCatalogRead((execute) => organizationPage(execute, req.user!, req.query)));
}
export async function summarizeOrganizations(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await withCatalogRead((execute) => organizationSummary(execute, req.user!, req.query)));
}

export async function createOrganization(req: Request, res: Response): Promise<void> {
  const result = await workflow.createOrganization(req.user!, req.body);
  res.status(201).json(result);
}

export async function listOrganizationMembers(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await withCatalogRead((execute) => legacyMembers(execute, req.user!, req.params.id)));
}
export async function listOrganizationMemberPage(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.json(
    await withCatalogRead((execute) => memberPage(execute, req.user!, req.params.id, req.query)),
  );
}
export async function summarizeOrganizationMembers(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await withCatalogRead((execute) => memberSummary(execute, req.user!, req.params.id)));
}
