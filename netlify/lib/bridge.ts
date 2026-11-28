import { Buffer } from 'node:buffer';

type HeaderValue = string | string[] | undefined;
type LegacyRequest = {
  method?: string;
  headers?: Record<string, HeaderValue>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};
type LegacyResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  status(code: number): LegacyResponse;
  send(body: string | Buffer): LegacyResponse;
  end(body?: string | Buffer): LegacyResponse;
};
type LegacyHandler = (request: LegacyRequest, response: LegacyResponse) => Promise<unknown> | unknown;
type NetlifyEvent = {
  httpMethod?: string;
  headers?: Record<string, HeaderValue>;
  queryStringParameters?: Record<string, string | null> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
};

export function bridgeVercelHandler(handler: LegacyHandler) {
  return async (event: NetlifyEvent) => {
    const headers: Record<string, HeaderValue> = {};
    for (const [name, value] of Object.entries(event.headers || {})) {
      headers[name.toLowerCase()] = value;
    }

    let body: unknown = event.body ?? undefined;
    if (typeof body === 'string' && event.isBase64Encoded) {
      body = Buffer.from(body, 'base64').toString('utf8');
    }
    if (typeof body === 'string' && /application\/json/i.test(String(headers['content-type'] || ''))) {
      try { body = JSON.parse(body); } catch { /* Preserve invalid JSON for endpoint validation. */ }
    }

    const query: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(event.queryStringParameters || {})) {
      query[key] = value ?? undefined;
    }

    const request: LegacyRequest = {
      method: event.httpMethod || 'GET',
      headers,
      query,
      body,
    };
    const responseHeaders: Record<string, string> = {};
    let statusCode = 200;
    let responseBody: string | undefined;
    let isBase64Encoded = false;

    const response: LegacyResponse = {
      statusCode,
      setHeader(name, value) {
        responseHeaders[name.toLowerCase()] = value;
        return this;
      },
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      send(value) {
        if (Buffer.isBuffer(value)) {
          responseBody = value.toString('base64');
          isBase64Encoded = true;
        } else {
          responseBody = String(value);
        }
        return this;
      },
      end(value) {
        if (value !== undefined) {
          if (Buffer.isBuffer(value)) {
            responseBody = value.toString('base64');
            isBase64Encoded = true;
          } else {
            responseBody = String(value);
          }
        }
        return this;
      },
    };

    await handler(request, response);
    statusCode = response.statusCode || statusCode;
    return {
      statusCode,
      headers: responseHeaders,
      body: responseBody ?? '',
      isBase64Encoded,
    };
  };
}
