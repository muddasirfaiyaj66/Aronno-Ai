import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ShopController } from './controllers/shop.controller';
import { ProductController } from './controllers/product.controller';
import { CartController } from './controllers/cart.controller';
import { OrderController } from './controllers/order.controller';
import { SslCommerzController } from './controllers/sslcommerz.controller';
import { WalletController } from './controllers/wallet.controller';
import { ShopService } from './services/shop.service';
import { ProductService } from './services/product.service';
import { CartService } from './services/cart.service';
import { OrderService } from './services/order.service';
import { ReviewService } from './services/review.service';
import { ProductAvailabilityService } from './services/product-availability.service';
import { SslCommerzService } from './services/sslcommerz.service';
import { PaymentService } from './services/payment.service';
import { DeliverySettingsService } from './services/delivery-settings.service';
import { WalletService } from './services/wallet.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, StorageModule, JwtModule.register({}), NotificationsModule],
  controllers: [
    ShopController,
    ProductController,
    CartController,
    OrderController,
    SslCommerzController,
    WalletController,
  ],
  providers: [
    ShopService,
    ProductService,
    CartService,
    OrderService,
    ReviewService,
    ProductAvailabilityService,
    SslCommerzService,
    PaymentService,
    DeliverySettingsService,
    WalletService,
  ],
  exports: [
    ShopService,
    ProductService,
    CartService,
    OrderService,
    ReviewService,
    DeliverySettingsService,
    WalletService,
  ],
})
export class MarketplaceModule {}
