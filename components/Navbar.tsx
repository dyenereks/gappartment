"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Receipt,
  ShoppingBag,
  CreditCard,
  User,
  Shield,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  isAdmin: boolean;
}

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/bills", icon: Receipt, label: "Bills" },
  { href: "/expenses", icon: ShoppingBag, label: "Expenses" },
  { href: "/payments", icon: CreditCard, label: "Payments" },
  { href: "/profile", icon: User, label: "Profile" },
];

export default function Navbar({ isAdmin }: NavbarProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    await signOut({ redirectUrl: "/sign-in" });
  };

  return (
    <>
      {/* Top header for mobile */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-cream-300 px-4 py-3 flex items-center justify-between shadow-sm">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">🏠</span>
          <span className="font-bold text-brown-600 text-lg">GAppartment</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-charcoal-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
          <UserButton />
        </div>
      </header>

      {/* Bottom nav for mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-cream-300 shadow-lg">
        <div className="flex items-center justify-around px-2 py-1">
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-0",
                  active
                    ? "text-brown-600"
                    : "text-charcoal-300 hover:text-brown-500"
                )}
              >
                <item.icon size={20} className={cn(active && "stroke-brown-600")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-0",
                pathname.startsWith("/admin")
                  ? "text-brown-600"
                  : "text-charcoal-300 hover:text-brown-500"
              )}
            >
              <Shield size={20} />
              <span className="text-[10px] font-medium">Admin</span>
            </Link>
          )}
        </div>
      </nav>

      {/* Sidebar for desktop */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-cream-300 shadow-sm z-40">
        <div className="p-6 border-b border-cream-300">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <div className="font-bold text-brown-600 text-lg leading-tight">GAppartment</div>
              <div className="text-xs text-charcoal-200">Bill Sharing</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  active
                    ? "bg-brown-600 text-white shadow-sm"
                    : "text-charcoal-400 hover:bg-cream-200 hover:text-brown-600"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                pathname.startsWith("/admin")
                  ? "bg-brown-600 text-white shadow-sm"
                  : "text-charcoal-400 hover:bg-cream-200 hover:text-brown-600"
              )}
            >
              <Shield size={18} />
              Admin Panel
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-cream-300 space-y-1">
          <div className="flex items-center gap-3 px-4 py-2">
            <UserButton />
            <span className="text-sm text-charcoal-300">Account</span>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-charcoal-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
