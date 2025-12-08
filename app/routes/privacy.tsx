import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import {
  Page,
  Layout,
  Text,
  BlockStack,
  Link,
} from "@shopify/polaris";

/**
 * Privacy Policy Page
 * 
 * Generic privacy policy for the app.
 * Public page accessible at https://chargeback-app-rho.vercel.app/privacy
 */
export default function PrivacyPolicy() {
  return (
    <AppProvider i18n={{}}>
      <Page title="Privacy Policy">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Text as="h1" variant="heading2xl">
                Privacy Policy
              </Text>
              
              <Text as="p" variant="bodyMd">
                <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
              </Text>

              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Information We Collect
                </Text>
                <Text as="p" variant="bodyMd">
                  We collect information that you provide directly to us, including shop information, access tokens, and data necessary to provide our services. We may also collect information about how you use our app.
                </Text>
              </BlockStack>

              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  How We Use Your Information
                </Text>
                <Text as="p" variant="bodyMd">
                  We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.
                </Text>
              </BlockStack>

              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Data Security
                </Text>
                <Text as="p" variant="bodyMd">
                  We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
                </Text>
              </BlockStack>

              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Data Retention
                </Text>
                <Text as="p" variant="bodyMd">
                  We retain your personal information for as long as necessary to provide our services and comply with legal obligations. When you uninstall our app, we will delete your data in accordance with Shopify's compliance requirements.
                </Text>
              </BlockStack>

              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Your Rights
                </Text>
                <Text as="p" variant="bodyMd">
                  You have the right to access, correct, or delete your personal information. To exercise these rights, please contact us at{" "}
                  <Link url="mailto:cbhelper.team@gmail.com" external>
                    cbhelper.team@gmail.com
                  </Link>
                  .
                </Text>
              </BlockStack>

              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Changes to This Policy
                </Text>
                <Text as="p" variant="bodyMd">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
                </Text>
              </BlockStack>

              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Contact Us
                </Text>
                <Text as="p" variant="bodyMd">
                  If you have any questions about this Privacy Policy, please contact us at{" "}
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
    </AppProvider>
  );
}
