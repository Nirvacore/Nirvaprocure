export interface ParsedLineItem {
  source: 'shopee' | 'lazada' | 'alibaba' | 'makro';
  source_url: string;
  description: string;
  unit_price_minor: number;
  currency: string;
  supplier: {
    name: string;
    external_ref?: string;
  };
  source_metadata?: Record<string, unknown>;
}
