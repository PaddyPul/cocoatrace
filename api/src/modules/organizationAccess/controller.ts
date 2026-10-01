import { Request, Response } from 'express';
import { OrganizationAccessService } from './service';

export class OrganizationAccessController {
  constructor(private readonly service: OrganizationAccessService) {}

  requestAccess = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.requestAccess(req.body);
    res.status(202).json(result);
  };

  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    const application = await this.service.verifyEmail(req.body.token);
    res.json({
      id: application.id,
      status: application.status,
      emailVerifiedAt: application.emailVerifiedAt,
    });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.list(req.user!));
  };

  detail = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.get(req.user!, req.params.id));
  };

  approve = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.approve(req.user!, req.params.id, req.body.reason));
  };

  reject = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.reject(req.user!, req.params.id, req.body.reason));
  };
}
