import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/** SongdeeGPS GPS pin as favicon — red pin, white circle, black S road path */
export default function Icon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52">
    <path d="M20 0C8.95 0 0 8.95 0 20c0 14.25 20 32 20 32s20-17.75 20-32C40 8.95 31.05 0 20 0z" fill="#DC2626"/>
    <circle cx="20" cy="19" r="12" fill="white"/>
    <path d="M13 13l7 0 0 6-7 0 0 6 7 0 7 0 0-6-7 0 0-6-7 0z" fill="#1F2937" opacity="0.85"/>
  </svg>`;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <img
          src={dataUrl}
          alt=""
          width={28}
          height={36}
          style={{ display: 'block' }}
        />
      </div>
    ),
    { ...size }
  );
}
