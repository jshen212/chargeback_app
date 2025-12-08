import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useFetcher, redirect } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  TextField,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getDisputeById, createDisputeResponse } from "../models.server";
import { generateDisputeResponse } from "../openai.server";
import { isTestStore } from "../billing.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { billing, admin, session } = await authenticate.admin(request);

  // Check if this is a test store - bypass billing for test stores
  const testStore = await isTestStore(admin, session.shop);

  if (!testStore) {
    // Gate this route - require active billing per Shopify guidelines
    try {
      await (billing.require as any)({
        plans: ["monthly"],
        isTest: process.env.NODE_ENV !== "production",
        onFailure: () => {
          throw new Response(null, {
            status: 302,
            headers: {
              Location: "/app/billing",
            },
          });
        },
      });
    } catch (error) {
      if (error instanceof Response) {
        throw error;
      }
      throw new Response(null, {
        status: 302,
        headers: {
          Location: "/app/billing",
        },
      });
    }
  }

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

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { billing, admin, session } = await authenticate.admin(request);

  // Check if this is a test store - bypass billing for test stores
  const testStore = await isTestStore(admin, session.shop);

  if (!testStore) {
    // Gate this route - require active billing per Shopify guidelines
    try {
      await (billing.require as any)({
        plans: ["monthly"],
        isTest: process.env.NODE_ENV !== "production",
        onFailure: () => {
          throw new Response(null, {
            status: 302,
            headers: {
              Location: "/app/billing",
            },
          });
        },
      });
    } catch (error) {
      if (error instanceof Response) {
        throw error;
      }
      throw new Response(null, {
        status: 302,
        headers: {
          Location: "/app/billing",
        },
      });
    }
  }

  const disputeId = params.id;

  if (!disputeId) {
    throw new Response("Dispute ID is required", { status: 400 });
  }

  const dispute = await getDisputeById(disputeId);

  if (!dispute) {
    throw new Response("Dispute not found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "generate") {
    try {
      const responseText = await generateDisputeResponse({
        shopifyDisputeId: dispute.shopifyDisputeId,
        orderName: dispute.orderName,
        customerEmail: dispute.customerEmail,
        status: dispute.status,
        reason: dispute.reason,
        chargebackReason: dispute.chargebackReason,
        amount: dispute.amount ? Number(dispute.amount) : null,
        currency: dispute.currency,
        rawPayload: dispute.rawPayload,
      });

      return { success: true, responseText, error: null };
    } catch (error) {
      return {
        success: false,
        responseText: null,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate response",
      };
    }
  }

  if (intent === "save") {
    const draftText = formData.get("draftText") as string;

    if (!draftText || draftText.trim() === "") {
      return {
        success: false,
        error: "Response text cannot be empty",
      };
    }

    try {
      await createDisputeResponse({
        disputeId: dispute.id,
        shopId: dispute.shopId,
        draftText: draftText.trim(),
        modelUsed: "gpt-4o-mini",
      });

      // Redirect to reload the page with the new response
      return redirect(`/app/disputes/${disputeId}`);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to save response",
      };
    }
  }

  return { success: false, error: "Invalid action" };
};

export default function DisputeDetail() {
  const { dispute } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const latestResponse = dispute.disputeResponses[0];
  const [responseText, setResponseText] = useState(
    latestResponse?.draftText || "",
  );

  const fetcherResponseText =
    fetcher.data && "responseText" in fetcher.data
      ? fetcher.data.responseText
      : null;
  const fetcherError =
    fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;

  // Update text area when generation completes
  useEffect(() => {
    if (fetcher.data?.success && fetcherResponseText) {
      setResponseText(fetcherResponseText as string);
    }
  }, [fetcher.data, fetcherResponseText]);

  // Show toast notifications
  useEffect(() => {
    if (fetcherError) {
      shopify.toast.show(fetcherError as string, { isError: true });
    }
  }, [fetcherError, shopify]);

  const isGenerating =
    fetcher.state === "submitting" &&
    fetcher.formData?.get("intent") === "generate";
  const isSaving =
    fetcher.state === "submitting" &&
    fetcher.formData?.get("intent") === "save";

  const placeholderText = latestResponse
    ? ""
    : "Click 'Generate a response' to create an AI-powered dispute response. The response will address the chargeback reason and provide relevant evidence.";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(responseText);
      shopify.toast.show("Response copied to clipboard");
    } catch (error) {
      shopify.toast.show("Failed to copy to clipboard", { isError: true });
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      shopify.toast.show("Please allow popups to print", { isError: true });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dispute Response - ${dispute.shopifyDisputeId}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
              line-height: 1.6;
              color: #333;
            }
            h1 {
              color: #202223;
              border-bottom: 2px solid #e1e3e5;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .dispute-info {
              background: #f6f6f7;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .dispute-info p {
              margin: 5px 0;
            }
            .response-content {
              white-space: pre-wrap;
              background: #fff;
              padding: 20px;
              border: 1px solid #e1e3e5;
              border-radius: 8px;
            }
            @media print {
              body {
                margin: 0;
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <h1>Dispute Response</h1>
          <div class="dispute-info">
            <p><strong>Dispute ID:</strong> ${dispute.shopifyDisputeId}</p>
            <p><strong>Order:</strong> ${dispute.orderName || dispute.orderId || "N/A"}</p>
            <p><strong>Customer Email:</strong> ${dispute.customerEmail || "N/A"}</p>
            <p><strong>Status:</strong> ${dispute.status || "N/A"}</p>
            <p><strong>Amount:</strong> ${dispute.amount && dispute.currency ? `${dispute.currency} ${dispute.amount}` : "N/A"}</p>
          </div>
          <div class="response-content">${responseText}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

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
                      <Badge tone="success">Yes</Badge>
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
                  Dispute Response
                </Text>
                <BlockStack gap="300">
                  <TextField
                    label="Response Draft"
                    value={responseText}
                    onChange={setResponseText}
                    multiline={10}
                    autoComplete="off"
                    placeholder={placeholderText}
                    helpText={
                      latestResponse
                        ? "Edit the response below. Click 'Save' to save your changes."
                        : "Generate an AI-powered response or write your own."
                    }
                  />
                  <InlineStack gap="300">
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="generate" />
                      <Button submit loading={isGenerating} variant="primary">
                        Generate a response
                      </Button>
                    </fetcher.Form>
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="save" />
                      <input
                        type="hidden"
                        name="draftText"
                        value={responseText}
                      />
                      <Button
                        submit
                        loading={isSaving}
                        disabled={!responseText.trim()}
                      >
                        Save
                      </Button>
                    </fetcher.Form>
                    {responseText.trim() && (
                      <>
                        <Button onClick={handleCopy}>Copy</Button>
                        <Button onClick={handlePrint}>Print</Button>
                      </>
                    )}
                  </InlineStack>
                  {latestResponse && (
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Last saved:{" "}
                      {new Date(latestResponse.createdAt).toLocaleString()}
                      {latestResponse.modelUsed &&
                        ` (Generated with ${latestResponse.modelUsed})`}
                    </Text>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
