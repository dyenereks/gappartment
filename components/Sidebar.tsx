"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Icon, { type IconName } from "./Icon";
import ThemeToggle from "./ThemeToggle";
import { api } from "@/convex/_generated/api";
import { displayName, initials, tenantColor, getCurrentMonth } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const me = useQuery(api.users.current);
  const bills = useQuery(api.bills.listByMonth, { month: getCurrentMonth() });

  const myId = me?._id;
  // Unpaid bills the current user owes on this month — drives the nav badge.
  const unpaidCount = (bills ?? []).reduce((n, b) => {
    const owes = b.shares.some(
      (s) => s.user?._id === myId && !s.isPaid && b.receiver?._id !== myId
    );
    return owes ? n + 1 : n;
  }, 0);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const items: NavItem[] = [
    { href: "/", label: "Dashboard", icon: "dashboard" },
    { href: "/bills", label: "Bills", icon: "bills", badge: unpaidCount },
    { href: "/expenses", label: "Expenses", icon: "expenses" },
    { href: "/payments", label: "Payments", icon: "payments" },
    { href: "/profile", label: "Profile", icon: "profile" },
  ];
  if (me?.isAdmin) {
    items.push({ href: "/admin", label: "Admin Panel", icon: "admin" });
  }

  const handleSignOut = async () => {
    await signOut({ redirectUrl: "/sign-in" });
  };

  // Avatar uses Clerk imageUrl if available, otherwise initials on tenant color
  const avatarColor = me ? tenantColor(me._id) : "var(--ink)";
  const avatarInitials = me
    ? initials(me)
    : (clerkUser?.firstName ?? "?").slice(0, 1).toUpperCase();
  const displayedName = me ? displayName(me) : clerkUser?.firstName ?? "Account";

  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <div className="brand-mark">G</div>
        <div style={{ minWidth: 0 }}>
          <div className="brand-name">GAppartment</div>
          <div className="brand-sub">Bill Sharing</div>
        </div>
      </Link>

      <nav className="nav">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={"nav-item " + (isActive(it.href) ? "active" : "")}
          >
            <Icon name={it.icon} size={18} />
            <span>{it.label}</span>
            {it.badge ? <span className="nav-badge">{it.badge}</span> : null}
          </Link>
        ))}
      </nav>

      <div className="sidebar-foot">
        <button
          type="button"
          className="acct"
          onClick={() => router.push("/profile")}
        >
          <div className="avatar avatar-sm" style={{ background: avatarColor }}>
            {avatarInitials}
          </div>
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayedName.split(" ")[0]}
            </div>
            <div className="muted" style={{ fontSize: 11 }}>
              {me?.isAdmin ? "Admin" : "Tenant"}
            </div>
          </div>
        </button>
        <button
          type="button"
          className="theme-toggle"
          onClick={handleSignOut}
          title="Log out"
          aria-label="Log out"
        >
          <Icon name="logout" size={16} />
        </button>
        <ThemeToggle />
      </div>
    </aside>
  );
}
