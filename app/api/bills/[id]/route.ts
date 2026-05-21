import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/bills/[id] — admin only
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
  const { type, amount, month, dueDate, description, receiverId, shares } = body;

  if (!type || !amount || !month || !receiverId) {
    return new NextResponse("Missing required fields", { status: 400 });
  }

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: { shares: true },
  });
  if (!bill) return new NextResponse("Not found", { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    if (shares && Array.isArray(shares)) {
      const incomingShares = shares as { userId: string; amount: number; isPaid?: boolean }[];
      const incomingIds = new Set(incomingShares.map((s) => s.userId));
      const existingById = new Map(bill.shares.map((s) => [s.userId, s]));

      // Delete shares for removed tenants
      const toDelete = bill.shares
        .filter((s) => !incomingIds.has(s.userId))
        .map((s) => s.id);
      if (toDelete.length > 0) {
        await tx.billShare.deleteMany({ where: { id: { in: toDelete } } });
      }

      // Update existing or create new shares
      for (const s of incomingShares) {
        const existing = existingById.get(s.userId);

        // Resolve paid-state transitions only when isPaid is explicitly provided
        let paidFields: Record<string, unknown> = {};
        if (s.isPaid !== undefined) {
          const currentlyPaid = existing?.isPaid ?? false;
          if (s.isPaid && !currentlyPaid) {
            paidFields = {
              isPaid: true,
              paidAt: new Date(),
              confirmedAt: new Date(),
              confirmedById: userId,
            };
          } else if (!s.isPaid && currentlyPaid) {
            paidFields = {
              isPaid: false,
              paidAt: null,
              confirmedAt: null,
              confirmedById: null,
            };
          }
        }

        if (existing) {
          await tx.billShare.updateMany({
            where: { billId: id, userId: s.userId },
            data: { amount: s.amount, ...paidFields },
          });
        } else {
          await tx.billShare.create({
            data: {
              billId: id,
              userId: s.userId,
              amount: s.amount,
              ...paidFields,
            },
          });
        }
      }
    } else {
      const shareAmount = bill.shares.length > 0 ? amount / bill.shares.length : 0;
      await tx.billShare.updateMany({
        where: { billId: id },
        data: { amount: shareAmount },
      });
    }

    return tx.bill.update({
      where: { id },
      data: {
        type,
        amount,
        month,
        dueDate: dueDate ? new Date(dueDate) : null,
        description: description ?? null,
        receiverId,
      },
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
    });
  });

  return NextResponse.json(updated);
}
