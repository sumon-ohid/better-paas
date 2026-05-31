import { Container, Boxes, ShieldCheck, Server, Layers, Lock } from 'lucide-react';

/* A quietly looping strip of the stack Better-PaaS is built on. Two identical
 * halves translate -50% so the loop is seamless; hovering pauses it. */

const STACK: { icon: typeof Container; label: string }[] = [
  { icon: Server, label: 'Go control plane' },
  { icon: Container, label: 'Docker' },
  { icon: Boxes, label: 'Nixpacks' },
  { icon: ShieldCheck, label: 'Caddy' },
  { icon: Layers, label: 'Next.js dashboard' },
  { icon: Lock, label: 'Let’s Encrypt' },
];

export function TechMarquee() {
  return (
    <div className="bp-marquee-group relative overflow-hidden mask-[linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div className="bp-marquee flex w-max items-center gap-12 pr-12">
        {[...STACK, ...STACK].map((item, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-2.5 text-sm font-medium text-fd-muted-foreground/80"
          >
            <item.icon className="size-4 text-fd-muted-foreground/60" />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
