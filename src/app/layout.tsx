import type { Metadata } from "next";
import "./tailwind.css";
import "./globals.scss";

export const metadata: Metadata = {
  title: "M4 AI Agent",
  description: "使用 Next.js 重构的 M4 AI 对话学习项目",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
