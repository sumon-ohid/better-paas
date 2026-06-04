import type { Metadata } from 'next';
import { Eyebrow } from '@/components/landing/primitives';

export const metadata: Metadata = {
  title: 'Privacy Policy | Better-PaaS',
  description: 'Privacy policy for Better-PaaS. Since Better-PaaS is 100% self-hosted, your data and credentials stay on your own servers.',
};

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col relative min-h-screen bg-fd-background text-fd-foreground">
      {/* Background radial glow */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] pointer-events-none opacity-[0.1] dark:opacity-[0.2]"
        style={{
          background: 'radial-gradient(ellipse 50% 50% at 50% 0%, var(--color-fd-primary) 0%, transparent 100%)',
        }}
      />

      <article className="relative mx-auto max-w-3xl px-6 py-24 sm:py-32 prose prose-fd-neutral dark:prose-invert">
        <Eyebrow className="mb-4">Legal</Eyebrow>
        <h1 className="bp-display text-4xl font-semibold sm:text-5xl text-fd-foreground mb-8">
          Privacy Policy
        </h1>
        <p className="text-sm text-fd-muted-foreground mb-6">Last updated: June 4, 2026</p>

        <section className="space-y-6 text-fd-muted-foreground leading-relaxed text-sm">
          <p>
            At Better-PaaS, privacy is not a feature—it is the foundation of the project. This Privacy Policy details how data is handled when you use the Better-PaaS software.
          </p>

          <h2 className="text-xl font-bold text-fd-foreground pt-4">1. 100% Self-Hosted & Local Control</h2>
          <p>
            Better-PaaS is a self-hosted platform-as-a-service. When you install and run Better-PaaS, all binaries, code containers, sqlite databases, and configurations run entirely on your own hardware or server.
          </p>
          <p className="font-semibold text-fd-foreground">
            We do not run any central servers, database synchronization services, or tracking relays. Your data never leaves your machine unless you choose to send it elsewhere.
          </p>

          <h2 className="text-xl font-bold text-fd-foreground pt-4">2. Types of Data Handled</h2>
          <p>
            The software manages the following credentials and data to perform deployments:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Git Tokens & Credentials:</strong> Used to pull repositories from providers like GitHub or GitLab. These are encrypted locally on your server using AES-256-GCM.</li>
            <li><strong>Application Environment Variables & Secrets:</strong> Configuration values for your deployed containers, stored securely on your server.</li>
            <li><strong>Runtime logs and metrics:</strong> Log streams and CPU/memory statistics collected from Docker containers, cached or saved locally on your server.</li>
          </ul>

          <h2 className="text-xl font-bold text-fd-foreground pt-4">3. Third-Party Services & Integrations</h2>
          <p>
            Better-PaaS interfaces with third-party APIs only when configured by you (e.g. pulling code from GitHub, setting up Let's Encrypt for automatic HTTPS, or sending webhook notifications to Slack). These requests are direct between your server and the provider.
          </p>

          <h2 className="text-xl font-bold text-fd-foreground pt-4">4. No Analytics or Telemetry</h2>
          <p>
            Better-PaaS does not include telemetry trackers, reporting scripts, or usage metrics collector hooks. We do not gather statistics about what apps you deploy or how much hardware you consume.
          </p>

          <h2 className="text-xl font-bold text-fd-foreground pt-4">5. Contact</h2>
          <p>
            If you have questions about the self-hosted security configurations, please open an issue on our GitHub repository or contact us at <a href="mailto:hello@better-paas.com" className="underline hover:text-fd-foreground text-fd-primary">hello@better-paas.com</a>.
          </p>
        </section>
      </article>
    </main>
  );
}
