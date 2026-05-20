import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/users — sync current user and return all users
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const clerkUser = await currentUser();
  if (!clerkUser) return new NextResponse("User not found", { status: 404 });

  // Upsert user (handles cases where webhook wasn't set up)
  const userCount = await prisma.user.count();
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!existingUser) {
    const email =
      clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email;

    await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        imageUrl: clerkUser.imageUrl,
        isAdmin: userCount === 0,
      },
    });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      imageUrl: true,
      isAdmin: true,
      qrCodeUrl: true,
      createdAt: true,
    },
  });

  return NextResponse.json(users);
}

// PATCH /api/users — update current user's QR code
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const { qrCodeUrl, nickname } = body;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(qrCodeUrl !== undefined && { qrCodeUrl }),
      ...(nickname !== undefined && { nickname: nickname?.trim() || null }),
    },
  });

  return NextResponse.json(user);
}
