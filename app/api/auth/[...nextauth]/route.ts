import { GET as authGet, POST as authPost } from 'app/auth';
import type { NextRequest } from 'next/server';
import { normalizeAuthRequest } from 'app/lib/request-origin';

export function GET(request: NextRequest) {
  const normalized = normalizeAuthRequest(request);
  return 'response' in normalized ? normalized.response : authGet(normalized.request);
}

export function POST(request: NextRequest) {
  const normalized = normalizeAuthRequest(request);
  return 'response' in normalized ? normalized.response : authPost(normalized.request);
}
