import express, { type Request, type Response, type NextFunction } from 'express';
import { config } from '../config/env';
import { AppError } from '../errors';
import { authorizeUploadContent } from '../services/evidenceUploadService';
import { uploadEvidenceContent } from '../controllers/evidenceController';
import { evidenceConcurrency } from '../modules/security/evidenceConcurrency';

export function createEvidenceContentHandler(bodyDeadlineMs = 30_000) {
  const parser = express.raw({ type: '*/*', limit: config.evidenceMaxFileBytes });
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let release: (() => void) | undefined;
    try {
      const identity = await authorizeUploadContent(
        req.params.id,
        Number(req.query.expires),
        typeof req.query.signature === 'string' ? req.query.signature : '',
      );
      if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity')
        throw new AppError(
          'Encoded evidence upload bodies are not supported',
          415,
          'EVIDENCE_BODY_ENCODING',
        );
      try {
        release = evidenceConcurrency.acquire(identity.organizationId);
      } catch (error) {
        res.setHeader('Retry-After', '1');
        throw error;
      }
      await new Promise<void>((resolve, reject) => {
        let finished = false;
        const timer = setTimeout(() => {
          finish(new AppError('Evidence upload body timed out', 408, 'EVIDENCE_BODY_TIMEOUT'));
          req.destroy();
        }, bodyDeadlineMs);
        const finish = (error?: unknown) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          if (error) reject(error);
          else resolve();
        };
        try {
          parser(req, res, finish);
        } catch (error) {
          finish(error);
        }
      });
      await uploadEvidenceContent(req, res);
    } catch (error) {
      next(error);
    } finally {
      release?.();
    }
  };
}
export const evidenceContentHandler = createEvidenceContentHandler();
