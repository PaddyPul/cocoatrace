import { Router } from 'express';
import { AppError } from '../../errors';
import { z } from 'zod';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { requireAuth } from '../../middleware/auth';
import { sensitiveActionLimit } from '../../middleware/security';
import { options, verify, listKeys, revokeKey } from './service';
const router = Router();
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError('Invalid passkey request', 400, 'VALIDATION_ERROR');
  return result.data;
}
router.use('/auth/mfa', requireAuth);
router.get('/auth/mfa/keys', async (req, res) => res.json({ keys: await listKeys(req.user!) }));
router.post('/auth/mfa/registration/options', sensitiveActionLimit, async (req, res) => {
  const body = parse(z.object({ currentPassword: z.string().min(1).max(200) }), req.body);
  res.json(await options(req.user!, 'registration', body.currentPassword));
});
router.post('/auth/mfa/authentication/options', sensitiveActionLimit, async (req, res) =>
  res.json(await options(req.user!, 'authentication')),
);
const responseSchema = z
  .object({
    id: z.string().min(1).max(2048),
    rawId: z.string(),
    type: z.literal('public-key'),
    response: z.record(z.string(), z.unknown()),
    clientExtensionResults: z.record(z.string(), z.unknown()),
  })
  .passthrough();
router.post('/auth/mfa/registration/verify', sensitiveActionLimit, async (req, res) => {
  const body = parse(
    z.object({ response: responseSchema, label: z.string().trim().min(1).max(80) }),
    req.body,
  );
  await verify(
    req.user!,
    'registration',
    body.response as unknown as RegistrationResponseJSON,
    body.label,
  );
  res.json({ verified: true });
});
router.post('/auth/mfa/authentication/verify', sensitiveActionLimit, async (req, res) => {
  const body = parse(z.object({ response: responseSchema }), req.body);
  await verify(req.user!, 'authentication', body.response as unknown as AuthenticationResponseJSON);
  res.json({ verified: true });
});
router.delete('/auth/mfa/keys/:id', sensitiveActionLimit, async (req, res) => {
  await revokeKey(req.user!, parse(z.string().min(1).max(2048), req.params.id));
  res.status(204).send();
});
export default router;
