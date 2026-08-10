import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marwadi Digital Day Book - Pooja Jewellers",
  description: "Traditional Lal Bahi daily diary application for Pooja Jewellers. Simple, elegant, mobile-first ledger.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Day Book",
  },
};

export const viewport: Viewport = {
  themeColor: "#b91c1c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
