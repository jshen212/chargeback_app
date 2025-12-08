import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Handles CUSTOMERS_REDACT webhook
 * 
 * When a store owner requests customer data deletion, Shopify sends this webhook.
 * The app must delete or redact the requested customer data.
 * 
 * Reference: https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#customersredact
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // authenticate.webhook() verifies HMAC signature automatically
    // Returns 401 if HMAC is invalid
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    // Handle both topic name formats
    if (topic === "CUSTOMERS_REDACT" || topic === "customers/redact") {
      const data = payload as {
        shop_id: number;
        shop_domain: string;
        customer: {
          id: number;
          email?: string;
          phone?: string;
        };
        orders_to_redact?: number[];
      };

      // Find the shop
      const shopRecord = await db.shop.findUnique({
        where: { shopDomain: data.shop_domain },
      });

      if (!shopRecord) {
        // Shop not found, but still return 200 to acknowledge receipt
        console.log(`Shop ${data.shop_domain} not found in database`);
        return new Response(null, { status: 200 });
      }

      // Redact customer data from disputes
      // Delete dispute responses associated with orders to redact
      if (data.orders_to_redact && data.orders_to_redact.length > 0) {
        const disputes = await db.dispute.findMany({
          where: {
            shopId: shopRecord.id,
            orderId: { in: data.orders_to_redact.map(String) },
          },
        });

        // Delete dispute responses for these disputes
        const disputeIds = disputes.map((d) => d.id);
        if (disputeIds.length > 0) {
          await db.disputeResponse.deleteMany({
            where: { disputeId: { in: disputeIds } },
          });
        }

        // Redact customer email from disputes (set to null)
        await db.dispute.updateMany({
          where: {
            shopId: shopRecord.id,
            orderId: { in: data.orders_to_redact.map(String) },
          },
          data: {
            customerEmail: null,
          },
        });
      }

      // Redact customer email from disputes if customer email is provided
      if (data.customer.email) {
        await db.dispute.updateMany({
          where: {
            shopId: shopRecord.id,
            customerEmail: data.customer.email,
          },
          data: {
            customerEmail: null,
          },
        });
      }

      // Delete sessions for this customer email
      if (data.customer.email) {
        await db.session.deleteMany({
          where: {
            shop: data.shop_domain,
            email: data.customer.email,
          },
        });
      }

      console.log(`Redacted customer data for customer ${data.customer.id} in shop ${data.shop_domain}`);
    }

    // Return 200 to acknowledge receipt
    return new Response(null, { status: 200 });
  } catch (error) {
    // authenticate.webhook() throws if HMAC is invalid
    // Return 401 as required by Shopify
    if (error instanceof Error && error.message.includes("HMAC")) {
      console.error("Invalid HMAC signature");
      return new Response("Unauthorized", { status: 401 });
    }

    // Log other errors but still return 200 to acknowledge receipt
    // (Shopify requires 200 series status codes)
    console.error("Error processing redact webhook:", error);
    return new Response(null, { status: 200 });
  }
};

