'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tooltipBase } from './design-tokens';

type TooltipProps = {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
};

export default function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timeoutRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = position === 'top' ? rect.top - 8 : rect.bottom + 8;
      const flipped = position === 'top' ? y < 40 : y > window.innerHeight - 40;
      const finalY = flipped
        ? (position === 'top' ? rect.bottom + 8 : rect.top - 8)
        : y;
      setCoords({ x, y: finalY });
      setVisible(true);
    }, 100);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  if (!content) return <>{children}</>;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="block"
      >
        {children}
      </span>
      {visible && createPortal(
        <div
          role="tooltip"
          className={`${tooltipBase} pointer-events-none fixed z-[9999] -translate-x-1/2 whitespace-nowrap`}
          style={{ left: coords.x, top: coords.y, transform: `translate(-50%, ${coords.y < 40 ? '4px' : '-100%'})` }}
        >
          {content}
          <span
            className="absolute left-1/2 -translate-x-1/2 border-[5px] border-transparent"
            style={coords.y < 40
              ? { top: '-10px', borderBottomColor: '#18181b' }
              : { bottom: '-10px', borderTopColor: '#18181b' }
            }
          />
        </div>,
        document.body,
      )}
    </>
  );
}
