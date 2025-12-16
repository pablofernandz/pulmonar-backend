import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRaw = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredRaw || requiredRaw.length === 0) return true;

    const normalize = (r: string) => (r ?? '').toString().trim().toLowerCase();
    const alias = (r: string) => (r === 'tutor' ? 'revisor' : r);
    const required = requiredRaw.map((r) => alias(normalize(r)));

    const req = ctx.switchToHttp().getRequest();
    const user = req.user || {};

    const userRoles = new Set<string>();

    const roleStr = (user.role ?? '').toString().trim().toLowerCase();
    if (roleStr) userRoles.add(alias(roleStr));

    const flags = user.roles && typeof user.roles === 'object' ? user.roles : {};
    for (const [k, v] of Object.entries(flags)) {
      if (v) userRoles.add(alias(k.toLowerCase()));
    }

    const ok = required.some((r) => userRoles.has(r));
    if (!ok) throw new ForbiddenException();

    return true;
  }
}
