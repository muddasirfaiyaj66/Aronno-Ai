import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ShopController } from './controllers/shop.controller';
import { ProductController } from './controllers/product.controller';
import { CartController } from './controllers/cart.controller';
import { OrderController } from './controllers/order.controller';
import { ShopService } from './services/shop.service';
import { ProductService } from './services/product.service';
import { CartService } from './services/cart.service';
import { OrderService } from './services/order.service';
import { ReviewService } from './services/review.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, StorageModule, JwtModule.register({}), NotificationsModule],
  controllers: [
    ShopController,
    ProductController,
    CartController,
    OrderController,
  ],
  providers: [
    ShopService,
    ProductService,
    CartService,
    OrderService,
    ReviewService,
  ],
  exports: [
    ShopService,
    ProductService,
    CartService,
    OrderService,
    ReviewService,
  ],
})
export class MarketplaceModule {}
