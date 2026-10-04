import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ArrayUnique, IsArray, IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Model } from 'mongoose';
import { Permissions } from '../common/decorators.js';
import { P, WILDCARD } from '../common/permissions.js';
import { escapeRegex, ParseObjectIdPipe } from '../common/utils.js';
import { Permission, Role, User } from '../schemas/index.js';

class RoleDto {
  @IsString() @MinLength(2) @MaxLength(60) name: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) permissions?: string[];
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

class UpdateRoleDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) name?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) permissions?: string[];
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

class PermissionDto {
  @IsString() @Matches(/^[a-z0-9][a-z0-9.\-_:]{1,79}$/, { message: 'key: lowercase letters, digits and . - _ :' })
  key: string;
  @IsOptional() @IsString() @MaxLength(40) group?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
}

class UpdatePermissionDto {
  @IsOptional() @IsString() @MaxLength(40) group?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
}

@Controller('admin/roles')
@Permissions(P.ROLES_MANAGE)
export class RolesController {
  constructor(
    @InjectModel(Role.name) private readonly roles: Model<Role>,
    @InjectModel(Permission.name) private readonly permissions: Model<Permission>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  @Get()
  async list(@Query('includeDeleted') includeDeleted?: string) {
    const roles = await this.roles
      .find(includeDeleted === 'true' ? {} : { deletedAt: null })
      .sort({ isSystem: -1, name: 1 })
      .lean();
    const counts = await this.users.aggregate<{ _id: unknown; n: number }>([
      { $group: { _id: '$role', n: { $sum: 1 } } },
    ]);
    const byRole = new Map(counts.map((c) => [String(c._id), c.n]));
    return roles.map((r) => ({ ...r, userCount: byRole.get(String(r._id)) ?? 0 }));
  }

  @Post()
  async create(@Body() dto: RoleDto) {
    await this.assertNameFree(dto.name);
    const permissions = await this.validPermissions(dto.permissions ?? []);
    const role = await this.roles.create({ ...dto, name: dto.name.trim(), permissions, isDefault: false });
    if (dto.isDefault) await this.makeDefault(String(role._id));
    return this.roles.findById(role._id).lean();
  }

  @Patch(':id')
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateRoleDto) {
    const role = await this.roles.findOne({ _id: id, deletedAt: null });
    if (!role) throw new NotFoundException('Role not found');
    if (dto.name && dto.name.trim() !== role.name) await this.assertNameFree(dto.name, id);

    if (dto.name) role.name = dto.name.trim();
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.permissions) {
      if (role.isSystem) throw new BadRequestException('Permissions of a system role cannot be changed');
      role.permissions = await this.validPermissions(dto.permissions);
    }
    await role.save();
    if (dto.isDefault) await this.makeDefault(id);
    return this.roles.findById(id).lean();
  }

  /** Soft delete: users holding the role lose its permissions until it is restored. */
  @Delete(':id')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    const role = await this.roles.findOne({ _id: id, deletedAt: null });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');
    if (role.isDefault) throw new BadRequestException('Make another role the sign-up default first');
    role.deletedAt = new Date();
    await role.save();
    return { ok: true };
  }

  @Post(':id/restore')
  async restore(@Param('id', ParseObjectIdPipe) id: string) {
    const role = await this.roles.findById(id);
    if (!role) throw new NotFoundException('Role not found');
    await this.assertNameFree(role.name, id);
    role.deletedAt = null;
    await role.save();
    return role.toObject();
  }

  private async makeDefault(id: string) {
    await this.roles.updateMany({ _id: { $ne: id } }, { isDefault: false });
    await this.roles.updateOne({ _id: id }, { isDefault: true });
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const clash = await this.roles.exists({
      name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' },
      deletedAt: null,
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    });
    if (clash) throw new ConflictException('A role with this name already exists');
  }

  private async validPermissions(keys: string[]) {
    if (keys.includes(WILDCARD)) throw new BadRequestException('The wildcard permission is reserved for the admin role');
    const known = await this.permissions.find({ key: { $in: keys } }).distinct('key');
    const unknown = keys.filter((k) => !known.includes(k));
    if (unknown.length) throw new BadRequestException(`Unknown permissions: ${unknown.join(', ')}`);
    return keys;
  }
}

@Controller('admin/permissions')
@Permissions(P.ROLES_MANAGE)
export class PermissionsController {
  constructor(
    @InjectModel(Permission.name) private readonly permissions: Model<Permission>,
    @InjectModel(Role.name) private readonly roles: Model<Role>,
  ) {}

  @Get()
  list() {
    return this.permissions.find().sort({ group: 1, key: 1 }).lean();
  }

  @Post()
  async create(@Body() dto: PermissionDto) {
    if (await this.permissions.exists({ key: dto.key })) throw new ConflictException('Permission key already exists');
    return (await this.permissions.create({ ...dto, isSystem: false })).toObject();
  }

  @Patch(':id')
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdatePermissionDto) {
    const perm = await this.permissions.findByIdAndUpdate(id, dto, { returnDocument: 'after' }).lean();
    if (!perm) throw new NotFoundException('Permission not found');
    return perm;
  }

  @Delete(':id')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    const perm = await this.permissions.findById(id);
    if (!perm) throw new NotFoundException('Permission not found');
    if (perm.isSystem) throw new BadRequestException('Built-in permissions cannot be deleted');
    await this.roles.updateMany({}, { $pull: { permissions: perm.key } });
    await perm.deleteOne();
    return { ok: true };
  }
}
