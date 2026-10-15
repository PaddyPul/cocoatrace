import type { Request, Response } from 'express';
import { withdrawTradeOffer } from '../modules/trading/withdrawOffer';

export async function withdrawOffer(req: Request, res: Response): Promise<void> {
  res.json(await withdrawTradeOffer(req.user!, req.params.id as string));
}
