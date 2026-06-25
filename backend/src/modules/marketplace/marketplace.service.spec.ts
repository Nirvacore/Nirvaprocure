import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { ShopeeParser } from './shopee.parser';
import { LazadaParser } from './lazada.parser';
import { MakroParser } from './makro.parser';
import { AlibabaParser } from './alibaba.parser';
import type { ParsedLineItem } from './types';

const shopeeParsed: ParsedLineItem = {
  source: 'shopee',
  source_url: 'https://shopee.co.th/-i.123.456',
  description: 'iPhone 15 Pro Max',
  unit_price_minor: 4499000,
  currency: 'THB',
  supplier: { name: 'Apple Store TH', external_ref: '123' },
};

const lazadaParsed: ParsedLineItem = {
  source: 'lazada',
  source_url: 'https://www.lazada.co.th/-i200-s300.html',
  description: 'Samsung Galaxy S24',
  unit_price_minor: 3299000,
  currency: 'THB',
  supplier: { name: 'Samsung Official', external_ref: '300' },
};

const makroParsed: ParsedLineItem = {
  source: 'makro',
  source_url: 'https://www.makro.pro/th/product/999',
  description: 'Office Paper A4 80gsm',
  unit_price_minor: 14900,
  currency: 'THB',
  supplier: { name: 'Makro', external_ref: '999' },
};

