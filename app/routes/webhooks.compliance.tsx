import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Handles all mandatory compliance webhooks:
 * - customers/data_request: Requests to view stored customer data
 * - customers/redact: Requests to delete customer data
 * - shop/redact: Requests to delete shop data
 * 
 * Reference: https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // authenticate.webhook() verifies HMAC signature automatically
    // Returns 401 if HMAC is invalid
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    // Handle customers/data_request
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
    // Handle customers/redact
    else if (topic === "CUSTOMERS_REDACT" || topic === "customers/redact") {
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
    // Handle shop/redact
    else if (topic === "SHOP_REDACT" || topic === "shop/redact") {
      const data = payload as {
        shop_id: number;
        shop_domain: string;
      };

      // Find the shop
      const shopRecord = await db.shop.findUnique({
        where: { shopDomain: data.shop_domain },
      });

      if (!shopRecord) {
        console.log(`Shop ${data.shop_domain} not found in database`);
        return new Response(null, { status: 200 });
      }

      // Delete all shop-related data
      // Note: Due to cascade deletes in Prisma schema, deleting the shop will
      // automatically delete disputes and dispute responses
      
      // First, delete all dispute responses
      await db.disputeResponse.deleteMany({
        where: { shopId: shopRecord.id },
      });

      // Then delete all disputes
      await db.dispute.deleteMany({
        where: { shopId: shopRecord.id },
      });

      // Delete all sessions for this shop
      await db.session.deleteMany({
        where: { shop: data.shop_domain },
      });

      // Finally, delete the shop record
      await db.shop.delete({
        where: { id: shopRecord.id },
      });

      console.log(`Redacted all data for shop ${data.shop_domain}`);
    }

    // Return 200 to acknowledge receipt (required by Shopify)
    return new Response(null, { status: 200 });
  } catch (error) {
    // authenticate.webhook() throws if HMAC is invalid
    // Return 401 as required by Shopify
    if (error instanceof Error && (error.message.includes("HMAC") || error.message.includes("Unauthorized"))) {
      console.error("Invalid HMAC signature");
      return new Response("Unauthorized", { status: 401 });
    }

    // Log other errors but still return 200 to acknowledge receipt
    // (Shopify requires 200 series status codes)
    console.error("Error processing compliance webhook:", error);
    return new Response(null, { status: 200 });
  }
};

