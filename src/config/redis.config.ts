import { Injectable } from '@nestjs/common';
import { RedisModuleOptions, RedisOptionsFactory } from '@liaoliaots/nestjs-redis';

@Injectable()
export class RedisConfigService implements RedisOptionsFactory {
  async createRedisOptions(): Promise<RedisModuleOptions> {
    return {
      readyLog: true,
      commonOptions: {
        enableAutoPipelining: true,
      },
      config: [
        {
          namespace: process.env.REDIS_CONNECTION,
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT, 10),
          password: process.env.REDIS_PASSWORD || '',
          keyPrefix: process.env.REDIS_PREFIX || '',
        },
      ],
    };
  }
}
