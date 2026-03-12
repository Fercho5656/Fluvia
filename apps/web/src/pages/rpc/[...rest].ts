import { createContext } from "@my-better-t-app/api/context";
import { appRouter } from "@my-better-t-app/api/routers/index";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import type { APIRoute } from "astro";

const handler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const prerender = false;

export const ALL: APIRoute = async ({ request }) => {
  const context = await createContext({ headers: request.headers });

  const { response } = await handler.handle(request, {
    prefix: "/rpc",
    context,
  });

  return response ?? new Response("Not found", { status: 404 });
};
