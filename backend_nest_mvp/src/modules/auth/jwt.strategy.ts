import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
      ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Cookie de només-media (SPS-0023): permet que el <video> faci streaming
      // sense portar el JWT a la query string (que es filtra a logs, historial
      // del navegador, Referer i proxies). Només s'envia a Path=/media.
      (req: any) => (req?.cookies?.media_token as string) || null,
      // Transitori: ?token= a la query. Es manté per compatibilitat amb enllaços
      // antics; el <video> ja NO l'usa. Retirar quan es confirmi que cap client el fa servir.
      ExtractJwt.fromUrlQueryParameter('token'),
    ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    return { userId: payload.sub, email: payload.email, role: payload.role ?? 'user' };
  }
}
