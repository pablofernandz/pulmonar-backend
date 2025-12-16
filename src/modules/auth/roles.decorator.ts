import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type Role = 'coordinator' | 'revisor' | 'patient';

export const Roles = (...roles: (Role | string)[]) => {
  const normalize = (r: string) => (r ?? '').toString().trim().toLowerCase();
  const alias = (r: string) => (r === 'tutor' ? 'revisor' : r);

  const normalized = roles
    .map((r) => alias(normalize(String(r))))
    .filter((r) => r.length > 0);

  return SetMetadata(ROLES_KEY, normalized);
};
