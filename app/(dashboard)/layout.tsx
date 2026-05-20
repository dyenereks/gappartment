import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect("/sign-in");
  }

  // Sync user to DB on every layout render (handles missing webhook)
  let dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser) {
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email;
    const userCount = await prisma.user.count();
    dbUser = await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        imageUrl: clerkUser.imageUrl,
        isAdmin: userCount === 0,
      },
    });
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar isAdmin={dbUser.isAdmin} />
      <main className="lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
