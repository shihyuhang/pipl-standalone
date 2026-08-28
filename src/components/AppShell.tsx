"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, Bot, Building2, ClipboardCheck, FileText, Home, Menu, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

const navigation = [
  { href: "/", label: "首页", icon: Home },
  { href: "/business", label: "我的业务", icon: Building2 },
  { href: "/compliance-check", label: "合规检查", icon: ShieldCheck, related: ["/assessments", "/self-audit", "/impact-assessments"] },
  { href: "/documents", label: "合规材料", icon: FileText },
  { href: "/tasks", label: "办理事项", icon: ClipboardCheck },
  { href: "/records", label: "记录与导出", icon: Archive },
  { href: "/settings/ai", label: "AI 设置", icon: Bot }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  useEffect(() => {
    const closeOnViewportChange = () => setOpen(false);
    window.addEventListener("resize", closeOnViewportChange);
    return () => window.removeEventListener("resize", closeOnViewportChange);
  }, []);
  useEffect(() => {
    void fetch("/api/enterprise", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(data => setOnboardingCompleted(Boolean(data?.onboardingCompleted))).catch(() => setOnboardingCompleted(null));
  }, [pathname]);
  const onboarding = pathname === "/onboarding";
  if (onboarding) return <main className="onboarding-shell">{children}</main>;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><ShieldCheck size={23} /></div><div><strong>个保轻舟</strong><span>小型处理者数据合规专用工作台</span></div></div>
        <button className="mobile-close" onClick={() => setOpen(false)} aria-label="关闭菜单"><X /></button>
        <nav>
          {navigation.filter(item => onboardingCompleted !== false || item.href === "/").map(item => {
            const active = item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href) || item.related?.some(path => pathname.startsWith(path));
            return <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)}><item.icon size={19} /><span>{item.label}</span></Link>;
          })}
        </nav>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="打开菜单"><Menu /></button>
          <div className="topbar-note">面向小型个人信息处理者的合规工作台</div>
        </header>
        <main className="page-container">{children}</main>
      </div>
      {open && <button className="scrim" aria-label="关闭菜单" onClick={() => setOpen(false)} />}
    </div>
  );
}
