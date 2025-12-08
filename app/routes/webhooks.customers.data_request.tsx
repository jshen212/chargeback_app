import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Handles CUSTOMERS_DATA_REQUEST webhook
 * 
 * When a customer requests their data, Shopify sends this webhook.
 * The app must provide the requested customer data to the store owner.
 * 
 * Reference: https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#customersdata_request
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // authenticate.webhook() verifies HMAC signature automatically
    // Returns 401 if HMAC is invalid
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    // Handle both topic name formats
    if (topic === "CUSTOMERS_DATA_REQUEST" || topic === "customers/data_request") {
      const data = payload as {
        shop_id: number;
        shop_domain: string;
        orders_requested?: number[];
        customer: {
          id: number;
          email?: string;
          phone?: string;
        };
        data_request: {
          id: number;
        };
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

      // Collect customer data from disputes
      const disputes = await db.dispute.findMany({
        where: {
          shopId: shopRecord.id,
          ...(data.orders_requested && data.orders_requested.length > 0
            ? { orderId: { in: data.orders_requested.map(String) } }
            : {}),
          ...(data.customer.email
            ? { customerEmail: data.customer.email }
            : {}),
        },
        include: {
          disputeResponses: true,
        },
      });

      // Collect session data if customer email matches
      const sessions = data.customer.email
        ? await db.session.findMany({
            where: {
              shop: data.shop_domain,
              email: data.customer.email,
            },
          })
        : [];

      // Log the data request (in production, you would send this to the store owner)
      console.log(`Data request ${data.data_request.id} for customer ${data.customer.id}:`, {
        disputes: disputes.length,
        sessions: sessions.length,
        orders_requested: data.orders_requested,
      });

      // Note: In a production app, you would:
      // 1. Compile all customer data into a structured format
      // 2. Send it to the store owner via email or admin API
      // 3. Store a record that the request was fulfilled
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
    console.error("Error processing data request webhook:", error);
    return new Response(null, { status: 200 });
  }
};

