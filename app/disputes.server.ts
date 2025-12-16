import prisma from "./db.server";
import { getOrCreateShop } from "./models.server";

/**
 * Fetch disputes from Shopify Payments using GraphQL Admin API
 *
 * There are two approaches:
 * 1. Query shopifyPaymentsDisputes directly (if available)
 * 2. Query orders with disputes field
 *
 * Reference: https://shopify.dev/docs/api/admin-graphql/latest/queries/shopifyPaymentsDisputes
 */
export async function fetchDisputesFromShopify(admin: any, shopDomain: string) {
  // Try the direct shopifyPaymentsDisputes query first
  const directQuery = `
    query {
      shopifyPaymentsDisputes(first: 250) {
        edges {
          node {
            id
            amount {
              amount
              currencyCode
            }
            createdAt
            evidenceDueBy
            reason
            status
            type
            order {
              id
              name
              email
            }
            inquiry {
              id
            }
          }
        }
      }
    }
  `;

  // Fallback: Query orders with disputes
  const ordersQuery = `
    query {
      orders(first: 250, query: "financial_status:any") {
        edges {
          node {
            id
            name
            email
            disputes {
              id
              amount {
                amount
                currencyCode
              }
              createdAt
              evidenceDueBy
              reason
              status
              type
            }
          }
        }
      }
    }
  `;

  try {
    let data: any;
    let disputes: any[] = [];

    // Try direct query first
    try {
      const response = await admin.graphql(directQuery);
      data = await response.json();

      if (data.errors) {
        console.warn(
          "Direct disputes query failed, trying orders query:",
          data.errors,
        );
        throw new Error("Direct query failed");
      }

      disputes = data.data?.shopifyPaymentsDisputes?.edges || [];
    } catch (directError) {
      // Fallback to orders query
      console.log("Using orders query as fallback");
      const response = await admin.graphql(ordersQuery);
      data = await response.json();

      if (data.errors) {
        console.error("GraphQL errors:", data.errors);
        throw new Error(
          `Failed to fetch disputes: ${JSON.stringify(data.errors)}`,
        );
      }

      // Extract disputes from orders
      const orders = data.data?.orders?.edges || [];
      disputes = [];
      for (const orderEdge of orders) {
        const order = orderEdge.node;
        if (order.disputes && order.disputes.length > 0) {
          for (const dispute of order.disputes) {
            disputes.push({
              node: {
                ...dispute,
                order: {
                  id: order.id,
                  name: order.name,
                  email: order.email,
                },
              },
            });
          }
        }
      }
    }

    const shop = await getOrCreateShop(shopDomain);

    // Process and store each dispute
    const savedDisputes = [];
    for (const edge of disputes) {
      const dispute = edge.node;

      // Extract dispute ID (format: gid://shopify/ShopifyPaymentsDispute/123456)
      const disputeId =
        dispute.id?.split("/").pop() || dispute.id || `unknown-${Date.now()}`;

      // Extract order ID and name
      const orderId = dispute.order?.id?.split("/").pop() || null;
      const orderName = dispute.order?.name || null;
      const customerEmail = dispute.order?.email || null;

      // Save or update dispute in database
      const savedDispute = await prisma.dispute.upsert({
        where: {
          shopId_shopifyDisputeId: {
            shopId: shop.id,
            shopifyDisputeId: disputeId,
          },
        },
        update: {
          orderId: orderId,
          orderName: orderName,
          customerEmail: customerEmail,
          status: dispute.status?.toLowerCase() || null,
          reason: dispute.reason || null,
          chargebackReason: dispute.type || null,
          amount: dispute.amount?.amount
            ? parseFloat(dispute.amount.amount)
            : null,
          currency: dispute.amount?.currencyCode || null,
          evidenceDueBy: dispute.evidenceDueBy
            ? new Date(dispute.evidenceDueBy)
            : null,
          rawPayload: dispute as any,
          updatedAt: new Date(),
        },
        create: {
          shopId: shop.id,
          shopifyDisputeId: disputeId,
          orderId: orderId,
          orderName: orderName,
          customerEmail: customerEmail,
          status: dispute.status?.toLowerCase() || null,
          reason: dispute.reason || null,
          chargebackReason: dispute.type || null,
          amount: dispute.amount?.amount
            ? parseFloat(dispute.amount.amount)
            : null,
          currency: dispute.amount?.currencyCode || null,
          evidenceDueBy: dispute.evidenceDueBy
            ? new Date(dispute.evidenceDueBy)
            : null,
          rawPayload: dispute as any,
        },
      });

      savedDisputes.push(savedDispute);
    }

    return savedDisputes;
  } catch (error) {
    console.error("Error fetching disputes from Shopify:", error);
    throw error;
  }
}

/**
 * Sync disputes from Shopify to the database
 * This should be called periodically or when the disputes page loads
 */
export async function syncDisputes(admin: any, shopDomain: string) {
  try {
    const disputes = await fetchDisputesFromShopify(admin, shopDomain);
    return disputes;
  } catch (error) {
    console.error("Error syncing disputes:", error);
    // Return empty array on error so the app can still show existing disputes
    return [];
  }
}
