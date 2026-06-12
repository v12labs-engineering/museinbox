import type { Metadata } from "next";
import "../src/styles.css";

export const metadata: Metadata = {
  title: "MuseInbox",
  description: "Local Instagram comment automation dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
