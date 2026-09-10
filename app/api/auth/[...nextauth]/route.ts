import { GET as authGet, POST as authPost } from 'app/auth';
import { NextRequest } from 'next/server';
import { normalizeAuthRequest } from 'app/lib/request-origin';

export function GET(request: NextRequest) {
  const normalized = normalizeAuthRequest(request);
  return normalized instanceof NextRequest ? authGet(normalized) : normalized;
}

export function POST(request: NextRequest) {
  const normalized = normalizeAuthRequest(request);
  return normalized instanceof NextRequest ? authPost(normalized) : normalized;
}
