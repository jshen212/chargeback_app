import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "../models.server";
import { updateShopBilling, BILLING_PLANS } from "../billing.server";

/**
 * Handles APP_SUBSCRIPTIONS_UPDATE webhook
 * This webhook is triggered when:
 * - A subscription is created
 * - A subscription status changes
 * - A subscription's capped amount changes
 * 
 * Reference: https://shopify.dev/docs/apps/launch/billing#webhook-topics
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (topic === "APP_SUBSCRIPTIONS_UPDATE") {
    const subscription = payload as {
      id: string;
      name: string;
      status: string;
      created_at: string;
      updated_at: string;
      current_period_end?: string;
      trial_days?: number;
    };

    const shopRecord = await getOrCreateShop(shop);

    // Update shop billing status based on subscription
    await updateShopBilling(shopRecord.id, {
      billingActive: subscription.status === "ACTIVE",
      billingSubscriptionId: subscription.id,
      billingPlan: BILLING_PLANS.MONTHLY,
      subscriptionStartDate: new Date(subscription.created_at),
      subscriptionEndDate: subscription.current_period_end
        ? new Date(subscription.current_period_end)
        : null,
    });
  }

  return new Response();
};

