import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "PKmind | Poker Replay and Persona Studio",
  description:
    "PKmind is a poker-first product prototype with a replay arena, persona workshop, marketplace flow, and MiniMax-ready chat layer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
