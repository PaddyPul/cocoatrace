import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';
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
  const { name, type, jurisdiction, legalRegistrationNumber } = req.body;
  const { rows } = await query(
    'INSERT INTO organizations (name, type, jurisdiction, legal_registration_number) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, type, jurisdiction, legalRegistrationNumber || null],
  );
  await audit.record({
    actorUserId: req.user!.id,
    actorOrganizationId: req.user!.organizationId,
    action: 'organization.create',
    entityType: 'organization',
    entityId: rows[0].id,
  });
  res.status(201).json(rows[0]);
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
