import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Badge,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getDisputeById } from "../models.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const disputeId = params.id;

  if (!disputeId) {
    throw new Response("Dispute ID is required", { status: 400 });
  }

  const dispute = await getDisputeById(disputeId);

  if (!dispute) {
    throw new Response("Dispute not found", { status: 404 });
  }

  return { dispute };
};

export default function DisputeDetail() {
  const { dispute } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title={`Dispute ${dispute.shopifyDisputeId}`} />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <InlineStack align="end">
              <Link to="/app">
                <Button>Back to Disputes</Button>
              </Link>
            </InlineStack>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Dispute Details
                </Text>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Shopify Dispute ID:
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {dispute.shopifyDisputeId}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Order:
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {dispute.orderName || dispute.orderId || "-"}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Customer Email:
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {dispute.customerEmail || "-"}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Status:
                    </Text>
                    {dispute.status ? (
                      <Badge
                        status={
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
                      <Text as="span" variant="bodyMd">
                        -
                      </Text>
                    )}
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Reason:
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {dispute.reason || "-"}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Chargeback Reason:
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {dispute.chargebackReason || "-"}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Amount:
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {dispute.amount && dispute.currency
                        ? `${dispute.currency} ${dispute.amount.toString()}`
                        : "-"}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Evidence Due By:
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {dispute.evidenceDueBy
                        ? new Date(dispute.evidenceDueBy).toLocaleString()
                        : "-"}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Evidence Submitted:
                    </Text>
                    {dispute.evidenceSubmitted ? (
                      <Badge status="success">Yes</Badge>
                    ) : (
                      <Badge>No</Badge>
                    )}
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Created At:
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {new Date(dispute.createdAt).toLocaleString()}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Updated At:
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {new Date(dispute.updatedAt).toLocaleString()}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Raw Payload
                </Text>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    This is placeholder content showing the raw webhook payload.
                  </Text>
                  <pre
                    style={{
                      padding: "16px",
                      background: "#f6f6f7",
                      borderRadius: "8px",
                      overflow: "auto",
                      fontSize: "12px",
                    }}
                  >
                    <code>
                      {JSON.stringify(dispute.rawPayload, null, 2)}
                    </code>
                  </pre>
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

