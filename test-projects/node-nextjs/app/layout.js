export const metadata = {
  title: "test-node-nextjs",
  description: "Minimal Next.js app for testing BaaS deploys",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
