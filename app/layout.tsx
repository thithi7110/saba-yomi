import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "サバヨミ",
  description: "文章をサッと読んで、パッと判断。読む力を気楽に鍛えるゲーム",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f6feb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <main className="mx-auto min-h-dvh max-w-md px-4 pb-10 pt-6">{children}</main>
        <RegisterSW />
      </body>
    </html>
  );
}
