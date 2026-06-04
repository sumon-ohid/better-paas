import type { Metadata } from 'next';
import { Eyebrow } from '@/components/landing/primitives';

export const metadata: Metadata = {
  title: 'Terms of Service | Better-PaaS',
  description: 'Terms of service for Better-PaaS. Licensed under open source AGPL-3.0, provided as-is without warranty.',
};

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-sm text-fd-muted-foreground mb-6">Last updated: June 4, 2026</p>

        <section className="space-y-6 text-fd-muted-foreground leading-relaxed text-sm">
          <p>
            Welcome to Better-PaaS. By using the Better-PaaS software or our website, you agree to comply with and be bound by the following terms of service.
          </p>

          <h2 className="text-xl font-bold text-fd-foreground pt-4">1. Open Source License</h2>
          <p>
            The Better-PaaS software is open-source and is licensed under the <strong>GNU Affero General Public License v3 (AGPL-3.0)</strong>. You may inspect, modify, and distribute the source code in accordance with the terms of that license.
          </p>

          <h2 className="text-xl font-bold text-fd-foreground pt-4">2. Self-Hosted Responsibility</h2>
          <p>
            Since Better-PaaS runs entirely on your own hardware or server infrastructure:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>You are solely responsible for securing your installations, servers, docker instances, databases, and admin access tokens.</li>
            <li>You are responsible for backing up your database configurations and logs.</li>
            <li>You agree to comply with your hosting provider's terms of service when deploying applications.</li>
          </ul>

          <h2 className="text-xl font-bold text-fd-foreground pt-4">3. Disclaimer of Warranties</h2>
          <p className="italic">
            THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
          </p>

          <h2 className="text-xl font-bold text-fd-foreground pt-4">4. Limitation of Liability</h2>
          <p>
            Under no circumstances shall the developers, contributors, or authors of Better-PaaS be held liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use the software, including but not limited to server failures, security breaches, data loss, or downtime.
          </p>

          <h2 className="text-xl font-bold text-fd-foreground pt-4">5. Modifications to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. Updates will be posted on this page with a revised "Last updated" date. Your continued use of the website or software indicates your acceptance of any revisions.
          </p>
        </section>
      </article>
    </main>
  );
}
