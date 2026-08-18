import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async withTransaction<T>(
    fn: (tx: PrismaClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.$transaction((tx) => fn(tx as unknown as PrismaClient));
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (
        message.includes('replica set') ||
        message.includes('Transactions are not supported')
      ) {
        return fn(this);
      }
      throw error;
    }
  }
}
