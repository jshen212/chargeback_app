import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Link,
  DataTable,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getDisputes } from "../models.server";
import { isTestStore } from "../billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing, admin } = await authenticate.admin(request);

  // Check if this is a test store - bypass billing for test stores
  const testStore = await isTestStore(admin, session.shop);
  
  if (!testStore) {
    // Gate this route - require active billing per Shopify guidelines
    // https://shopify.dev/docs/apps/launch/billing#gate-requests
    // billing.require() will redirect to billing page if no active subscription
    try {
      await (billing.require as any)({
        plans: ["monthly"],
        isTest: process.env.NODE_ENV !== "production",
        onFailure: () => {
          // Redirect to billing page if no active subscription
          throw new Response(null, {
            status: 302,
            headers: {
              Location: "/app/billing",
            },
          });
        },
      });
    } catch (error) {
      // If it's a redirect response, rethrow it
      if (error instanceof Response) {
        throw error;
      }
      // Otherwise redirect to billing page
      throw new Response(null, {
        status: 302,
        headers: {
          Location: "/app/billing",
        },
      });
    }
  }

  const disputes = await getDisputes(session.shop);

  return { disputes };
};

export default function Index() {
  const { disputes } = useLoaderData<typeof loader>();

  const disputeRows = disputes.map((dispute) => [
    <Link key={dispute.id} url={`/app/disputes/${dispute.id}`} removeUnderline>
      {dispute.shopifyDisputeId}
    </Link>,
    dispute.orderName || dispute.orderId || "-",
    dispute.customerEmail || "-",
    dispute.status ? (
      <Badge
        tone={
          dispute.status === "won"
            ? "success"
            : dispute.status === "lost"
              ? "critical"
              : "info"
        }
      >
        {dispute.status}
      </Badge>
    ) : (
      "-"
    ),
    dispute.amount && dispute.currency
      ? `${dispute.currency} ${dispute.amount.toString()}`
      : "-",
    dispute.evidenceDueBy
      ? new Date(dispute.evidenceDueBy).toLocaleDateString()
      : "-",
    dispute.evidenceSubmitted ? (
      <Badge tone="success">Submitted</Badge>
    ) : (
      <Badge>Pending</Badge>
    ),
  ]);

  return (
    <Page>
      <TitleBar title="Disputes" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingMd">
                  Disputes
                </Text>
                {disputes.length === 0 ? (
                  <Text as="p" variant="bodyMd">
                    No disputes found.
                  </Text>
                ) : (
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "text",
                      "text",
                      "text",
                      "text",
                      "text",
                      "text",
                    ]}
                    headings={[
                      "Dispute ID",
                      "Order",
                      "Customer Email",
                      "Status",
                      "Amount",
                      "Evidence Due By",
                      "Evidence Status",
                    ]}
                    rows={disputeRows}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
