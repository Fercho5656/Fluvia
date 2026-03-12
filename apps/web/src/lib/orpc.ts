import type { AppRouterClient } from "@my-better-t-app/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

export const link = new RPCLink({
  url: `${window.location.origin}/rpc`,
});

export const orpc: AppRouterClient = createORPCClient(link);
