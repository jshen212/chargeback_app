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
import { syncDisputes, syncChargebacks } from "../disputes.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Sync chargebacks from Shopify (these occur before disputes are created)
  try {
    await syncChargebacks(admin, session.shop);
  } catch (error) {
    console.error("Error syncing chargebacks:", error);
    // Continue even if chargeback sync fails
  }

  // Sync disputes from Shopify to ensure we have the latest data
  try {
    await syncDisputes(admin, session.shop);
  } catch (error) {
    console.error("Error syncing disputes:", error);
    // Continue to show existing disputes even if sync fails
  }

  // Get disputes from database (this includes both chargebacks and disputes)
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
