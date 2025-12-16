import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

type JwtPayload = { sub: number; dni: string; role?: 'patient' | 'revisor' | 'coordinator' };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev_secret_change_me',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();

    if ((user as any).isValidate === false) {
      throw new UnauthorizedException('Usuario no validado');
    }

    const roles = await this.users.getRoles(user.id);

    return {
      sub: user.id,
      dni: user.dni,
      role: payload.role ?? null,
      roles,                     
    };
  }
}
