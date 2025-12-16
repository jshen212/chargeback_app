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

      console.log("data", data);

      if (data.errors) {
        console.warn(
          "Direct disputes query failed, trying orders query:",
          data.errors,
        );
        throw new Error("Direct query failed");
      }

      disputes = data.data?.shopifyPaymentsDisputes?.edges || [];

      console.log("disputes", disputes);
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
 * Fetch chargebacks from Shopify by querying transactions with kind="chargeback"
 * Chargebacks occur before disputes are created - they appear as transactions on orders
 *
 * Reference: https://shopify.dev/docs/api/admin-graphql/latest/objects/Transaction
 */
export async function fetchChargebacksFromShopify(
  admin: any,
  shopDomain: string,
) {
  console.log("fetchChargebacksFromShopify", fetchChargebacksFromShopify);
  const chargebackQuery = `
    query {
      orders(first: 250, query: "financial_status:any", sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            email
            createdAt
            transactions(first: 50) {
              id
              kind
              status
              amount
              currencyCode
              createdAt
              gateway
              test
              parentTransaction {
                id
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(chargebackQuery);
    const data = await response.json();

    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      throw new Error(
        `Failed to fetch chargebacks: ${JSON.stringify(data.errors)}`,
      );
    }

    const orders = data.data?.orders?.edges || [];
    const shop = await getOrCreateShop(shopDomain);

    // Process orders and extract chargeback transactions
    const chargebacks = [];
    for (const orderEdge of orders) {
      const order = orderEdge.node;
      const transactions = order.transactions || [];

      // Find chargeback transactions
      for (const transaction of transactions) {
        if (
          transaction.kind === "CHARGEBACK" ||
          transaction.kind === "chargeback"
        ) {
          // Extract IDs
          const orderId = order.id?.split("/").pop() || null;
          const orderName = order.name || null;
          const customerEmail = order.email || null;
          const transactionId =
            transaction.id?.split("/").pop() || transaction.id;

          // Create a chargeback record (we'll store it as a dispute with a special flag)
          // or you could create a separate Chargeback model
          const chargebackData = {
            shopifyDisputeId: `chargeback-${transactionId}`, // Prefix to distinguish from disputes
            orderId: orderId,
            orderName: orderName,
            customerEmail: customerEmail,
            status: transaction.status?.toLowerCase() || "open",
            reason: "chargeback", // Chargeback reason would need to be fetched separately
            chargebackReason: transaction.kind,
            amount: transaction.amount ? parseFloat(transaction.amount) : null,
            currency: transaction.currencyCode || null,
            evidenceDueBy: null, // Chargebacks don't have evidence due dates until they become disputes
            rawPayload: {
              transaction,
              order: {
                id: order.id,
                name: order.name,
                email: order.email,
                createdAt: order.createdAt,
              },
            },
          };

          // Save or update chargeback in database
          // Note: You might want to create a separate Chargeback model instead
          const savedChargeback = await prisma.dispute.upsert({
            where: {
              shopId_shopifyDisputeId: {
                shopId: shop.id,
                shopifyDisputeId: chargebackData.shopifyDisputeId,
              },
            },
            update: {
              orderId: chargebackData.orderId,
              orderName: chargebackData.orderName,
              customerEmail: chargebackData.customerEmail,
              status: chargebackData.status,
              reason: chargebackData.reason,
              chargebackReason: chargebackData.chargebackReason,
              amount: chargebackData.amount,
              currency: chargebackData.currency,
              evidenceDueBy: chargebackData.evidenceDueBy,
              rawPayload: chargebackData.rawPayload as any,
              updatedAt: new Date(),
            },
            create: {
              shopId: shop.id,
              shopifyDisputeId: chargebackData.shopifyDisputeId,
              orderId: chargebackData.orderId,
              orderName: chargebackData.orderName,
              customerEmail: chargebackData.customerEmail,
              status: chargebackData.status,
              reason: chargebackData.reason,
              chargebackReason: chargebackData.chargebackReason,
              amount: chargebackData.amount,
              currency: chargebackData.currency,
              evidenceDueBy: chargebackData.evidenceDueBy,
              rawPayload: chargebackData.rawPayload as any,
            },
          });

          chargebacks.push(savedChargeback);
        }
      }
    }

    console.log("chargebacks", chargebacks);
    return chargebacks;
  } catch (error) {
    console.error("Error fetching chargebacks from Shopify:", error);
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

/**
 * Sync chargebacks from Shopify to the database
 * Chargebacks are transactions that occur before disputes are created
 */
export async function syncChargebacks(admin: any, shopDomain: string) {
  try {
    const chargebacks = await fetchChargebacksFromShopify(admin, shopDomain);
    return chargebacks;
  } catch (error) {
    console.error("Error syncing chargebacks:", error);
    // Return empty array on error so the app can still show existing chargebacks
    return [];
  }
}
