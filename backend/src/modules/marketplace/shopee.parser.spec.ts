import { ShopeeParser } from './shopee.parser';

describe('ShopeeParser id extraction', () => {
  const parser = new ShopeeParser();
  // Test private method via cast — acceptable for unit-level URL parsing logic.
  const extract = (raw: string) =>
    (parser as unknown as { extractIds: (u: URL) => unknown }).extractIds(new URL(raw));

  it('parses canonical slug', () => {
    expect(extract('https://shopee.co.th/Apple-iPhone-15-i.123.456789'))
      .toEqual({ shopId: '123', itemId: '456789' });
  });

  it('parses canonical slug with trailing query params', () => {
    expect(extract('https://shopee.co.th/Foo-i.10.20?sp_atk=abc&xptdk=def'))
      .toEqual({ shopId: '10', itemId: '20' });
  });

  it('parses short /product/ form', () => {
    expect(extract('https://shopee.co.th/product/999/111'))
      .toEqual({ shopId: '999', itemId: '111' });
  });

  it('returns null for unrecognized url', () => {
    expect(extract('https://shopee.co.th/mall/some-page')).toBeNull();
  });
});

describe('ShopeeParser price conversion', () => {
  const parser = new ShopeeParser();
  const toSatang = (p: number | undefined) =>
    (parser as unknown as { shopeePriceToSatang: (n: number | undefined) => number | null })
      .shopeePriceToSatang(p);

  it('converts shopee price 19950000 (199.50 THB) to 19950 satang', () => {
    expect(toSatang(19950000)).toBe(19950);
  });

  it('converts shopee price 100000 (1.00 THB) to 100 satang', () => {
    expect(toSatang(100000)).toBe(100);
  });

  it('returns null for missing price', () => {
    expect(toSatang(undefined)).toBeNull();
  });

  it('returns null for negative price', () => {
    expect(toSatang(-1)).toBeNull();
  });
});
