import {
  BillingInterval,
  BillingReplacementBehavior,
} from "@shopify/shopify-app-remix/server";
import prisma from "./db.server";
import type { Shop } from "@prisma/client";

export const BILLING_PLANS = {
  TRIAL: "trial",
  MONTHLY: "monthly",
} as const;

export const MONTHLY_PRICE = 9.99;
export const TRIAL_DAYS = 7;

/**
 * Check if a shop is a test/development store
 * Test stores should bypass billing requirements
 */
export async function isTestStore(
  admin: any,
  shopDomain: string,
): Promise<boolean> {
  try {
    const response = await admin.graphql(`
      query {
        shop {
          plan {
            displayName
            partnerDevelopment
          }
        }
      }
    `);

    const data = await response.json();
    const plan = data?.data?.shop?.plan;

    // Check if it's a partner development store or development plan
    if (plan?.partnerDevelopment || plan?.displayName?.toLowerCase().includes("development")) {
      return true;
    }

    // Also check if shop domain contains test indicators
    // Development stores often have specific patterns
    if (
      shopDomain.includes(".myshopify.com") &&
      (shopDomain.includes("dev-") ||
        shopDomain.includes("test-") ||
        shopDomain.includes("staging-"))
    ) {
      return true;
    }

    return false;
  } catch (error) {
    // If we can't determine, default to false (require billing)
    console.error("Error checking test store status:", error);
    return false;
  }
}

/**
 * Check if a shop is currently on trial
 */
export function isOnTrial(shop: {
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  billingActive: boolean;
}): boolean {
  if (!shop.trialStartDate || !shop.trialEndDate) {
    return false;
  }

  const now = new Date();
  const trialStart = shop.trialStartDate instanceof Date
    ? shop.trialStartDate
    : new Date(shop.trialStartDate);
  const trialEnd = shop.trialEndDate instanceof Date
    ? shop.trialEndDate
    : new Date(shop.trialEndDate);

  return now >= trialStart && now <= trialEnd && !shop.billingActive;
}

/**
 * Check if a shop has active billing (trial or subscription)
 */
export function hasActiveBilling(shop: {
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  billingActive: boolean;
  subscriptionEndDate: Date | null;
}): boolean {
  // Check if on active trial
  if (isOnTrial(shop)) {
    return true;
  }

  // Check if has active subscription
  if (shop.billingActive) {
    if (!shop.subscriptionEndDate) {
      return true; // No end date means active
    }
    const subEnd = shop.subscriptionEndDate instanceof Date
      ? shop.subscriptionEndDate
      : new Date(shop.subscriptionEndDate);
    return new Date() <= subEnd;
  }

  return false;
}

/**
 * Get billing configuration for Shopify
 * Follows Shopify billing guidelines: https://shopify.dev/docs/apps/launch/billing
 */
export function getBillingConfig() {
  return {
    [BILLING_PLANS.MONTHLY]: {
      amount: MONTHLY_PRICE,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days,
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      // Configure 7-day free trial as per Shopify guidelines
      // Free trials delay the start of billing cycle
      trialDays: TRIAL_DAYS,
    },
  };
}

/**
 * Initialize trial for a new shop
 */
export async function initializeTrial(shopId: string) {
  const now = new Date();
  const trialEndDate = new Date(now);
  trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);

  return prisma.shop.update({
    where: { id: shopId },
    data: {
      trialStartDate: now,
      trialEndDate: trialEndDate,
      billingActive: false,
      billingPlan: BILLING_PLANS.TRIAL,
      billingLastCheckedAt: now,
    },
  });
}

/**
 * Update shop billing status after subscription
 */
export async function updateShopBilling(
  shopId: string,
  data: {
    billingActive: boolean;
    billingSubscriptionId?: string | null;
    billingPlan?: string;
    subscriptionStartDate?: Date | null;
    subscriptionEndDate?: Date | null;
  }
) {
  return prisma.shop.update({
    where: { id: shopId },
    data: {
      ...data,
      billingLastCheckedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}
