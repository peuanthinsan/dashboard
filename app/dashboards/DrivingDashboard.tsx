'use client'

import { useMemo, useState } from 'react'
import { type DashboardLang } from 'app/dashboard/i18n-copy'
import DashboardShell, { dashboardSectionClass } from './DashboardShell'
import LoadingState from './LoadingState'
import useGoogleSheet from './useGoogleSheet'
import { findValue, normalizeLabel, parseDate, toDisplayString } from './dashboardDataUtils'

type DashboardProps = {
  dashboardId: string
  dashboardName: string
  sheetId: string
  sheetGid: string
  dashboardNotes?: string | null
  organizationName?: string | null
  lang?: DashboardLang
}

type DrivingRow = {
  id: string
  driverName: string
  vehicleNo: string
  startTime: string
  endTime: string
  startLocation: string
  endLocation: string
  distance: number
  cntDrvDuration: number
  alertType: string
  fleet: string
  sortDate: Date | null
}

const toNumber = (value: unknown) => {
  if (value == null) return 0
  const numeric = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(numeric) ? numeric : 0
}

const formatNumber = (value: number, digits = 2) => value.toLocaleString('en-US', { maximumFractionDigits: digits })

export default function DrivingDashboard({
  dashboardId,
  dashboardName,
  sheetId,
  sheetGid,
  dashboardNotes,
  organizationName,
  lang = 'en',
}: DashboardProps) {
  const { rows, loading, error, lastUpdated } = useGoogleSheet({ sheetId, gid: sheetGid })
  const [driverFilter, setDriverFilter] = useState('All')
  const [alertTypeFilter, setAlertTypeFilter] = useState('All')

  const normalizedOrganizationName = useMemo(
    () => (organizationName ? normalizeLabel(organizationName) : null),
    [organizationName],
  )

  const drivingRows = useMemo<DrivingRow[]>(() => {
    return rows
      .map((row, index) => {
        const driverName = toDisplayString(findValue(row, ['Driver Name']))
        const vehicleNo = toDisplayString(findValue(row, ['Vehicle No', 'Vehicle No TH']))
        const startTime = toDisplayString(findValue(row, ['Start Time']))
        const endTime = toDisplayString(findValue(row, ['End Time']))
        const startLocation = toDisplayString(findValue(row, ['Start Location']))
        const endLocation = toDisplayString(findValue(row, ['End Location']))
        const distance = toNumber(findValue(row, ['Distance']))
        const cntDrvDuration = toNumber(findValue(row, ['Cnt Drv duration', 'Cnt Drv w 9hrs']))
        const alertType = toDisplayString(findValue(row, ['Alert Type']))
        const fleet = toDisplayString(findValue(row, ['Fleet']))
        const rawDate = findValue(row, ['DateTime', 'Start Time'])

        return {
          id: `${dashboardId}-${index}`,
          driverName,
          vehicleNo,
          startTime,
          endTime,
          startLocation,
          endLocation,
          distance,
          cntDrvDuration,
          alertType,
          fleet,
          sortDate: parseDate(rawDate),
        }
      })
      .filter((row) => row.cntDrvDuration > 0)
      .filter((row) => {
        if (!normalizedOrganizationName) return true
        return normalizeLabel(row.fleet) === normalizedOrganizationName
      })
  }, [dashboardId, normalizedOrganizationName, rows])

  const driverOptions = useMemo(() => {
    const options = new Set<string>()
    drivingRows.forEach((row) => {
      if (row.driverName !== '—') options.add(row.driverName)
    })
    return ['All', ...Array.from(options).sort((a, b) => a.localeCompare(b))]
  }, [drivingRows])

  const alertTypeOptions = useMemo(() => {
    const options = new Set<string>()
    drivingRows.forEach((row) => {
      if (row.alertType !== '—') options.add(row.alertType)
    })
    return ['All', ...Array.from(options).sort((a, b) => a.localeCompare(b))]
  }, [drivingRows])

  const filteredRows = useMemo(() => {
    return drivingRows
      .filter((row) => (driverFilter === 'All' ? true : row.driverName === driverFilter))
      .filter((row) => (alertTypeFilter === 'All' ? true : row.alertType === alertTypeFilter))
      .sort((a, b) => {
        if (b.cntDrvDuration !== a.cntDrvDuration) return b.cntDrvDuration - a.cntDrvDuration
        return (b.sortDate?.getTime() ?? 0) - (a.sortDate?.getTime() ?? 0)
      })
  }, [alertTypeFilter, driverFilter, drivingRows])

  const chartRows = filteredRows.slice(0, 20)
  const maxCntDrv = Math.max(1, ...chartRows.map((row) => row.cntDrvDuration))
  const maxDistance = Math.max(1, ...chartRows.map((row) => row.distance))

  return (
    <DashboardShell
      title={dashboardName}
      subtitle={lang === 'th' ? 'แดชบอร์ดการขับขี่' : 'Driving dashboard'}
      lang={lang}
      lastUpdated={lastUpdated}
      notes={dashboardNotes}
    >
      {loading ? (
        <LoadingState
          message={lang === 'th' ? 'กำลังโหลดข้อมูลการขับขี่…' : 'Loading driving analytics…'}
          fallbackDetail={lang === 'th' ? 'กำลังดึงข้อมูลล่าสุดจาก Google Sheet' : 'Fetching the latest Google Sheet records.'}
        />
      ) : null}

      {error ? (
        <section className={dashboardSectionClass}>
          <p className="font-medium text-rose-500">{lang === 'th' ? 'ไม่สามารถโหลดข้อมูลได้' : 'Unable to load data.'}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error}</p>
        </section>
      ) : null}

      {!loading && !error ? (
        <>
          <section className={dashboardSectionClass}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {lang === 'th' ? 'ชื่อคนขับ' : 'Driver name'}
                <select
                  value={driverFilter}
                  onChange={(event) => setDriverFilter(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {driverOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {lang === 'th' ? 'ประเภทการแจ้งเตือน' : 'Alert type'}
                <select
                  value={alertTypeFilter}
                  onChange={(event) => setAlertTypeFilter(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {alertTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className={dashboardSectionClass}>
            <h2 className="text-lg font-semibold">{lang === 'th' ? 'Cnt Drv duration และ Distance' : 'Cnt Drv duration and distance'}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {lang === 'th'
                ? 'แสดงข้อมูล 20 รายการที่มี Cnt Drv duration สูงสุด'
                : 'Showing up to 20 rows with the highest Cnt Drv duration.'}
            </p>
            <div className="mt-6 overflow-x-auto">
              <div className="flex min-w-[900px] items-end gap-3 pb-2">
                {chartRows.map((row) => (
                  <div key={`${row.id}-chart`} className="flex w-10 flex-col items-center gap-2">
                    <div className="flex h-64 items-end gap-1">
                      <div className="w-4 rounded-t bg-cyan-600" style={{ height: `${(row.cntDrvDuration / maxCntDrv) * 100}%` }} />
                      <div className="w-4 rounded-t bg-fuchsia-500" style={{ height: `${(row.distance / maxDistance) * 100}%` }} />
                    </div>
                    <div className="text-center text-[10px] text-slate-500 [writing-mode:vertical-rl] rotate-180">
                      {row.driverName}
                    </div>
                    <div className="text-center text-[10px] text-slate-600 dark:text-slate-300">
                      {formatNumber(row.cntDrvDuration)} / {formatNumber(row.distance, 0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={dashboardSectionClass}>
            <h2 className="text-lg font-semibold">{lang === 'th' ? 'ตารางรายละเอียดการขับขี่' : 'Driving detail table'}</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-white">
                  <tr>
                    <th className="px-3 py-2">Driver Name</th>
                    <th className="px-3 py-2">Vehicle No</th>
                    <th className="px-3 py-2">Start Time</th>
                    <th className="px-3 py-2">End Time</th>
                    <th className="px-3 py-2">Start Location</th>
                    <th className="px-3 py-2">End Location</th>
                    <th className="px-3 py-2">Distance</th>
                    <th className="px-3 py-2">Cnt Drv duration</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">{row.driverName}</td>
                      <td className="px-3 py-2">{row.vehicleNo}</td>
                      <td className="px-3 py-2">{row.startTime}</td>
                      <td className="px-3 py-2">{row.endTime}</td>
                      <td className="max-w-[220px] truncate px-3 py-2" title={row.startLocation}>{row.startLocation}</td>
                      <td className="max-w-[220px] truncate px-3 py-2" title={row.endLocation}>{row.endLocation}</td>
                      <td className="px-3 py-2">{formatNumber(row.distance, 0)}</td>
                      <td className="px-3 py-2">{formatNumber(row.cntDrvDuration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </DashboardShell>
  )
}
