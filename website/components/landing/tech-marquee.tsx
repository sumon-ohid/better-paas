import type { SVGProps } from 'react';
import {
  GoLogo,
  DockerLogo,
  NixLogo,
  CaddyLogo,
  LetsEncryptLogo,
  NextjsLogo,
} from './brand-logos';

/* A quietly looping strip of the stack Better-PaaS is built on. Two identical
 * halves translate -50% so the loop is seamless; hovering pauses it. Uses the
 * real brand marks (brand-logos.tsx), drawn in the site's monochrome ink. */

const STACK: { logo: (props: SVGProps<SVGSVGElement>) => React.ReactElement; label: string }[] = [
  { logo: GoLogo, label: 'Go' },
  { logo: DockerLogo, label: 'Docker' },
  { logo: NixLogo, label: 'Nixpacks' },
  { logo: CaddyLogo, label: 'Caddy' },
  { logo: NextjsLogo, label: 'Next.js' },
  { logo: LetsEncryptLogo, label: 'Let’s Encrypt' },
];

export function TechMarquee() {
  return (
    <div className="bp-marquee-group relative overflow-hidden mask-[linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div className="bp-marquee flex w-max items-center gap-16 pr-16">
        {[...STACK, ...STACK].map((item, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-3.5 text-xl font-semibold text-fd-muted-foreground/90 transition-colors hover:text-fd-foreground"
          >
            <item.logo className="size-8 text-fd-muted-foreground/80" />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
