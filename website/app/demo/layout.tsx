import { Geist_Mono, Inter } from 'next/font/google';
import '@/dashboard/globals.css';
import { ThemeProvider } from '@/dashboard/components/theme-provider';
import { ToastProvider } from '@/dashboard/components/ui/toast';
import { AuthGate } from '@/dashboard/components/auth-gate';
import { ServerProvider } from '@/dashboard/components/server-context';
import { OnboardingGate } from '@/dashboard/components/onboarding-gate';
import { cn } from '@/dashboard/lib/utils';
import type { Metadata } from 'next';

const interHeading = Inter({ subsets: ['latin'], variable: '--font-heading' });
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Interactive Demo — Better-PaaS',
  description: 'Read-only walkthrough of the Better-PaaS dashboard with sample projects and services.',
  robots: { index: true, follow: true },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'demo-dashboard antialiased font-sans min-h-screen',
        inter.variable,
        interHeading.variable,
        geistMono.variable,
      )}
    >
      <ThemeProvider>
        <ToastProvider>
          <AuthGate>
            <ServerProvider>
              <OnboardingGate>{children}</OnboardingGate>
            </ServerProvider>
          </AuthGate>
        </ToastProvider>
      </ThemeProvider>
    </div>
  );
}
