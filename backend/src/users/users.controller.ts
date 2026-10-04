import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { IsBoolean, IsEmail, IsMongoId, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Model } from 'mongoose';
import { CurrentUser, Permissions } from '../common/decorators.js';
import type { AuthUser } from '../common/decorators.js';
import { P } from '../common/permissions.js';
import { escapeRegex, paged, paging, ParseObjectIdPipe } from '../common/utils.js';
import { Role, User } from '../schemas/index.js';

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  /** Sets a new password and signs the user out of existing sessions. */
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) password?: string;
  /** null removes the role (user keeps an account with no permissions). */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsMongoId() roleId?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Controller('admin/users')
export class UsersController {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Role.name) private readonly roles: Model<Role>,
  ) {}

  @Get()
  @Permissions(P.USERS_MANAGE)
  async list(@Query('q') q?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const p = paging(page, limit);
    const filter = q ? { $or: ['name', 'email'].map((f) => ({ [f]: { $regex: escapeRegex(q), $options: 'i' } })) } : {};
    const [items, total] = await Promise.all([
      this.users.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('role', 'name deletedAt').lean(),
      this.users.countDocuments(filter),
    ]);
    return paged(items, total, p.page, p.limit);
  }

  /** Live roles to choose from when assigning (does not require roles.manage). */
  @Get('roles')
  @Permissions(P.USERS_MANAGE)
  roleOptions() {
    return this.roles.find({ deletedAt: null }).select('name isDefault isSystem').sort({ name: 1 }).lean();
  }

  /** Lightweight lookup used when allocating brands to users. */
  @Get('lookup')
  @Permissions(P.BRANDS_ASSIGN)
  lookup(@Query('q') q = '') {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    return this.users.find({ active: true, $or: [{ name: rx }, { email: rx }] }).select('name email').limit(20).lean();
  }

  @Patch(':id')
  @Permissions(P.USERS_MANAGE)
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() me: AuthUser,
  ) {
    if (id === me.id && (dto.active === false || dto.roleId !== undefined)) {
      throw new BadRequestException('You cannot change your own role or deactivate yourself');
    }
    if (id === me.id && dto.password) {
      throw new BadRequestException('Change your own password from your profile page');
    }
    if (dto.roleId && !(await this.roles.exists({ _id: dto.roleId, deletedAt: null }))) {
      throw new BadRequestException('Role not found');
    }
    const email = dto.email?.trim().toLowerCase();
    if (email && (await this.users.exists({ email, _id: { $ne: id } }))) {
      throw new ConflictException('Another account already uses this email');
    }

    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (email) update.email = email;
    if (dto.password) {
      update.passwordHash = await bcrypt.hash(dto.password, 12);
      update.passwordChangedAt = new Date();
    }
    if (dto.roleId !== undefined) update.role = dto.roleId;
    if (dto.active !== undefined) update.active = dto.active;

    const user = await this.users.findByIdAndUpdate(id, update, { returnDocument: 'after' }).populate('role', 'name deletedAt').lean();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
