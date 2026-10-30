import type { Prisma } from "@prisma/client";

export async function notifyUser(
  tx: Prisma.TransactionClient,
  userId: string,
  title: string,
  body: string,
) {
  await tx.notification.create({ data: { userId, title, body } });
}

export async function notifyCompanyRecruiters(
  tx: Prisma.TransactionClient,
  companyId: string,
  title: string,
  body: string,
) {
  const members = await tx.companyMember.findMany({ where: { companyId }, select: { userId: true } });
  const userIds = Array.from(new Set(members.map((member) => member.userId)));
  if (userIds.length) await tx.notification.createMany({ data: userIds.map((userId) => ({ userId, title, body })) });
}
