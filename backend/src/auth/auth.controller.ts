import {
  Body,
  ConflictException,
  Controller,
  Get,
  BadRequestException,
  HttpCode,
  Patch,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { Model } from 'mongoose';
import { buildAuthUser } from '../common/auth.guard.js';
import { CurrentUser, Public } from '../common/decorators.js';
import type { AuthUser } from '../common/decorators.js';
import { config } from '../config.js';
import { Role, User } from '../schemas/index.js';

class SignUpDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsEmail() @MaxLength(160) email: string;
  @IsString() @MinLength(8) @MaxLength(128) password: string;
}

class SignInDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(128) password: string;
}

class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) newPassword?: string;
  /** Required when changing email or password. */
  @IsOptional() @IsString() @MaxLength(128) currentPassword?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly jwt: JwtService,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Role.name) private readonly roles: Model<Role>,
  ) {}

  @Public()
  @Post('signup')
  async signUp(@Body() dto: SignUpDto, @Res({ passthrough: true }) res: Response) {
    const email = dto.email.toLowerCase();
    if (await this.users.exists({ email })) throw new ConflictException('An account with this email already exists');

    const role = await this.roles.findOne({ isDefault: true, deletedAt: null }).lean();
    const user = await this.users.create({
      name: dto.name.trim(),
      email,
      passwordHash: await bcrypt.hash(dto.password, 12),
      role: role?._id ?? null,
      lastLoginAt: new Date(),
    });
    await this.issueCookie(res, String(user._id));
    return buildAuthUser(user, role);
  }

  @Public()
  @HttpCode(200)
  @Post('signin')
  async signIn(@Body() dto: SignInDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.users.findOne({ email: dto.email.toLowerCase() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.active) throw new UnauthorizedException('This account has been deactivated');

    user.lastLoginAt = new Date();
    await user.save();
    await this.issueCookie(res, String(user._id));
    return buildAuthUser(user, user.role ? await this.roles.findById(user.role).lean() : null);
  }

  @Public()
  @HttpCode(200)
  @Post('signout')
  signOut(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(config.cookieName, { path: '/' });
    return { ok: true };
  }

  @Public()
  @Get('me')
  me(@CurrentUser() user?: AuthUser) {
    return { user: user ?? null };
  }

  /** The signed-in user's own profile. Email and password changes need the current password. */
  @Patch('me')
  async updateMe(
    @CurrentUser() me: AuthUser,
    @Body() dto: UpdateProfileDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.users.findById(me.id).select('+passwordHash');
    if (!user) throw new UnauthorizedException('Please sign in');

    const email = dto.email?.trim().toLowerCase();
    const emailChanged = !!email && email !== user.email;
    if (emailChanged || dto.newPassword) {
      if (!dto.currentPassword || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
        throw new BadRequestException('Your current password is incorrect');
      }
    }
    if (emailChanged && (await this.users.exists({ email, _id: { $ne: user._id } }))) {
      throw new ConflictException('Another account already uses this email');
    }

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (emailChanged) user.email = email!;
    if (dto.newPassword) {
      user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
      user.passwordChangedAt = new Date();
    }
    await user.save();
    // Other sessions are now invalid; keep this one signed in with a fresh token.
    if (dto.newPassword) await this.issueCookie(res, String(user._id));
    return buildAuthUser(user, user.role ? await this.roles.findById(user.role).lean() : null);
  }

  private async issueCookie(res: Response, userId: string) {
    const token = await this.jwt.signAsync({ sub: userId });
    res.cookie(config.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      path: '/',
      maxAge: config.jwtExpiresInSeconds * 1000,
    });
  }
}
