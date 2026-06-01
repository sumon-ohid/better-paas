import { source } from '@/lib/source';
import { llms } from 'fumadocs-core/source';
import { siteUrl } from '@/lib/shared';

export const revalidate = false;

export function GET() {
  const baseIndex = llms(source).index();
  const customHeader = `# Better-PaaS Documentation (LLM & Agent Hub)

Welcome to the Better-PaaS documentation hub optimized for AI coding agents and Large Language Models. Better-PaaS is an easy-to-use, self-hosted Platform-as-a-Service (PaaS) that runs Heroku-like workflows on a VPS you own.

## Essential Resources for Agents
- [AI Agent Guide](${siteUrl}/docs/guides/ai-agents): A detailed operational guide on how AI coding agents and developer environments can interact with, deploy to, and configure Better-PaaS.
- [Full Documentation Archive](${siteUrl}/llms-full.txt): A single text bundle containing all documentation pages concatenated for rapid context loading.

---

`;
  return new Response(customHeader + baseIndex);
}

