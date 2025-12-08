import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Button,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "../models.server";
import {
  hasActiveBilling,
  isOnTrial,
  BILLING_PLANS,
  MONTHLY_PRICE,
  TRIAL_DAYS,
} from "../billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop, session.accessToken);

  // Check current subscription status using Shopify's billing API
  // This follows Shopify guidelines: https://shopify.dev/docs/apps/launch/billing
  // billing.require() throws if no subscription, so we catch and handle gracefully
  let subscriptionStatus = null;
  let hasActiveSubscription = false;
  
  try {
    const result = await (billing.require as any)({
      plans: ["monthly"],
      isTest: process.env.NODE_ENV !== "production",
      returnObject: true,
    });
    subscriptionStatus = result;
    hasActiveSubscription = true;
  } catch (error) {
    // Subscription not found or not active - this is expected for new shops or during trial
    // billing.require() throws when subscription is not active
    hasActiveSubscription = false;
  }

  // Convert dates from strings to Date objects if needed
  const shopWithDates = {
    ...shop,
    trialStartDate: shop.trialStartDate ? new Date(shop.trialStartDate) : null,
    trialEndDate: shop.trialEndDate ? new Date(shop.trialEndDate) : null,
    subscriptionEndDate: shop.subscriptionEndDate ? new Date(shop.subscriptionEndDate) : null,
  };

  const onTrial = !hasActiveSubscription && isOnTrial(shopWithDates);
  const activeBilling = hasActiveSubscription || hasActiveBilling(shopWithDates);

  const trialDaysRemaining = shopWithDates.trialEndDate
    ? Math.max(0, Math.ceil((shopWithDates.trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    shop: shopWithDates,
    subscriptionStatus,
    onTrial,
    activeBilling,
    trialDaysRemaining,
    hasActiveSubscription,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "subscribe") {
    // Request billing for monthly subscription
    // This follows Shopify billing flow: creates charge → returns confirmationUrl → redirects merchant
    // Reference: https://shopify.dev/docs/apps/launch/billing#billing-process
    return (billing.request as any)({
      plan: "monthly",
      isTest: process.env.NODE_ENV !== "production",
    });
  }

  return null;
};

export default function Billing() {
  const {
    shop,
    subscriptionStatus,
    onTrial,
    activeBilling,
    trialDaysRemaining,
    hasActiveSubscription,
  } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Billing" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Subscription Plan
                </Text>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <BlockStack gap="100">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        Current Plan:
                      </Text>
                      <Text as="span" variant="bodyMd">
                        {onTrial
                          ? `Free Trial (${trialDaysRemaining} days remaining)`
                          : hasActiveSubscription
                            ? "Monthly Subscription"
                            : "No Active Plan"}
                      </Text>
                    </BlockStack>
                    {onTrial && <Badge tone="info">Trial</Badge>}
                    {hasActiveSubscription && (
                      <Badge tone="success">Active</Badge>
                    )}
                    {!activeBilling && <Badge tone="critical">Expired</Badge>}
                  </InlineStack>

                  {onTrial && (
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd">
                        Your {TRIAL_DAYS}-day free trial started on{" "}
                        {shop.trialStartDate
                          ? new Date(shop.trialStartDate).toLocaleDateString()
                          : "N/A"}
                        . You have {trialDaysRemaining} day
                        {trialDaysRemaining !== 1 ? "s" : ""} remaining.
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Subscribe now to continue using the app after your trial
                        ends.
                      </Text>
                    </BlockStack>
                  )}

                  {hasActiveSubscription && (
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd">
                        Your monthly subscription is active. You will be charged
                        ${MONTHLY_PRICE} per month.
                      </Text>
                      {subscriptionStatus?.currentPeriodEnd && (
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Next billing date:{" "}
                          {new Date(
                            subscriptionStatus.currentPeriodEnd,
                          ).toLocaleDateString()}
                        </Text>
                      )}
                      {subscriptionStatus?.trialDays && (
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Trial period: {subscriptionStatus.trialDays} days
                        </Text>
                      )}
                    </BlockStack>
                  )}

                  {!activeBilling && (
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" tone="critical">
                        Your subscription has expired. Please subscribe to
                        continue using the app.
                      </Text>
                    </BlockStack>
                  )}

                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      Monthly Plan
                    </Text>
                    <Text as="p" variant="bodyMd">
                      ${MONTHLY_PRICE} per month
                    </Text>
                    {!hasActiveSubscription && (
                      <Form method="post">
                        <input type="hidden" name="intent" value="subscribe" />
                        <Button submit variant="primary">
                          Subscribe to Monthly Plan
                        </Button>
                      </Form>
                    )}
                  </BlockStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