const alibabaParsed: ParsedLineItem = {
  source: 'alibaba',
  source_url: 'https://www.alibaba.com/product-detail/777.html',
  description: '(Alibaba — please fill in)',
  unit_price_minor: 0,
  currency: 'USD',
  supplier: { name: 'Alibaba supplier', external_ref: '777' },
};

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let shopee: jest.Mocked<ShopeeParser>;
  let lazada: jest.Mocked<LazadaParser>;
  let makro: jest.Mocked<MakroParser>;
  let alibaba: jest.Mocked<AlibabaParser>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        {
          provide: ShopeeParser,
          useValue: { parse: jest.fn() },
        },
        {
          provide: LazadaParser,
          useValue: { parse: jest.fn() },
        },
        {
          provide: MakroParser,
          useValue: { parse: jest.fn() },
        },
        {
          provide: AlibabaParser,
          useValue: { parse: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(MarketplaceService);
    shopee = module.get(ShopeeParser);
    lazada = module.get(LazadaParser);
    makro = module.get(MakroParser);
    alibaba = module.get(AlibabaParser);
  });

  // ---------------------------------------------------------------------------
  // Invalid / unsupported URLs
  // ---------------------------------------------------------------------------

  describe('invalid URLs', () => {
    it('should throw BadRequestException for a non-URL string', async () => {
      await expect(service.parse('not-a-url')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for an empty string', async () => {
      await expect(service.parse('')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for a string with spaces', async () => {
      await expect(service.parse('hello world')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unsupported marketplaces', () => {
    it('should throw UnprocessableEntityException for an unknown host', async () => {
      await expect(
        service.parse('https://www.amazon.com/dp/B08N5WRWNW'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException for google.com', async () => {
      await expect(
        service.parse('https://www.google.com/search?q=test'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should include the hostname in the error message', async () => {
      await expect(
        service.parse('https://www.amazon.com/dp/B08N5WRWNW'),
      ).rejects.toThrow(/www\.amazon\.com/);
    });
  });

  // ---------------------------------------------------------------------------
  // Shopee routing
  // ---------------------------------------------------------------------------

  describe('shopee routing', () => {
    it('should route shopee.co.th to ShopeeParser', async () => {
      shopee.parse.mockResolvedValue(shopeeParsed);
      const result = await service.parse('https://shopee.co.th/Apple-iPhone-15-i.123.456');
      expect(shopee.parse).toHaveBeenCalledTimes(1);
      expect(result).toEqual(shopeeParsed);
    });

    it('should route shopee.com to ShopeeParser', async () => {
      shopee.parse.mockResolvedValue(shopeeParsed);
      const result = await service.parse('https://shopee.com/product/123/456');
      expect(shopee.parse).toHaveBeenCalledTimes(1);
      expect(result).toEqual(shopeeParsed);
    });

    it('should route subdomain.shopee.co.th to ShopeeParser', async () => {
      shopee.parse.mockResolvedValue(shopeeParsed);
      const result = await service.parse('https://mall.shopee.co.th/product/1/2');
      expect(shopee.parse).toHaveBeenCalledTimes(1);
      expect(result).toEqual(shopeeParsed);
    });

    it('should throw UnprocessableEntityException when ShopeeParser returns null', async () => {
      shopee.parse.mockResolvedValue(null);
      await expect(
        service.parse('https://shopee.co.th/invalid-page'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should pass the parsed URL object to ShopeeParser', async () => {
      shopee.parse.mockResolvedValue(shopeeParsed);
      await service.parse('https://shopee.co.th/Apple-iPhone-15-i.123.456?tracking=abc');
      const arg = shopee.parse.mock.calls[0][0];
      expect(arg).toBeInstanceOf(URL);
      expect(arg.hostname).toBe('shopee.co.th');
    });
  });

  // ---------------------------------------------------------------------------
  // Lazada routing
  // ---------------------------------------------------------------------------

  describe('lazada routing', () => {
    it('should route lazada.co.th to LazadaParser', async () => {
      lazada.parse.mockResolvedValue(lazadaParsed);
      const result = await service.parse(
        'https://www.lazada.co.th/products/samsung-galaxy-i200-s300.html',
      );
      expect(lazada.parse).toHaveBeenCalledTimes(1);
      expect(result).toEqual(lazadaParsed);
    });

    it('should route lazada.com to LazadaParser', async () => {
      lazada.parse.mockResolvedValue(lazadaParsed);
      const result = await service.parse(
        'https://www.lazada.com/products/some-item-i100-s200.html',
      );
      expect(lazada.parse).toHaveBeenCalledTimes(1);
      expect(result).toEqual(lazadaParsed);
    });

    it('should throw UnprocessableEntityException when LazadaParser returns null', async () => {
      lazada.parse.mockResolvedValue(null);
      await expect(
        service.parse('https://www.lazada.co.th/invalid-page'),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ---------------------------------------------------------------------------
  // Makro routing
  // ---------------------------------------------------------------------------

  describe('makro routing', () => {
    it('should route makro.pro to MakroParser', async () => {
      makro.parse.mockResolvedValue(makroParsed);
      const result = await service.parse(
        'https://www.makro.pro/th/p/office-paper/999',
      );
      expect(makro.parse).toHaveBeenCalledTimes(1);
      expect(result).toEqual(makroParsed);
    });

    it('should route subdomain.makro.pro to MakroParser', async () => {
      makro.parse.mockResolvedValue(makroParsed);
      const result = await service.parse(
        'https://shop.makro.pro/th/product/999',
      );
      expect(makro.parse).toHaveBeenCalledTimes(1);
      expect(result).toEqual(makroParsed);
    });

    it('should throw UnprocessableEntityException when MakroParser returns null', async () => {
      makro.parse.mockResolvedValue(null);
      await expect(
        service.parse('https://www.makro.pro/th/invalid'),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ---------------------------------------------------------------------------
  // Alibaba routing
  // ---------------------------------------------------------------------------

  describe('alibaba routing', () => {
    it('should route alibaba.com to AlibabaParser', async () => {
      alibaba.parse.mockResolvedValue(alibabaParsed);
      const result = await service.parse(
        'https://www.alibaba.com/product-detail/widget_777.html',
      );
      expect(alibaba.parse).toHaveBeenCalledTimes(1);
      expect(result).toEqual(alibabaParsed);
    });

    it('should route subdomain.alibaba.com to AlibabaParser', async () => {
      alibaba.parse.mockResolvedValue(alibabaParsed);
      const result = await service.parse(
        'https://thai.alibaba.com/product-detail/widget_777.html',
      );
      expect(alibaba.parse).toHaveBeenCalledTimes(1);
      expect(result).toEqual(alibabaParsed);
    });

    it('should throw UnprocessableEntityException when AlibabaParser returns null', async () => {
      alibaba.parse.mockResolvedValue(null);
      await expect(
        service.parse('https://www.alibaba.com/some-page'),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ---------------------------------------------------------------------------
  // Isolation: only the matched parser is called
  // ---------------------------------------------------------------------------

  describe('parser isolation', () => {
    it('should not call other parsers when routing to Shopee', async () => {
      shopee.parse.mockResolvedValue(shopeeParsed);
      await service.parse('https://shopee.co.th/test-i.1.2');
      expect(lazada.parse).not.toHaveBeenCalled();
      expect(makro.parse).not.toHaveBeenCalled();
      expect(alibaba.parse).not.toHaveBeenCalled();
    });

    it('should not call other parsers when routing to Lazada', async () => {
      lazada.parse.mockResolvedValue(lazadaParsed);
      await service.parse('https://www.lazada.co.th/products/x-i1-s2.html');
      expect(shopee.parse).not.toHaveBeenCalled();
      expect(makro.parse).not.toHaveBeenCalled();
      expect(alibaba.parse).not.toHaveBeenCalled();
    });

    it('should not call other parsers when routing to Makro', async () => {
      makro.parse.mockResolvedValue(makroParsed);
      await service.parse('https://www.makro.pro/th/p/slug/1');
      expect(shopee.parse).not.toHaveBeenCalled();
      expect(lazada.parse).not.toHaveBeenCalled();
      expect(alibaba.parse).not.toHaveBeenCalled();
    });

    it('should not call other parsers when routing to Alibaba', async () => {
      alibaba.parse.mockResolvedValue(alibabaParsed);
      await service.parse('https://www.alibaba.com/product-detail/x_1.html');
      expect(shopee.parse).not.toHaveBeenCalled();
      expect(lazada.parse).not.toHaveBeenCalled();
      expect(makro.parse).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Case insensitivity
  // ---------------------------------------------------------------------------

  describe('case insensitivity', () => {
    it('should handle uppercase hostnames', async () => {
      shopee.parse.mockResolvedValue(shopeeParsed);
      const result = await service.parse('https://SHOPEE.CO.TH/test-i.1.2');
      expect(result).toEqual(shopeeParsed);
    });

    it('should handle mixed-case hostnames', async () => {
      lazada.parse.mockResolvedValue(lazadaParsed);
      const result = await service.parse('https://WWW.Lazada.Co.Th/products/x-i1-s2.html');
      expect(result).toEqual(lazadaParsed);
    });
  });

  // ---------------------------------------------------------------------------
  // Return value shape
  // ---------------------------------------------------------------------------

  describe('return value', () => {
    it('should return the exact ParsedLineItem from the parser', async () => {
      const custom: ParsedLineItem = {
        source: 'shopee',
        source_url: 'https://shopee.co.th/-i.5.6',
        description: 'Custom item',
        unit_price_minor: 100,
        currency: 'THB',
        supplier: { name: 'Custom Shop' },
        source_metadata: { custom_field: 42 },
      };
      shopee.parse.mockResolvedValue(custom);
      const result = await service.parse('https://shopee.co.th/test-i.5.6');
      expect(result).toBe(custom); // same reference, not a copy
    });
  });
});
