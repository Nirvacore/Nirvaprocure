import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { OpenAiProvider } from '../ai/openai.provider';

export interface OcrLineItem {
  description: string;
  quantity:    number;
  unit_price_minor: number;
  line_total_minor: number;
}

export interface OcrInvoiceResult {
  supplier_name?: string;
  invoice_number?: string;
  date?: string;            // ISO date if extracted
  currency: string;         // e.g. THB
  subtotal_minor?: number;
  tax_minor?: number;
  total_minor: number;
  items: OcrLineItem[];
  warnings: string[];       // low-confidence fields, missing data, etc.
}

/**
 * Invoice OCR via OpenAI vision. Production should:
 *   - support multi-page PDFs (split → call per page → merge totals)
 *   - cache by sha256(image) to avoid re-OCRing identical scans
 *   - persist the raw response to `ai_runs` for cost attribution + audit
 */
@Injectable()
export class InvoiceOcrService {
  private readonly logger = new Logger(InvoiceOcrService.name);

  constructor(private readonly openai: OpenAiProvider) {}

  async extract(imageDataUrl: string, currency = 'THB', meta?: { orgId?: string; userId?: string }): Promise<OcrInvoiceResult> {
    const system = [
      `You are NirvaFinance's invoice OCR agent. Extract structured data from`,
      `the attached invoice image. Output STRICT JSON matching this schema:`,
      ``,
      `{`,
      `  "supplier_name": string | null,`,
      `  "invoice_number": string | null,`,
      `  "date": string | null,           // ISO YYYY-MM-DD`,
      `  "currency": string,              // e.g. "THB"`,
      `  "subtotal_minor": number | null, // smallest unit (satang)`,
      `  "tax_minor": number | null,`,
      `  "total_minor": number,`,
      `  "items": [`,
      `    { "description": string, "quantity": number,`,
      `      "unit_price_minor": number, "line_total_minor": number }`,
      `  ],`,
      `  "warnings": string[]             // anything ambiguous`,
      `}`,
      ``,
      `All monetary amounts are integers in the smallest currency unit.`,
      `If you cannot read a field, set it to null AND add a warning.`,
    ].join('\n');

    const userParts: Array<unknown> = [
      { type: 'text',      text: `Currency: ${currency}\nExtract the invoice now.` },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ];

    const t0 = Date.now();
    const { result, usage } = await callVision(system, userParts);
    await this.openai.recordRun({
      orgId: meta?.orgId, userId: meta?.userId,
      template: 'invoice_ocr_v1', model: 'gpt-4o-mini',
      promptTokens:     usage?.prompt_tokens     ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - t0,
    });
    if (!isValidOcr(result)) {
      this.logger.error(`Invoice OCR returned malformed payload: ${JSON.stringify(result).slice(0, 200)}`);
      throw new BadGatewayException('OCR response missing required fields');
    }
    return result;
  }
}

async function callVision(
  system: string,
  userParts: Array<unknown>,
): Promise<{ result: unknown; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      result: {
        supplier_name: 'STUB Supplier',
        invoice_number: 'INV-STUB-0001',
        date: new Date().toISOString().slice(0, 10),
        currency: 'THB',
        subtotal_minor: 100000,
        tax_minor: 7000,
        total_minor: 107000,
        items: [
          { description: '[STUB] Sample line item', quantity: 1, unit_price_minor: 100000, line_total_minor: 100000 },
        ],
        warnings: ['STUB response — set OPENAI_API_KEY to enable real OCR'],
      },
    };
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: userParts },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI vision ${res.status}: ${await res.text()}`);
  const json = await res.json() as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  return {
    result: JSON.parse(json.choices[0].message.content),
    usage:  json.usage,
  };
}

function isValidOcr(x: unknown): x is OcrInvoiceResult {
  if (!x || typeof x !== 'object') return false;
  const r = x as Partial<OcrInvoiceResult>;
  return (
    typeof r.currency === 'string' &&
    typeof r.total_minor === 'number' &&
    Array.isArray(r.items) &&
    Array.isArray(r.warnings)
  );
}
