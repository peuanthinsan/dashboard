/**
 * SongdeeGPS brand mark — Thai-inspired GPS shield with compass rose.
 * Inspired by Thai temple chofah (จอฟ้า) finial and navigation motifs.
 */

type SongdeeLogoProps = {
  size?: number;
  className?: string;
};

export default function SongdeeLogo({ size = 32, className = '' }: SongdeeLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SongdeeGPS"
    >
      {/* Outer shield — Thai diamond shape */}
      <path
        d="M24 2L44 24L24 46L4 24Z"
        fill="url(#shield-gradient)"
        stroke="url(#shield-stroke)"
        strokeWidth="1.5"
      />
      {/* Inner frame */}
      <path
        d="M24 7L39 24L24 41L9 24Z"
        fill="none"
        stroke="url(#inner-frame)"
        strokeWidth="0.75"
        opacity="0.6"
      />
      {/* Compass rose — cardinal points */}
      <polygon points="24,10 26,22 24,19 22,22" fill="#FBBF24" /> {/* N */}
      <polygon points="24,38 26,26 24,29 22,26" fill="#FDE68A" opacity="0.7" /> {/* S */}
      <polygon points="10,24 22,22 19,24 22,26" fill="#FDE68A" opacity="0.7" /> {/* W */}
      <polygon points="38,24 26,22 29,24 26,26" fill="#FDE68A" opacity="0.7" /> {/* E */}
      {/* Intercardinal points */}
      <polygon points="15,15 22.5,22 18,18 22,22.5" fill="#F59E0B" opacity="0.35" />
      <polygon points="33,15 26,22.5 30,18 25.5,22" fill="#F59E0B" opacity="0.35" />
      <polygon points="15,33 22.5,26 18,30 22,25.5" fill="#F59E0B" opacity="0.35" />
      <polygon points="33,33 25.5,26 30,30 26,25.5" fill="#F59E0B" opacity="0.35" />
      {/* Center compass circle */}
      <circle cx="24" cy="24" r="4" fill="none" stroke="#FBBF24" strokeWidth="0.75" opacity="0.8" />
      {/* GPS pin dot */}
      <circle cx="24" cy="24" r="1.8" fill="#FBBF24" />
      {/* Thai decorative tick marks */}
      <line x1="24" y1="6" x2="24" y2="8.5" stroke="#FBBF24" strokeWidth="0.75" opacity="0.5" />
      <line x1="42" y1="24" x2="39.5" y2="24" stroke="#FBBF24" strokeWidth="0.75" opacity="0.5" />
      <line x1="24" y1="42" x2="24" y2="39.5" stroke="#FBBF24" strokeWidth="0.75" opacity="0.5" />
      <line x1="6" y1="24" x2="8.5" y2="24" stroke="#FBBF24" strokeWidth="0.75" opacity="0.5" />
      <defs>
        <linearGradient id="shield-gradient" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#991B1B" />
          <stop offset="0.5" stopColor="#7F1D1D" />
          <stop offset="1" stopColor="#450A0A" />
        </linearGradient>
        <linearGradient id="shield-stroke" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id="inner-frame" x1="9" y1="7" x2="39" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#92400E" />
        </linearGradient>
      </defs>
    </svg>
  );
}
