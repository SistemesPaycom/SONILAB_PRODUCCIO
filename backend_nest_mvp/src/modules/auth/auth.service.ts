import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService, private readonly jwt: JwtService) {}

  async register(email: string, password: string) {
    const user = await this.users.create(email, password);
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { user, accessToken };
  }

  async login(email: string, password: string) {
    const user = await this.users.validate(email, password);
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { user, accessToken };
  }
}
