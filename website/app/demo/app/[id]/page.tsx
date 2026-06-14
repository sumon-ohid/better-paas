import Client from './client';
import { demoAppIds } from '@/dashboard/lib/demo-static-params';

export function generateStaticParams() {
  return demoAppIds();
}

export default function Page() {
  return <Client />;
}
