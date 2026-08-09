import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "个保轻舟｜小型处理者合规工作台",
  description: "面向小型个人信息处理者的一站式个保合规工作台"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
