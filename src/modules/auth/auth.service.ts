import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dtos/change-password.dto';

type RolesMap = { coordinator: boolean; revisor: boolean; patient: boolean };

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  // ---------------- Funciones auxiliares ----------------

  private async assertValid(dni: string, password: string) {
    const normDni = (dni ?? '').trim().toUpperCase();
    const user = await this.users.findByDni(normDni, { withPassword: true });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const v = (user as any).isValidate;
    if (v === 0 || v === false || v === '0') {
      throw new UnauthorizedException('Usuario no validado');
    }

    const ok = await this.users.validatePassword(user, password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    if ((process.env.AUTH_REHASH_ON_LOGIN || '').toLowerCase() === 'true') {
      await this.users.rehashIfLegacy(user, password);
    }

    return user;
  }

  private async getRolesMap(userId: number): Promise<RolesMap> {
    const roles = await this.users.getRoles(userId);
    return {
      coordinator: !!roles?.coordinator,
      revisor: !!roles?.revisor,
      patient: !!roles?.patient,
    };
  }

 

  // devuelve token SIN rol
  async login(dni: string, password: string) {
    const user = await this.assertValid(dni, password);

    // token sin rol que sirve para /auth/me y /auth/select-role
    const payload = { sub: user.id, dni: (user as any).dni };
    const access_token = await this.jwt.signAsync(payload);

    const roles = await this.getRolesMap(user.id);

    return {
      access_token,
      user: {
        id: user.id,
        dni: (user as any).dni,
        name: (user as any).name,
        last_name_1: (user as any).last_name_1 ?? null,
        last_name_2: (user as any).last_name_2 ?? null,
        mail: (user as any).mail ?? null,
      },
      roles,           
      selectedRole: null,
    };
  }

  // Datos del usuario autenticado para /auth/me
  async me(jwtUser: { sub?: number; userId?: number; id?: number; dni?: string; role?: string | null }) {
    const userId: number =
      (jwtUser?.sub as number) ??
      (jwtUser?.userId as number) ??
      (jwtUser?.id as number);

    if (!userId) throw new UnauthorizedException();

    const roles = await this.getRolesMap(userId);

    return {
      userId,
      dni: jwtUser?.dni ?? '',
      role: jwtUser?.role ?? null, 
      roles,                      
    };
  }

  // Devuelve un nuevo token con el rol seleccionado
  async selectRole(userId: number, role: 'coordinator' | 'revisor' | 'patient') {
    const roles = await this.getRolesMap(userId);

    if (!roles[role]) {
      throw new ForbiddenException('Rol no permitido para este usuario');
    }

    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();

    const payload = {
      sub: userId,
      dni: (user as any).dni,
      role,
    };

    const access_token = await this.jwt.signAsync(payload);
    return { access_token, role };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    if (!dto?.currentPassword || !dto?.newPassword) {
      throw new BadRequestException('Faltan campos de contraseña');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('La nueva contraseña no puede ser igual a la actual');
    }

    const user = await this.users.findById(userId, { withPassword: true });
    if (!user) throw new UnauthorizedException();

    const ok = await this.users.validatePassword(user, dto.currentPassword);
    if (!ok) throw new UnauthorizedException('Contraseña actual incorrecta');

    await this.users.setPassword(userId, dto.newPassword);
    return { ok: true };
  }
}

