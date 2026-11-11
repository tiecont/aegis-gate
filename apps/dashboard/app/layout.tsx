import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "AegisGate · Development workspace",
  description:
    "AegisGate local development foundation. Customer traffic is disabled.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
