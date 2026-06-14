import { DEMO_APPS, DEMO_PROJECTS } from '@/dashboard/lib/demo-data';

export function demoAppIds(): { id: string }[] {
  return DEMO_APPS.map((app) => ({ id: app.id }));
}

export function demoProjectIds(): { id: string }[] {
  return DEMO_PROJECTS.map((project) => ({ id: project.id }));
}

export function demoDeploymentAppIds(): { appId: string }[] {
  return DEMO_APPS.map((app) => ({ appId: app.id }));
}
