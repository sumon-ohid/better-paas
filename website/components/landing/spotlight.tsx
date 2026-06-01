'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/cn';

export function Spotlight({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 -top-16 z-0 h-[800px] overflow-hidden select-none spotlight-beam',
        className
      )}
    >
      {/* Inject styling to toggle the custom spotlight colors in dark mode */}
      <style dangerouslySetInnerHTML={{ __html: `
        .spotlight-beam {
          --spotlight-color: var(--bp-primary);
          --spotlight-accent: var(--bp-accent-2, var(--bp-primary));
        }
        .dark .spotlight-beam {
          --spotlight-color: #ffffff;
          --spotlight-accent: #ffffff;
        }
      `}} />

      <div className="relative w-full h-full">
        {/* Soft background ambient glow originating from the absolute top-left */}
        <div 
          className="absolute top-0 left-0 w-[800px] h-[500px] rounded-full bg-[radial-gradient(ellipse_at_top_left,var(--spotlight-color),transparent_60%)] opacity-[0.1] dark:opacity-[0.18] blur-3xl"
        />

        {/* Dynamic Animated Beams originating from x=0 */}
        <motion.svg
          initial={{ opacity: 0, scale: 0.95, x: -30, y: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-0 left-0 h-[800px] w-[1000px] origin-top-left opacity-25 dark:opacity-70 mix-blend-normal dark:mix-blend-screen"
          viewBox="0 0 1000 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g filter="url(#spotlight-blur)">
            {/* Left Beam */}
            <motion.path
              initial={{ rotate: -5, opacity: 0 }}
              animate={{ rotate: 0, opacity: 0.22 }}
              transition={{ duration: 2.2, delay: 0.2, ease: 'easeOut' }}
              className="origin-top-left"
              style={{ originX: '0px', originY: '0px' }}
              d="M0 0 L50 800 L300 800 Z"
              fill="url(#beam-grad-left)"
            />

            {/* Right Beam */}
            <motion.path
              initial={{ rotate: 5, opacity: 0 }}
              animate={{ rotate: 0, opacity: 0.22 }}
              transition={{ duration: 2.2, delay: 0.2, ease: 'easeOut' }}
              className="origin-top-left"
              style={{ originX: '0px', originY: '0px' }}
              d="M0 0 L400 800 L700 800 Z"
              fill="url(#beam-grad-left)"
            />

            {/* Center Main Spotlight Beam */}
            <motion.path
              initial={{ scaleY: 0.7, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 0.4 }}
              transition={{ duration: 1.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="origin-top-left"
              style={{ originX: '0px', originY: '0px' }}
              d="M0 0 L150 800 L600 800 Z"
              fill="url(#beam-grad-center-diagonal)"
            />
          </g>

          <defs>
            {/* Gradients matching the diagonal direction */}
            <linearGradient id="beam-grad-left" x1="0" y1="0" x2="300" y2="800" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--spotlight-color)" stopOpacity="0.75" />
              <stop offset="40%" stopColor="var(--spotlight-color)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--spotlight-color)" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="beam-grad-center-diagonal" x1="0" y1="0" x2="450" y2="800" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--spotlight-color)" stopOpacity="0.95" />
              <stop offset="25%" stopColor="var(--spotlight-accent)" stopOpacity="0.4" />
              <stop offset="60%" stopColor="var(--spotlight-color)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="var(--spotlight-color)" stopOpacity="0" />
            </linearGradient>

            {/* Blur Filter */}
            <filter
              id="spotlight-blur"
              x="-100"
              y="-100"
              width="1200"
              height="1000"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur stdDeviation="70" />
            </filter>
          </defs>
        </motion.svg>
      </div>
    </div>
  );
}
