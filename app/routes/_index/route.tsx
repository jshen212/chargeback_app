import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // If shop parameter is present, redirect to app with shop parameter
  if (url.searchParams.get("shop")) {
    return redirect(`/app?${url.searchParams.toString()}`);
  }

  // Otherwise, redirect to the dispute list page
  return redirect("/app");
};
