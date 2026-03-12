'use client';

import KpiCard from 'app/ui/KpiCard';
import SafetyScore from 'app/ui/SafetyScore';

export interface DriverSummaryProps {
  driverName: string;
  totalAlerts: number;
  mostCommonType: string;
  safetyScore: number;
  activeDays: number;
  lang?: 'en' | 'th';
}

export default function DriverSummaryCards({
  driverName,
  totalAlerts,
  mostCommonType,
  safetyScore,
  activeDays,
  lang = 'en',
}: DriverSummaryProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {lang === 'th' ? `สรุปคนขับ: ${driverName}` : `Driver summary: ${driverName}`}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={lang === 'th' ? 'การแจ้งเตือนทั้งหมด' : 'Total alerts'}
          value={totalAlerts}
        />
        <KpiCard
          label={lang === 'th' ? 'ประเภทที่พบมากที่สุด' : 'Most common type'}
          value={mostCommonType || '—'}
        />
        <KpiCard
          label={lang === 'th' ? 'คะแนนความปลอดภัย' : 'Safety score'}
          value=""
        >
          <div className="mt-2 flex justify-center">
            <SafetyScore score={safetyScore} size={80} />
          </div>
        </KpiCard>
        <KpiCard
          label={lang === 'th' ? 'วันที่ใช้งาน' : 'Active days'}
          value={activeDays}
          unit={lang === 'th' ? 'วัน' : 'days'}
        />
      </div>
    </div>
  );
}
