import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Prisma default interactive tx timeout is 5s — too low for multi-write MongoDB flows. */
const TX_TIMEOUT_MS = 30_000;
const TX_MAX_WAIT_MS = 10_000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    await this.dropBrokenGoogleSubUnique();
  }

  /**
   * MongoDB unique indexes treat `null` as a value, so only one user without
   * Google login could exist. Drop the old unique index; lookups use @@index.
   */
  private async dropBrokenGoogleSubUnique() {
    try {
      await this.$runCommandRaw({
        dropIndexes: 'User',
        index: 'User_googleSub_key',
      });
    } catch {
      // collection or index may not exist yet
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async withTransaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    try {
      return await this.$transaction(
        (tx) => fn(tx as unknown as PrismaClient),
        { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
      );
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
