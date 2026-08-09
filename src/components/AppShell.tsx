"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, Building2, ClipboardCheck, FileText, Home, Menu, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

const navigation = [
  { href: "/", label: "首页", icon: Home },
  { href: "/business", label: "我的业务", icon: Building2 },
  { href: "/documents", label: "合规材料", icon: FileText },
  { href: "/tasks", label: "办理事项", icon: ClipboardCheck },
  { href: "/records", label: "记录与导出", icon: Archive }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const onboarding = pathname === "/onboarding";
  if (onboarding) return <main className="onboarding-shell">{children}</main>;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><ShieldCheck size={23} /></div><div><strong>个保轻舟</strong><span>小型处理者工作台</span></div></div>
        <button className="mobile-close" onClick={() => setOpen(false)} aria-label="关闭菜单"><X /></button>
        <nav>
          {navigation.map(item => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)}><item.icon size={19} /><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-foot"><div className="safety-dot" /> <div><strong>本地安全存储</strong><span>AI 仅接收任务所需信息</span></div></div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="打开菜单"><Menu /></button>
          <div className="topbar-note">把复杂要求，变成今天能完成的事</div>
          <div className="avatar">负责人</div>
        </header>
        <main className="page-container">{children}</main>
      </div>
      {open && <button className="scrim" aria-label="关闭菜单" onClick={() => setOpen(false)} />}
    </div>
  );
}
