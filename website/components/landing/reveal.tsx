'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Reveal - fades + lifts its children into place once they scroll into view.
 *
 * This is the restrained, Linear-style motion: content settles as you reach it
 * rather than animating all at once on load. `delay` staggers siblings. Honors
 * prefers-reduced-motion via the CSS in global.css.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className,
  once = true,
  blur = false,
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
  once?: boolean;
  blur?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  return (
    <Tag
      ref={ref}
      className={cn(blur ? 'bp-reveal-blur' : 'bp-reveal', visible && 'is-visible', className)}
      style={{ '--bp-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
