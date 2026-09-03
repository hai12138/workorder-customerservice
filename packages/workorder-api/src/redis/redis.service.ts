import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(@Optional() config?: ConfigService) {
    const url =
      config?.get<string>('REDIS_URL') ??
      process.env.REDIS_URL ??
      'redis://localhost:6379';
    this.client = new Redis(url);
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
