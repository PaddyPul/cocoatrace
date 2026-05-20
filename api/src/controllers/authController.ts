import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { signToken, JwtPayload } from '../middleware/auth';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  const { rows } = await query(
    `SELECT u.*, array_agg(DISTINCT r.name) as role_names, array_agg(DISTINCT p) as permissions
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     LEFT JOIN LATERAL unnest(r.permissions) p ON TRUE
     WHERE u.email = $1 AND u.active = TRUE
     GROUP BY u.id`,
    [email]
  );

  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const orgRes = await query('SELECT name, type FROM organizations WHERE id = $1', [user.organization_id]);
  const org = orgRes.rows[0];

  const permissions = [...new Set<string>(user.permissions.filter(Boolean))];
  const roles = user.role_names.filter(Boolean);

  const tokenPayload: JwtPayload = {
    id: user.id,
    organizationId: user.organization_id,
    email: user.email,
    name: user.name,
    roles,
    permissions,
    orgName: org?.name,
    orgType: org?.type,
  };

  const token = signToken(tokenPayload);

  res.json({
    accessToken: token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organization_id,
      orgName: org?.name,
      orgType: org?.type,
      roles,
      permissions,
    },
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT u.id, u.email, u.name, u.organization_id, u.mfa_enabled,
            o.name as org_name, o.type as org_type,
            array_agg(DISTINCT r.name) as roles,
            array_agg(DISTINCT p) as permissions
     FROM users u
     JOIN organizations o ON o.id = u.organization_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     LEFT JOIN LATERAL unnest(r.permissions) p ON TRUE
     WHERE u.id = $1
     GROUP BY u.id, o.name, o.type`,
    [req.user!.id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const u = rows[0];
  res.json({ ...u, permissions: [...new Set<string>(u.permissions.filter(Boolean))], roles: u.roles.filter(Boolean) });
}
