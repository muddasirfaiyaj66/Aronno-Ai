import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [MarketController],
})
export class MarketModule {}
