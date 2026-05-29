import os from "os";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>node-nextjs</h1>
      <p>Hello from Next.js on the BaaS platform</p>
      <ul>
        <li>hostname: {os.hostname()}</li>
        <li>time: {new Date().toISOString()}</li>
      </ul>
    </main>
  );
}
