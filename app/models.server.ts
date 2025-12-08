import prisma from "./db.server";
import type { Dispute, Prisma, Shop } from "@prisma/client";

export async function getOrCreateShop(
  shopDomain: string,
  accessToken?: string,
): Promise<Shop> {
  return prisma.shop.upsert({
    where: { shopDomain },
    update: {
      accessToken: accessToken,
      active: true,
      updatedAt: new Date(),
    },
    create: {
      shopDomain,
      accessToken: accessToken,
      active: true,
    },
  });
}

export async function getDisputes(shopDomain: string) {
  // First get or create the shop by domain
  const shop = await getOrCreateShop(shopDomain);

  // Get disputes for this shop
  return prisma.dispute.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDisputeById(disputeId: string) {
  return prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      shop: true,
      disputeResponses: {
        orderBy: { createdAt: "desc" },
        take: 1, // Get the most recent response
      },
    },
  });
}

export async function getLatestDisputeResponse(disputeId: string) {
  return prisma.disputeResponse.findFirst({
    where: { disputeId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDisputeResponse(data: {
  disputeId: string;
  shopId: string;
  draftText: string;
  modelUsed?: string;
}) {
  return prisma.disputeResponse.create({
    data: {
      disputeId: data.disputeId,
      shopId: data.shopId,
      draftText: data.draftText,
      modelUsed: data.modelUsed,
      isFinal: false,
    },
  });
}
