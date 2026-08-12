import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TuneAI — YouTube Music Recommender",
  description: "AI-powered YouTube song recommendations using your Zaby agent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}