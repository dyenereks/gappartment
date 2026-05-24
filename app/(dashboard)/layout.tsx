import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { MobileTopbar, MobileTabBar } from "@/components/MobileShell";
import UserSync from "@/components/UserSync";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="app">
      <UserSync />
      <Sidebar />
      <MobileTopbar />
      <main className="main">{children}</main>
      <MobileTabBar />
    </div>
  );
}
