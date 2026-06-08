import type { Params } from 'nestjs-pino';
import { randomUUID } from 'crypto';

/**
 * Pino config used by nestjs-pino's `LoggerModule.forRoot`.
 *
 * Decisions:
 *   - Pretty output in dev, JSON in prod (Datadog/Loki ingest JSON).
 *   - Redact obvious secrets so they never hit logs. ADD KEYS HERE WHENEVER
 *     YOU INTRODUCE A NEW SENSITIVE FIELD — once it's logged once, it lives
 *     forever in someone's archive.
 *   - genReqId attaches a stable per-request UUID; honor an inbound
 *     `x-request-id` so cross-service traces stitch together.
 */
export const loggerConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    transport: process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.refresh_token',
        'res.headers["set-cookie"]',
        '*.password',
        '*.password_hash',
        '*.refresh_token',
        '*.token',
      ],
      remove: true,
    },
    genReqId: (req) => {
      const incoming = (req.headers['x-request-id'] as string | undefined)?.trim();
      return incoming && incoming.length <= 64 ? incoming : randomUUID();
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url, ip: req.ip }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  },
};
