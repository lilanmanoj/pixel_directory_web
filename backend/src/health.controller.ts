import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { Public } from './common/decorators.js';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get()
  check() {
    return { ok: this.connection.readyState === 1, db: this.connection.readyState === 1 ? 'up' : 'down' };
  }
}
