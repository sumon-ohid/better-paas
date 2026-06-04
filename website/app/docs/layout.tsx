import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { SidebarFooter } from '@/components/landing/sidebar-footer';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  const { githubUrl, ...restOptions } = baseOptions();

  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...restOptions}
      githubUrl={undefined}
      themeSwitch={{ enabled: false }}
      sidebar={{
        footer: <SidebarFooter />,
      }}
    >
      {children}
    </DocsLayout>
  );
}
