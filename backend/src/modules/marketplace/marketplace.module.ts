import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';
import { ShopeeParser } from './shopee.parser';
import { LazadaParser } from './lazada.parser';
import { MakroParser } from './makro.parser';
import { AlibabaParser } from './alibaba.parser';

@Module({
  controllers: [AffiliateController],
  providers: [MarketplaceService, AffiliateService, ShopeeParser, LazadaParser, MakroParser, AlibabaParser],
  exports: [MarketplaceService, AffiliateService],
})
export class MarketplaceModule {}
