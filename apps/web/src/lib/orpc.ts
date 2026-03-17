import type { AppRouterClient } from "@my-better-t-app/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.BETTER_AUTH_URL || "http://localhost:4321";
};

export const createClient = (headers?: Headers) => {
  const link = new RPCLink({
    url: `${getBaseUrl()}/rpc`,
    headers: headers,
  });

  return createORPCClient(link) as AppRouterClient;
};

// Standard client-side instance
export const orpc = typeof window !== "undefined" ? createClient() : ({} as AppRouterClient);
