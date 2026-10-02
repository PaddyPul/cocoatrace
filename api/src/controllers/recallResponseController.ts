import { ValidationError } from "../errors";
import { z } from "zod";
import type { Request, Response } from "express";
import {
  acknowledgeRecall,
  contactRecallParticipant,
  recallResponse,
  recordRecallRecovery,
  resolveRecallResponse,
} from "../modules/recall/response";
function id(value: unknown): string {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) throw new ValidationError("Invalid resource identifier");
  return parsed.data;
}
export async function response(req: Request, res: Response) {
  res.json(await recallResponse(req.user!, id(req.params.id)));
}
export async function acknowledge(req: Request, res: Response) {
  res.json(
    await acknowledgeRecall(req.user!, id(req.params.id), req.body.note),
  );
}
export async function contact(req: Request, res: Response) {
  res.json(
    await contactRecallParticipant(
      req.user!,
      id(req.params.id),
      id(req.params.organizationId),
      req.body.status,
      req.body.note,
    ),
  );
}
export async function recovery(req: Request, res: Response) {
  res.json(
    await recordRecallRecovery(
      req.user!,
      id(req.params.id),
      id(req.params.holdingId),
      req.body,
    ),
  );
}
export async function resolve(req: Request, res: Response) {
  res.json(
    await resolveRecallResponse(
      req.user!,
      id(req.params.id),
      req.body.reason,
      req.body.evidenceIds,
    ),
  );
}
