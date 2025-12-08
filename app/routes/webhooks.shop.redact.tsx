import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Handles SHOP_REDACT webhook
 * 
 * 48 hours after a store owner uninstalls the app, Shopify sends this webhook.
 * The app must delete all data associated with that shop.
 * 
 * Reference: https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#shopredact
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // authenticate.webhook() verifies HMAC signature automatically
    // Returns 401 if HMAC is invalid
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    // Handle both topic name formats
    if (topic === "SHOP_REDACT" || topic === "shop/redact") {
      const data = payload as {
        shop_id: number;
        shop_domain: string;
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
    console.error("Error processing shop redact webhook:", error);
    return new Response(null, { status: 200 });
  }
};

