import { NextRequest, NextResponse } from 'next/server';

// The Node listener is loopback-only. Keep the permitted public and local
// origins explicit so caller-supplied forwarding headers cannot change them.
export function normalizeAuthRequest(request: NextRequest): NextRequest | NextResponse {
  if (process.env.SONGDEE_WINDOWS_HOSTING !== '1') return request;
  const host = request.headers.get('host') || '';
  const authority = /^([^:\s/?#@\\]+)(?::(\d+))?$/.exec(host);
  if (!authority) return new NextResponse(null, { status: 400 });
  let incoming: URL;
  try {
    incoming = new URL(`http://${host}`);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (incoming.username || incoming.password || incoming.pathname !== '/' || incoming.search || incoming.hash) {
    return new NextResponse(null, { status: 400 });
  }
  const hostname = incoming.hostname.toLowerCase().replace(/\.$/, '');
  // URL removes an explicit :80 when parsing with http, so validate the
  // supplied port before relying on its normalized representation.
  const port = authority[2];
  const publicHost = hostname === 'dashboard.songdeegps.com';
  const localHost = ['localhost', '127.0.0.1', '172.24.8.104'].includes(hostname);
  if ((!publicHost && !localHost) || (publicHost && port && port !== '443') ||
      (localHost && port && port !== '8080')) {
    return new NextResponse(null, { status: 404 });
  }
  const url = new URL(request.url);
  url.protocol = publicHost ? 'https:' : 'http:';
  url.host = publicHost ? 'dashboard.songdeegps.com' : incoming.host.toLowerCase();
  url.port = publicHost ? '' : incoming.port;
  if (hostname === '127.0.0.1') {
    // NextRequest normalizes loopback IPs to localhost. Use one local origin
    // for the browser, auth callbacks, and host-scoped session cookies.
    url.hostname = 'localhost';
    return NextResponse.redirect(url, 307);
  }
  const headers = new Headers(request.headers);
  headers.set('host', url.host);
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', publicHost ? 'https' : 'http');
  return new NextRequest(url, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    signal: request.signal,
  });
}
