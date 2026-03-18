import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "PocketMuse | AI Companion MVP",
  description:
    "A first-pass desktop companion chat prototype powered by MiniMax or a local mock mode.",
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
