import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import fs from 'fs';

function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => undefined);
        res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
        return;
      }
      next(err);
    }
  };
}

export default validate;
