import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/expenses/[id] — admin only
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.isAdmin) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { title, description, amount, month, markMyShareAsPaid } = body;

  if (!title || !amount || !month) {
    return new NextResponse("Missing required fields", { status: 400 });
  }

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { shares: true },
  });
  if (!expense) return new NextResponse("Not found", { status: 404 });

  const shareCount = expense.shares.length;
  const shareAmount = shareCount > 0 ? amount / shareCount : 0;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.expenseShare.updateMany({
      where: { expenseId: id },
      data: { amount: shareAmount },
    });

    // Toggle the requesting user's own share paid state, if requested
    if (markMyShareAsPaid !== undefined) {
      const myShare = expense.shares.find((s) => s.userId === userId);
      if (myShare) {
        const currentlyPaid = myShare.isPaid;
        if (markMyShareAsPaid && !currentlyPaid) {
          await tx.expenseShare.update({
            where: { id: myShare.id },
            data: {
              isPaid: true,
              paidAt: new Date(),
              confirmedAt: new Date(),
              confirmedById: userId,
            },
          });
        } else if (!markMyShareAsPaid && currentlyPaid) {
          await tx.expenseShare.update({
            where: { id: myShare.id },
            data: {
              isPaid: false,
              paidAt: null,
              confirmedAt: null,
              confirmedById: null,
            },
          });
        }
      }
    }

    return tx.expense.update({
      where: { id },
      data: { title, description: description ?? null, amount, month },
      include: {
        addedBy: { select: { id: true, name: true, nickname: true, imageUrl: true, qrCodeUrl: true } },
        shares: {
          include: {
            user: { select: { id: true, name: true, nickname: true, imageUrl: true } },
            confirmedBy: { select: { id: true, name: true, nickname: true } },
          },
        },
      },
    });
  });

  return NextResponse.json(updated);
}
