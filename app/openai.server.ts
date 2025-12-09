export async function generateDisputeResponse(disputeDetails: {
  shopifyDisputeId: string;
  orderName?: string | null;
  customerEmail?: string | null;
  status?: string | null;
  reason?: string | null;
  chargebackReason?: string | null;
  amount?: number | null;
  currency?: string | null;
  rawPayload: unknown;
}): Promise<string> {
  // Ensure we have the API key - check both process.env and ensure it's loaded
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set. Available env vars:", Object.keys(process.env).filter(k => k.includes("OPENAI") || k.includes("API")));
    throw new Error("OPENAI_API_KEY environment variable is not set. Please ensure it's configured in your environment variables or .env file.");
  }

  const prompt = `You are a chargeback dispute response expert. Generate a professional, persuasive dispute response based on the following information:

Dispute ID: ${disputeDetails.shopifyDisputeId}
Order: ${disputeDetails.orderName || "N/A"}
Customer Email: ${disputeDetails.customerEmail || "N/A"}
Status: ${disputeDetails.status || "N/A"}
Reason: ${disputeDetails.reason || "N/A"}
Chargeback Reason: ${disputeDetails.chargebackReason || "N/A"}
Amount: ${disputeDetails.currency || ""} ${disputeDetails.amount || "N/A"}

Additional Details:
${JSON.stringify(disputeDetails.rawPayload, null, 2)}

Generate a clear, professional dispute response that:
1. Addresses the specific chargeback reason
2. Provides relevant evidence and context
3. Is professional and persuasive
4. Follows best practices for chargeback disputes

Response:`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a chargeback dispute response expert. Generate professional, persuasive dispute responses.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(
      `OpenAI API error: ${error.error?.message || JSON.stringify(error)}`,
    );
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "Failed to generate response";
}

