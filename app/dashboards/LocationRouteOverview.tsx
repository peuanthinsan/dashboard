'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { heading2, textMuted } from 'app/ui/design-tokens';
import {
  loadGoogleMaps,
  type GoogleMapsApi,
  type GoogleMapsDrawable,
  type GoogleMapsEventListener,
  type GoogleMapsMap,
} from './googleMapsLoader';

export type LocationPlotPoint = {
  id: number;
  segmentKey: string;
  vehicleNo: string;
  latitude: number;
  longitude: number;
  location: string;
  timestamp: number;
  timeLabel: string;
  speed: number;
  mapHref: string;
};

type LocationRouteOverviewProps = {
  points: LocationPlotPoint[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  lang?: 'en' | 'th';
};

const MAX_DRAW_POINTS = 180;
const MAX_MARKERS = 36;

function sampled<T>(values: T[], max: number): T[] {
  if (values.length <= max) return values;
  return Array.from({ length: max }, (_, index) => {
    const sourceIndex = Math.round((index * (values.length - 1)) / (max - 1));
    return values[sourceIndex]!;
  });
}

function segmentColor(speed: number) {
  if (speed > 60) return '#ef4444';
  if (speed > 35) return '#f59e0b';
  return '#16a34a';
}

export default function LocationRouteOverview({
  points,
  selectedId,
  onSelect,
  lang = 'en',
}: LocationRouteOverviewProps) {
  const drawPoints = useMemo<LocationPlotPoint[]>(() => {
    const ordered = [...points].sort((a, b) => a.timestamp - b.timestamp);
    const visible = sampled(ordered, MAX_DRAW_POINTS);
    const selectedPoint = ordered.find((point) => point.id === selectedId);
    if (selectedPoint && !visible.some((point) => point.id === selectedPoint.id)) {
      visible.push(selectedPoint);
      visible.sort((a, b) => a.timestamp - b.timestamp);
    }
    return visible;
  }, [points, selectedId]);

  const selected =
    drawPoints.find((point) => point.id === selectedId) ?? drawPoints[drawPoints.length - 1] ?? null;
  const selectablePoints = useMemo(() => {
    const markerEvery = Math.max(1, Math.ceil(drawPoints.length / MAX_MARKERS));
    return drawPoints.filter((point, index) =>
      index === 0 ||
      index === drawPoints.length - 1 ||
      point.id === selected?.id ||
      index % markerEvery === 0,
    );
  }, [drawPoints, selected?.id]);
  const labels =
    lang === 'th'
      ? {
          title: 'ภาพรวมเส้นทาง',
          hint: 'คลิกจุดที่ทำเครื่องหมายบนเส้นทางเพื่อดูรายละเอียด',
          open: 'เปิดใน Google Maps',
          empty: 'ไม่มีพิกัดที่ใช้ได้ในมุมมองนี้',
          start: 'เริ่ม',
          end: 'สิ้นสุด',
          loading: 'กำลังโหลด Google Maps…',
          error: 'ไม่สามารถโหลด Google Maps ได้ กรุณาตรวจสอบการตั้งค่า API',
          slow: '≤ 35',
          medium: '36–60',
          fast: '> 60 กม./ชม.',
        }
      : {
          title: 'Route overview',
          hint: 'Select a marked point on the trace to inspect it',
          open: 'Open in Google Maps',
          empty: 'No valid coordinates in this view.',
          start: 'Start',
          end: 'End',
          loading: 'Loading Google Maps…',
          error: 'Google Maps could not be loaded. Check the API configuration.',
          slow: '≤ 35',
          medium: '36–60',
          fast: '> 60 km/h',
        };

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapsMap | null>(null);
  const mapsApiRef = useRef<GoogleMapsApi | null>(null);
  const overlaysRef = useRef<GoogleMapsDrawable[]>([]);
  const listenersRef = useRef<GoogleMapsEventListener[]>([]);
  const onSelectRef = useRef(onSelect);
  const [mapState, setMapState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (drawPoints.length === 0) return;
    let cancelled = false;
    setMapState('loading');

    loadGoogleMaps(apiKey)
      .then((api) => {
        if (cancelled || !mapContainerRef.current) return;
        const firstPoint = drawPoints[0]!;
        mapsApiRef.current = api;
        mapRef.current = new api.maps.Map(mapContainerRef.current, {
          center: { lat: firstPoint.latitude, lng: firstPoint.longitude },
          zoom: 13,
          clickableIcons: false,
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
        });
        setMapState('ready');
      })
      .catch(() => {
        if (!cancelled) setMapState('error');
      });

    return () => {
      cancelled = true;
      listenersRef.current.forEach((listener) => listener.remove());
      listenersRef.current = [];
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      if (mapRef.current && mapsApiRef.current) {
        mapsApiRef.current.maps.event.clearInstanceListeners(mapRef.current);
      }
      mapRef.current = null;
      mapsApiRef.current = null;
    };
    // The map itself is created once per populated dashboard. Route updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, drawPoints.length > 0]);

  useEffect(() => {
    const api = mapsApiRef.current;
    const map = mapRef.current;
    if (mapState !== 'ready' || !api || !map || drawPoints.length === 0) return;

    listenersRef.current.forEach((listener) => listener.remove());
    listenersRef.current = [];
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    const bounds = new api.maps.LatLngBounds();
    drawPoints.forEach((point) => {
      bounds.extend({ lat: point.latitude, lng: point.longitude });
    });

    if (drawPoints.length === 1) {
      const onlyPoint = drawPoints[0]!;
      map.setCenter({ lat: onlyPoint.latitude, lng: onlyPoint.longitude });
      map.setZoom(16);
    } else {
      map.fitBounds(bounds, 42);
    }

    const segmentPoints = new Map<string, LocationPlotPoint[]>();
    drawPoints.forEach((point) => {
      const values = segmentPoints.get(point.segmentKey) ?? [];
      values.push(point);
      segmentPoints.set(point.segmentKey, values);
    });
    Array.from(segmentPoints.values()).forEach((values) => {
      values.slice(1).forEach((point, index) => {
        const previous = values[index]!;
        const line = new api.maps.Polyline({
          map,
          path: [
            { lat: previous.latitude, lng: previous.longitude },
            { lat: point.latitude, lng: point.longitude },
          ],
          geodesic: true,
          strokeColor: segmentColor(point.speed),
          strokeOpacity: 0.9,
          strokeWeight: 5,
          zIndex: 2,
        });
        overlaysRef.current.push(line);
      });
    });

    selectablePoints.forEach((point) => {
      const index = drawPoints.findIndex((candidate) => candidate.id === point.id);
      const isStart = index === 0;
      const isEnd = index === drawPoints.length - 1;
      const isSelected = point.id === selected?.id;
      const radius = drawPoints.length === 1
        ? isSelected ? 24 : 16
        : isSelected ? 420 : isStart || isEnd ? 320 : 200;
      const marker = new api.maps.Circle({
        map,
        center: { lat: point.latitude, lng: point.longitude },
        clickable: true,
        radius,
        zIndex: isSelected ? 20 : isStart || isEnd ? 12 : 6,
        fillColor: isSelected ? '#dc2626' : isStart ? '#16a34a' : isEnd ? '#dc2626' : '#ffffff',
        fillOpacity: 1,
        strokeColor: isSelected || isStart || isEnd ? '#ffffff' : segmentColor(point.speed),
        strokeOpacity: 1,
        strokeWeight: isSelected ? 3 : 2,
      });
      overlaysRef.current.push(marker);
      listenersRef.current.push(marker.addListener('click', () => onSelectRef.current?.(point.id)));
    });

    return () => {
      listenersRef.current.forEach((listener) => listener.remove());
      listenersRef.current = [];
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
    };
  }, [drawPoints, mapState, selectablePoints, selected?.id]);

  return (
    <section className="min-w-0" aria-labelledby="location-route-title">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1 pb-3">
        <div>
          <h2 id="location-route-title" className={heading2}>{labels.title}</h2>
          <p className={`mt-1 ${textMuted}`}>{labels.hint}</p>
        </div>
        {selected ? (
          <a
            href={selected.mapHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.1 7-12a7 7 0 10-14 0c0 5.9 7 12 7 12z" />
              <circle cx="12" cy="9" r="2.2" />
            </svg>
            {labels.open}
          </a>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/50">
        {drawPoints.length > 0 ? (
          <>
            <div className="relative h-[260px] w-full sm:h-[320px] lg:h-[360px]">
              <div
                ref={mapContainerRef}
                className="h-full w-full bg-zinc-100 dark:bg-zinc-900"
                role="region"
                aria-label={`${labels.title}: ${drawPoints.length} plotted points`}
              />
              {mapState === 'loading' ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/90 px-6 text-sm text-zinc-500 backdrop-blur-sm dark:bg-zinc-950/90 dark:text-zinc-400" role="status">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-red-600 dark:border-zinc-700 dark:border-t-red-400" aria-hidden="true" />
                    {labels.loading}
                  </span>
                </div>
              ) : null}
              {mapState === 'error' ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 px-6 text-center text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400" role="alert">
                  <div>
                    <svg aria-hidden="true" className="mx-auto mb-3 h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.1 7-12a7 7 0 10-14 0c0 5.9 7 12 7 12z" />
                      <circle cx="12" cy="9" r="2.2" />
                    </svg>
                    {labels.error}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="grid gap-px border-t border-zinc-200/70 bg-zinc-200/70 sm:grid-cols-[1fr_auto] dark:border-zinc-800 dark:bg-zinc-800">
              <div className="min-w-0 bg-white px-4 py-3 dark:bg-zinc-900">
                <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {selected?.location || '—'}
                </p>
                <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  {selected?.timeLabel} · {selected?.speed ?? 0} km/h
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 bg-white px-4 py-3 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-600" />{labels.slow}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />{labels.medium}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />{labels.fast}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-[260px] items-center justify-center px-6 text-sm text-zinc-400 dark:text-zinc-500">
            {labels.empty}
          </div>
        )}
      </div>
    </section>
  );
}
