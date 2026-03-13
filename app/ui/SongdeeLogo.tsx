import Image from 'next/image';

/**
 * SongdeeGPS brand mark — uses the official logo image.
 */

type SongdeeLogoProps = {
  /** Height in pixels — width auto-calculated from aspect ratio (≈2.44:1) */
  height?: number;
  className?: string;
};

export default function SongdeeLogo({ height = 32, className = '' }: SongdeeLogoProps) {
  const width = Math.round(height * 2.44);
  return (
    <Image
      src="/songdee-logo.png"
      alt="SongdeeGPS"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}

/**
 * Just the GPS pin icon portion of the brand (SVG recreation for small sizes).
 * Red pin with black "S" road path inside.
 */
export function SongdeePinIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SongdeeGPS"
    >
      {/* GPS pin shape */}
      <path
        d="M20 0C8.95 0 0 8.95 0 20c0 14.25 20 32 20 32s20-17.75 20-32C40 8.95 31.05 0 20 0z"
        fill="#DC2626"
      />
      {/* White inner circle */}
      <circle cx="20" cy="19" r="12" fill="white" />
      {/* Black S-shape road path */}
      <path
        d="M13 13l7 0 0 6-7 0 0 6 7 0 7 0 0-6-7 0 0-6-7 0z"
        fill="#1F2937"
        opacity="0.85"
      />
    </svg>
  );
}
