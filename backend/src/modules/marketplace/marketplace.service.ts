import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ShopeeParser } from './shopee.parser';
import { LazadaParser } from './lazada.parser';
import { MakroParser } from './makro.parser';
import { AlibabaParser } from './alibaba.parser';
import type { ParsedLineItem } from './types';

/**
 * Dispatcher: routes a marketplace URL to the right parser based on
 * hostname. When we onboard a new marketplace, add a parser class and one
 * line below — the rest of the system already knows how to handle the
 * common `ParsedLineItem` shape.
 */
@Injectable()
export class MarketplaceService {
  constructor(
    private readonly shopee:  ShopeeParser,
    private readonly lazada:  LazadaParser,
    private readonly makro:   MakroParser,
    private readonly alibaba: AlibabaParser,
  ) {}

  async parse(url: string): Promise<ParsedLineItem> {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    const host = u.hostname.toLowerCase();

    let parsed: ParsedLineItem | null = null;
    if (host.endsWith('shopee.co.th') || host.endsWith('shopee.com')) {
      parsed = await this.shopee.parse(u);
    } else if (host.endsWith('lazada.co.th') || host.endsWith('lazada.com')) {
      parsed = await this.lazada.parse(u);
    } else if (host.endsWith('makro.pro')) {
      parsed = await this.makro.parse(u);
    } else if (host.endsWith('alibaba.com')) {
      parsed = await this.alibaba.parse(u);
    } else {
      throw new UnprocessableEntityException(`Unsupported marketplace: ${host}`);
    }

    if (!parsed) {
      throw new UnprocessableEntityException(`Could not parse ${host} URL`);
    }
    return parsed;
  }
}
