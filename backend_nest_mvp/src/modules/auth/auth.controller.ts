import { Body, Controller, Post, Get, Patch, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../users/users.service';

@Controller('/auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly usersService: UsersService) {}

  @Post('/register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  @Post('/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

   // -------------------------
  // Perfil: me / update me
  // -------------------------
  @UseGuards(AuthGuard('jwt'))
  @Get('/me')
  async me(@Request() req) {
    // JwtStrategy validate() devuelve { userId, email }
    const userId = req.user?.userId;
    if (!userId) return null;
    return this.usersService.findById(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('/me')
  async updateMe(@Request() req, @Body() body: { name?: string; email?: string; preferences?: any }) {
    const userId = req.user?.userId;
    const allowed = {
      name: body.name,
      email: body.email,
      preferences: body.preferences,
    };
    const updated = await this.usersService.update(userId, allowed);
    return updated;
  }
}
