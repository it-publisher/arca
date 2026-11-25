import { Transform } from 'node:stream';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    // Remote images are blocked on purpose: they would leak readers' IPs to third parties.
    "img-src 'self' blob: data:",
    "connect-src 'self'",
    "font-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
};

export function setSecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
}

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function sendError(res, error) {
  if (res.headersSent) {
    res.destroy(error);
    return;
  }
  if (error instanceof HttpError) {
    sendJson(res, error.status, { error: error.message });
    return;
  }
  console.error('Unhandled error:', error);
  sendJson(res, 500, { error: 'Internal server error' });
}

export async function readJson(req, maxBytes) {
  if (!req.headers['content-type']?.startsWith('application/json')) {
    throw new HttpError(415, 'Expected application/json');
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new HttpError(413, 'Request body is too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

/** Guards against clients that lie about Content-Length. */
export function limitSize(maxBytes) {
  let total = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;
      if (total > maxBytes) return callback(new HttpError(413, 'File is too large'));
      callback(null, chunk);
    },
  });
}
