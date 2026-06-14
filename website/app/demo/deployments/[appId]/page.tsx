import Client from './client';
import { demoDeploymentAppIds } from '@/dashboard/lib/demo-static-params';

export function generateStaticParams() {
  return demoDeploymentAppIds();
}

export default function Page() {
  return <Client />;
}
