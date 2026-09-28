import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { StorageModule } from '../storage/storage.module';
import { HeatmapService } from './heatmap.service';

@Module({
  imports: [StorageModule],
  controllers: [MarketController],
  providers: [HeatmapService],
  exports: [HeatmapService],
})
export class MarketModule {}
