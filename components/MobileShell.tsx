"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Icon, { type IconName } from "./Icon";
import ThemeToggle from "./ThemeToggle";
import { api } from "@/convex/_generated/api";

interface MobileTabItem {
  href: string;
  label: string;
  icon: IconName;
}

const TITLE_BY_PATH: Record<string, string> = {
  "/": "Dashboard",
  "/bills": "Bills",
  "/expenses": "Expenses",
  "/payments": "Payments",
  "/profile": "Profile",
  "/admin": "Admin",
};

function titleFor(pathname: string) {
  if (pathname === "/") return TITLE_BY_PATH["/"];
  const top = "/" + pathname.split("/").filter(Boolean)[0];
  return TITLE_BY_PATH[top] ?? "GAppartment";
}

export function MobileTopbar() {
  const pathname = usePathname();
  const { user } = useUser();
  return (
    <div className="mobile-topbar">
      <div className="flex center gap-3" style={{ minWidth: 0 }}>
        <div className="brand-mark" style={{ width: 32, height: 32, fontSize: 16 }}>
          G
        </div>
        <div
          className="serif"
          style={{
            fontSize: 18,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {titleFor(pathname)}
        </div>
      </div>
      <div className="flex center gap-2">
        <ThemeToggle />
        {user?.imageUrl ? (
          <span
            aria-hidden
            className="avatar avatar-sm"
            style={{
              background: `center/cover url(${user.imageUrl})`,
              color: "transparent",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const me = useQuery(api.users.current);
  const isAdmin = me?.isAdmin ?? false;

  const items: MobileTabItem[] = [
    { href: "/", label: "Home", icon: "dashboard" },
    { href: "/bills", label: "Bills", icon: "bills" },
    { href: "/expenses", label: "Expenses", icon: "expenses" },
    { href: "/payments", label: "Pay", icon: "payments" },
    { href: "/profile", label: "Me", icon: "profile" },
  ];
  if (isAdmin) items.push({ href: "/admin", label: "Admin", icon: "admin" });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="mobile-tab-bar"
      style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
    >
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={isActive(it.href) ? "active" : ""}
        >
          <Icon name={it.icon} size={20} />
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
