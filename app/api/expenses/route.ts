import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/expenses?month=2024-01
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const expenses = await prisma.expense.findMany({
    where: month ? { month } : undefined,
    include: {
      addedBy: { select: { id: true, name: true, nickname: true, imageUrl: true, qrCodeUrl: true } },
      shares: {
        include: {
          user: { select: { id: true, name: true, nickname: true, imageUrl: true } },
          confirmedBy: { select: { id: true, name: true, nickname: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(expenses);
}

// POST /api/expenses — any tenant can add
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const { title, description, amount, month, shares } = body;

  if (!title || !amount || !month || !shares?.length) {
    return new NextResponse("Missing required fields", { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      title,
      description,
      amount,
      month,
      addedById: userId,
      shares: {
        create: shares.map((s: { userId: string; amount: number; isPaid?: boolean }) => ({
          userId: s.userId,
          amount: s.amount,
          ...(s.isPaid
            ? {
                isPaid: true,
                paidAt: new Date(),
                confirmedAt: new Date(),
                confirmedById: userId,
              }
            : {}),
        })),
      },
    },
    include: {
      addedBy: { select: { id: true, name: true, nickname: true, imageUrl: true, qrCodeUrl: true } },
      shares: {
        include: {
          user: { select: { id: true, name: true, nickname: true, imageUrl: true } },
        },
      },
    },
  });

  return NextResponse.json(expense, { status: 201 });
}
