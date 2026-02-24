'use client';

import { useCopy } from './LanguageProvider';

export default function T({ k }: { k: Parameters<ReturnType<typeof useCopy>>[0] }) {
  const t = useCopy();
  return <>{t(k)}</>;
}
