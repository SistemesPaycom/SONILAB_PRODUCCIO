import { Body, Controller, Post, Get, Patch, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';

@Controller('/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * POST /auth/register — solo accesible por admin (crea nuevos usuarios).
   * El primer usuario del sistema debe crearse directamente en la BD o
   * via un script de seed.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('/register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  @Post('/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  // ─── Perfil propio ─────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async me(@CurrentUser() user: RequestUser) {
    if (!user?.userId) return null;
    return this.usersService.findById(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/me')
  async updateMe(
    @CurrentUser() user: RequestUser,
    @Body() body: { name?: string; email?: string; preferences?: any },
  ) {
    return this.usersService.update(user.userId, {
      name: body.name,
      email: body.email,
      preferences: body.preferences,
    });
  }

  // ─── Admin: gestión de usuarios ────────────────────────────────────────────

  /** GET /auth/admin/users — lista todos los usuarios (solo admin) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('/admin/users')
  listUsers() {
    return this.usersService.findAll();
  }

  /** POST /auth/admin/users — el admin crea un nuevo usuario */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('/admin/users')
  createUser(
    @Body() body: { email: string; password: string; name?: string; role?: 'admin' | 'user' },
  ) {
    return this.usersService.createByAdmin(body.email, body.password, body.name, body.role ?? 'user');
  }
}
