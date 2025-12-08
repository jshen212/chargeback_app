import {
  Page,
  Layout,
  Text,
  BlockStack,
  Link,
} from "@shopify/polaris";

/**
 * Terms of Service Page
 * 
 * Generic terms of service for the app.
 */
export default function TermsOfService() {
  return (
    <Page title="Terms of Service">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Text as="h1" variant="heading2xl">
              Terms of Service
            </Text>
            
            <Text as="p" variant="bodyMd">
              <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
            </Text>

            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Acceptance of Terms
              </Text>
              <Text as="p" variant="bodyMd">
                By installing and using this app, you agree to be bound by these Terms of Service. If you do not agree to these Terms, you must not use the app.
              </Text>
            </BlockStack>

            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Description of Service
              </Text>
              <Text as="p" variant="bodyMd">
                This app provides services to help you manage your Shopify store. The specific features and functionality may vary and are subject to change.
              </Text>
            </BlockStack>

            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                User Responsibilities
              </Text>
              <Text as="p" variant="bodyMd">
                You agree to use the app only for lawful purposes and in accordance with these Terms. You are responsible for maintaining the security of your account and for all activities that occur under your account.
              </Text>
            </BlockStack>

            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Intellectual Property
              </Text>
              <Text as="p" variant="bodyMd">
                The app and its content are owned by us and are protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, or create derivative works without our express written permission.
              </Text>
            </BlockStack>

            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Limitation of Liability
              </Text>
              <Text as="p" variant="bodyMd">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES AND SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE APP.
              </Text>
            </BlockStack>

            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Termination
              </Text>
              <Text as="p" variant="bodyMd">
                We reserve the right to suspend or terminate your access to the app at any time, with or without cause or notice. Upon termination, your right to use the app will immediately cease.
              </Text>
            </BlockStack>

            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Changes to Terms
              </Text>
              <Text as="p" variant="bodyMd">
                We reserve the right to modify these Terms at any time. We will notify you of any material changes by posting the updated Terms on this page. Your continued use of the app after such changes constitutes acceptance of the modified Terms.
              </Text>
            </BlockStack>

            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Contact Information
              </Text>
              <Text as="p" variant="bodyMd">
                If you have any questions about these Terms of Service, please contact us at{" "}
                <Link url="mailto:cbhelper.team@gmail.com" external>
                  cbhelper.team@gmail.com
                </Link>
                .
              </Text>
            </BlockStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
