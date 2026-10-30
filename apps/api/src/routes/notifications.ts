import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { notFound } from "../errors.js";
import { authenticate } from "../middleware/auth.js";
import { requestBody, routeParam } from "../middleware/validate.js";

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get("/", async (request, response) => {
  const userId = request.auth!.userId;
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  response.json({ notifications, unreadCount });
});

notificationsRouter.patch("/read-all", async (request, response) => {
  const result = await prisma.notification.updateMany({
    where: { userId: request.auth!.userId, readAt: null }, data: { readAt: new Date() },
  });
  response.json({ updated: result.count });
});

notificationsRouter.patch("/:id", async (request, response) => {
  const input = requestBody(request, z.object({ read: z.boolean() }));
  const userId = request.auth!.userId;
  const id = routeParam(request, "id");
  const existing = await prisma.notification.findFirst({ where: { id, userId } });
  if (!existing) throw notFound("Notification not found.");
  const notification = await prisma.notification.update({
    where: { id: existing.id }, data: { readAt: input.read ? existing.readAt ?? new Date() : null },
  });
  response.json({ notification });
});
