import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/bills?month=2024-01
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const bills = await prisma.bill.findMany({
    where: month ? { month } : undefined,
    include: {
      addedBy: { select: { id: true, name: true, nickname: true, imageUrl: true } },
      receiver: { select: { id: true, name: true, nickname: true, imageUrl: true, qrCodeUrl: true } },
      shares: {
        include: {
          user: { select: { id: true, name: true, nickname: true, imageUrl: true } },
          confirmedBy: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(bills);
}

// POST /api/bills — admin only
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.isAdmin) return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json();
  const { type, amount, month, dueDate, description, receiverId, shares } = body;

  if (!type || !amount || !month || !receiverId) {
    return new NextResponse("Missing required fields", { status: 400 });
  }

  const bill = await prisma.bill.create({
    data: {
      type,
      amount,
      month,
      dueDate: dueDate ? new Date(dueDate) : null,
      description,
      addedById: userId,
      receiverId,
      shares: {
        create: shares.map((s: { userId: string; amount: number }) => ({
          userId: s.userId,
          amount: s.amount,
        })),
      },
    },
    include: {
      addedBy: { select: { id: true, name: true, nickname: true, imageUrl: true } },
      receiver: { select: { id: true, name: true, nickname: true, imageUrl: true, qrCodeUrl: true } },
      shares: {
        include: {
          user: { select: { id: true, name: true, nickname: true, imageUrl: true } },
        },
      },
    },
  });

  return NextResponse.json(bill, { status: 201 });
}
