import { legacyContracts } from '../modules/catalog/contracts';
import { legacyOffers } from '../modules/catalog/offers';
import { withCatalogRead } from '../modules/catalog/paging';
import { readContractDetail } from '../modules/catalog/contractDetail';
import {
  agreePaymentTerms,
  proposePaymentTerms,
  type PaymentTermsInput,
} from '../modules/payments/terms';
import { AppError } from '../errors';
import { Request, Response } from 'express';
import {
  updateBuyerEudrReference,
  updateBuyerComplianceReference,
} from '../modules/agreements/complianceReferences';
import { acceptTradeOffer, createTradeOffer, rejectTradeOffer } from '../modules/trading/offers';

export async function listOffers(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => legacyOffers(execute, req.user!.organizationId)));
}

export async function makeOffer(req: Request, res: Response): Promise<void> {
  const offer = await createTradeOffer(req.user!, req.params.id as string, req.body);
  res.status(201).json(offer);
}

export async function acceptOffer(req: Request, res: Response): Promise<void> {
  res.json(await acceptTradeOffer(req.user!, req.params.id as string, req.body?.feeRateBps));
}

export async function rejectOffer(req: Request, res: Response): Promise<void> {
  res.json(await rejectTradeOffer(req.user!, req.params.id as string, req.body.reason));
}

export async function listContracts(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => legacyContracts(execute, req.user!.organizationId)));
}

export async function getContract(req: Request, res: Response): Promise<void> {
  const detail = await readContractDetail(req.user!, req.params.id as string);
  if (!detail) {
    res.status(404).json({ error: 'Contract not found' });
    return;
  }
  res.json(detail);
}

// Preserve the existing HTTP response shape while the service owns transaction policy.
export async function updatePaymentTerms(req: Request, res: Response): Promise<void> {
  try {
    res.json(
      await proposePaymentTerms(req.user!, req.params.id as string, req.body as PaymentTermsInput),
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    res.status(error.statusCode).json({ error: error.message });
  }
}

export async function confirmPaymentTerms(req: Request, res: Response): Promise<void> {
  try {
    res.json(await agreePaymentTerms(req.user!, req.params.id as string));
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    res.status(error.statusCode).json({ error: error.message });
  }
}

export async function updateEudrReference(req: Request, res: Response): Promise<void> {
  const contract = await updateBuyerEudrReference(
    req.user!,
    req.params.id as string,
    req.body.eudrDueDiligenceReference,
  );
  if (!contract) {
    res.status(404).json({ error: 'Contract not found or not your contract' });
    return;
  }
  res.json(contract);
}
export async function updateComplianceReference(req: Request, res: Response): Promise<void> {
  const contract = await updateBuyerComplianceReference(
    req.user!,
    req.params.id as string,
    req.body.scheme,
    req.body.reference,
  );
  if (!contract) {
    res.status(404).json({ error: 'Contract not found or not your contract' });
    return;
  }
  res.json(contract);
}
