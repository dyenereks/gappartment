import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/expenses/[id]/shares/[shareId]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { shareId } = await params;
  const body = await req.json();
  const { action, proofUrl } = body;

  const share = await prisma.expenseShare.findUnique({
    where: { id: shareId },
    include: { expense: { include: { addedBy: true } } },
  });

  if (!share) return new NextResponse("Not found", { status: 404 });

  if (action === "submit_proof") {
    if (share.userId !== userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const updated = await prisma.expenseShare.update({
      where: { id: shareId },
      data: { proofUrl, paidAt: new Date() },
      include: {
        user: { select: { id: true, name: true, nickname: true, imageUrl: true } },
        confirmedBy: { select: { id: true, name: true, nickname: true } },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "confirm_payment") {
    if (share.expense.addedById !== userId) {
      return new NextResponse("Forbidden — only the expense creator can confirm", { status: 403 });
    }
    const updated = await prisma.expenseShare.update({
      where: { id: shareId },
      data: { isPaid: true, confirmedAt: new Date(), confirmedById: userId },
      include: {
        user: { select: { id: true, name: true, nickname: true, imageUrl: true } },
        confirmedBy: { select: { id: true, name: true, nickname: true } },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "reject_payment") {
    if (share.expense.addedById !== userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const updated = await prisma.expenseShare.update({
      where: { id: shareId },
      data: { proofUrl: null, paidAt: null },
      include: {
        user: { select: { id: true, name: true, nickname: true, imageUrl: true } },
        confirmedBy: { select: { id: true, name: true, nickname: true } },
      },
    });
    return NextResponse.json(updated);
  }

  return new NextResponse("Invalid action", { status: 400 });
}
