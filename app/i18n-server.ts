import { cookies } from 'next/headers';

export type ServerLanguage = 'en' | 'th';

export function getServerLanguage(): ServerLanguage {
  const value = cookies().get('songdee-language')?.value;
  return value === 'en' ? 'en' : 'th';
}
