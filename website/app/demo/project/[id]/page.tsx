import Client from './client';
import { demoProjectIds } from '@/dashboard/lib/demo-static-params';

export function generateStaticParams() {
  return demoProjectIds();
}

export default function Page() {
  return <Client />;
}
