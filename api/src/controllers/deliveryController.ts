import { Request, Response } from 'express';
import * as workflow from '../modules/delivery/workflow';
export async function get(req: Request, res: Response) { res.json(await workflow.getDelivery(req.user!, req.params.id)); }
export async function accept(req: Request, res: Response) { res.json(await workflow.acceptDelivery(req.user!, req.params.id, req.body)); }
export async function report(req: Request, res: Response) { res.status(201).json(await workflow.reportDiscrepancy(req.user!, req.params.id, req.body)); }
export async function propose(req: Request, res: Response) { res.json(await workflow.proposeResolution(req.user!, req.params.id, req.body.note)); }
export async function approve(req: Request, res: Response) { res.json(await workflow.approveResolution(req.user!, req.params.id)); }
