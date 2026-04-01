import { randomUUID } from "node:crypto";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { db } from "@my-better-t-app/db";
import { workspace, server, workflow, customWorkflow } from "@my-better-t-app/db/schema/fluvia";
import { env } from "@my-better-t-app/env/server";
import { CubePathService } from "../services/cubepath";
import { N8NService } from "../services/n8n";
import { N8NBuilder } from "../lib/n8n-builder";
import { ORPCError } from "@orpc/server";
import { generateText } from "ai";
import { eq, and, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";
import { SHORT_SYSTEM_PROMPT as SYSTEM_PROMPT } from "../const";

const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

/**
 * Normalizes a string to be CubePath/Linux compatible:
 * - Lowercase
 * - Spaces/Underscores to hyphens
 * - Remove non-alphanumeric (except hyphens)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-") // spaces/underscores to hyphens
    .replace(/[^a-z0-9-]/g, "") // remove invalid chars
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}

export const fluviaRouter = {
  workspace: {
    list: protectedProcedure
      .input(z.object({ sync: z.boolean().optional().default(true) }).optional())
      .handler(async ({ context, input }) => {
        const userId = context.session.user.id;
        const workspaces = await db.query.workspace.findMany({
          where: or(eq(workspace.agencyId, userId), eq(workspace.isPublic, true)),
          with: {
            servers: {
              with: {
                workflows: true,
              },
            },
          },
        });

        const shouldSync = input?.sync ?? true;

        let cubePathVpsList: any[] = [];
        if (shouldSync) {
          try {
            cubePathVpsList = await CubePathService.listVps();
          } catch (e) {
            console.error("Failed to fetch CubePath VPS list:", e);
          }
        }

        const syncedWorkspaces = await Promise.all(
          workspaces.map(async (ws) => {
            if (ws.servers && shouldSync) {
              ws.servers = await Promise.all(
                ws.servers.map(async (srv) => {
                  if (srv.type !== "managed" || !srv.cubePathId || srv.status === "deleting")
                    return srv;

                  const srvCreated = srv.createdAt?.getTime() || 0;
                  const isVeryNew = srvCreated && Date.now() - srvCreated < 30000;
                  if (isVeryNew) return srv;

                  const vpsInfo = cubePathVpsList.find(
                    (v) =>
                      String(v.id) === srv.cubePathId ||
                      String(v.vps_id) === srv.cubePathId ||
                      String(v.vpsid) === srv.cubePathId,
                  );

                  if (vpsInfo) {
                    const rawStatus = String(vpsInfo.status || "").toLowerCase();
                    if (
                      ["active", "stopped", "deploying", "deleting", "error"].includes(rawStatus)
                    ) {
                      let mappedStatus = rawStatus as typeof srv.status;

                      const isTransitional = ["stopping", "resuming", "restarting"].includes(
                        srv.status,
                      );
                      if (isTransitional) {
                        const timeSinceUpdate = srv.updatedAt
                          ? Date.now() - srv.updatedAt.getTime()
                          : 0;
                        const isRecent = timeSinceUpdate < 60000;

                        if (isRecent) {
                          if (srv.status === "stopping" && mappedStatus !== "stopped") {
                            mappedStatus = "stopping";
                          } else if (
                            ["resuming", "restarting"].includes(srv.status) &&
                            mappedStatus !== "active"
                          ) {
                            mappedStatus = srv.status;
                          }
                        }
                      }

                      if (mappedStatus !== srv.status) {
                        await db
                          .update(server)
                          .set({ status: mappedStatus })
                          .where(eq(server.id, srv.id));
                        srv.status = mappedStatus;
                      }
                    }
                  }
                  return srv;
                }),
              );
            }
            return ws;
          }),
        );

        return syncedWorkspaces;
      }),

    create: protectedProcedure
      .input(z.object({ name: z.string().min(1) }))
      .handler(async ({ input, context }) => {
        const id = randomUUID();
        await db.insert(workspace).values({
          id,
          name: input.name,
          agencyId: context.session.user.id,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.string(), name: z.string().min(1) }))
      .handler(async ({ input, context }) => {
        await db
          .update(workspace)
          .set({ name: input.name, updatedAt: new Date() })
          .where(and(eq(workspace.id, input.id), eq(workspace.agencyId, context.session.user.id)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .handler(async ({ input, context }) => {
        const servers = await db.query.server.findMany({
          where: eq(server.workspaceId, input.id),
        });

        for (const srv of servers) {
          if (srv.cubePathId) {
            try {
              await CubePathService.deleteVps(srv.cubePathId);
            } catch (e) {
              console.error(`Failed to delete VPS ${srv.cubePathId} from CubePath:`, e);
            }
          }
        }

        await db
          .delete(workspace)
          .where(and(eq(workspace.id, input.id), eq(workspace.agencyId, context.session.user.id)));
        return { success: true };
      }),
  },

  server: {
    provision: protectedProcedure
      .input(z.object({ workspaceName: z.string(), workspaceId: z.string() }))
      .handler(async ({ input }) => {
        const id = randomUUID();
        const password = CubePathService.generateRandomPassword();
        const passwordHash = CubePathService.hashPassword(password);

        const safeWorkspaceName = normalizeName(input.workspaceName);
        const uniqueSuffix = id.slice(0, 8);
        const vpsName = `n8n-${safeWorkspaceName}-${uniqueSuffix}`.slice(0, 60);

        const maxRetries = 3;
        let vps: any;
        let lastError: any;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            vps = await CubePathService.createVps({
              label: vpsName,
              name: vpsName,
              plan_name: "gp.micro",
              template_name: "n8n",
              location_name: "us-hou-1",
              password: password,
            });
            break;
          } catch (e: any) {
            lastError = e;
            console.error(`CubePath creation attempt ${attempt} failed: ${e.message}`);
            if (attempt === maxRetries) {
              throw new ORPCError("INTERNAL_SERVER_ERROR", {
                message: `Failed to create VPS after ${maxRetries} attempts. ${e.message}`,
                cause: e,
              });
            }
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }

        try {
          const cubePathId = String(vps.id || vps.vps_id || vps.vpsid || "");
          if (!cubePathId) {
            throw new Error("CubePath returned success but no VPS ID was found.");
          }

          await db.insert(server).values({
            id,
            workspaceId: input.workspaceId,
            cubePathId,
            type: "managed",
            status: "deploying",
            passwordHash: passwordHash,
            url: `https://vps${cubePathId}.cubepath.net`,
          });

          return { id, password };
        } catch (e: any) {
          console.error("Local database insertion failed:", e);
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: `Server created on CubePath (${vps?.id}) but local setup failed: ${e.message}`,
            cause: e,
          });
        }
      }),

    linkExternal: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string(),
          url: z.string().min(1),
          n8nApiKey: z.string().min(1),
        }),
      )
      .handler(async ({ input, context }) => {
        // 1. Preprocess URL
        let finalUrl = input.url.trim().replace(/\/$/, "");
        if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
          finalUrl = `https://${finalUrl}`;
        }

        // 2. Verify ownership of workspace
        const ws = await db.query.workspace.findFirst({
          where: and(
            eq(workspace.id, input.workspaceId),
            eq(workspace.agencyId, context.session.user.id),
          ),
        });
        if (!ws) throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });

        // 3. Validate n8n connection
        const isValid = await N8NService.validateKey(finalUrl, input.n8nApiKey);
        if (!isValid) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Could not connect to n8n instance. Please check your URL and API Key.",
          });
        }

        // 4. Create record
        const id = randomUUID();
        await db.insert(server).values({
          id,
          workspaceId: input.workspaceId,
          type: "external",
          status: "active",
          url: finalUrl,
          n8nApiKey: input.n8nApiKey,
        });

        return { id };
      }),

    stop: protectedProcedure
      .input(z.object({ id: z.string(), password: z.string() }))
      .handler(async ({ input }) => {
        const srv = await db.query.server.findFirst({ where: eq(server.id, input.id) });
        if (!srv?.cubePathId || !srv.passwordHash) throw new ORPCError("NOT_FOUND");

        if (!CubePathService.verifyPassword(input.password, srv.passwordHash)) {
          throw new ORPCError("UNAUTHORIZED", { message: "Invalid VPS password" });
        }

        await CubePathService.powerControlVps(srv.cubePathId, "stop_vps");
        await db
          .update(server)
          .set({ status: "stopping", updatedAt: new Date() })
          .where(eq(server.id, input.id));
        return { success: true };
      }),

    resume: protectedProcedure
      .input(z.object({ id: z.string(), password: z.string() }))
      .handler(async ({ input }) => {
        const srv = await db.query.server.findFirst({ where: eq(server.id, input.id) });
        if (!srv?.cubePathId || !srv.passwordHash) throw new ORPCError("NOT_FOUND");

        if (!CubePathService.verifyPassword(input.password, srv.passwordHash)) {
          throw new ORPCError("UNAUTHORIZED", { message: "Invalid VPS password" });
        }

        await db
          .update(server)
          .set({ status: "resuming", updatedAt: new Date() })
          .where(eq(server.id, input.id));
        await CubePathService.powerControlVps(srv.cubePathId, "start_vps");

        return { success: true };
      }),

    restart: protectedProcedure
      .input(z.object({ id: z.string(), password: z.string() }))
      .handler(async ({ input }) => {
        const srv = await db.query.server.findFirst({ where: eq(server.id, input.id) });
        if (!srv?.cubePathId || !srv.passwordHash) throw new ORPCError("NOT_FOUND");

        if (!CubePathService.verifyPassword(input.password, srv.passwordHash)) {
          throw new ORPCError("UNAUTHORIZED", { message: "Invalid VPS password" });
        }

        await db
          .update(server)
          .set({ status: "restarting", updatedAt: new Date() })
          .where(eq(server.id, input.id));
        await CubePathService.powerControlVps(srv.cubePathId, "reboot_vps");

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string(), password: z.string() }))
      .handler(async ({ input }) => {
        const srv = await db.query.server.findFirst({ where: eq(server.id, input.id) });
        if (!srv?.cubePathId || !srv.passwordHash) throw new ORPCError("NOT_FOUND");

        if (!CubePathService.verifyPassword(input.password, srv.passwordHash)) {
          throw new ORPCError("UNAUTHORIZED", { message: "Invalid VPS password" });
        }

        await db.update(server).set({ status: "deleting" }).where(eq(server.id, input.id));

        try {
          await CubePathService.deleteVps(srv.cubePathId);
          await db.delete(server).where(eq(server.id, input.id));
        } catch (e) {
          await db.update(server).set({ status: "error" }).where(eq(server.id, input.id));
          throw e;
        }

        return { success: true };
      }),

    reinstall: protectedProcedure
      .input(z.object({ id: z.string(), password: z.string() }))
      .handler(async ({ input }) => {
        const srv = await db.query.server.findFirst({ where: eq(server.id, input.id) });
        if (!srv?.cubePathId || !srv.passwordHash) throw new ORPCError("NOT_FOUND");

        if (!CubePathService.verifyPassword(input.password, srv.passwordHash)) {
          throw new ORPCError("UNAUTHORIZED", { message: "Invalid VPS password" });
        }

        const newPasswordHash = CubePathService.hashPassword(input.password);

        await db.transaction(async (tx) => {
          await CubePathService.reinstallVps(srv.cubePathId!, input.password);
          await tx
            .update(server)
            .set({
              status: "deploying",
              passwordHash: newPasswordHash,
              n8nApiKey: null,
              updatedAt: new Date(),
            })
            .where(eq(server.id, input.id));
          await tx.delete(workflow).where(eq(workflow.serverId, input.id));
        });
        return { success: true };
      }),

    saveSettings: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          n8nApiKey: z.string().min(1),
        }),
      )
      .handler(async ({ input }) => {
        await db
          .update(server)
          .set({ n8nApiKey: input.n8nApiKey, updatedAt: new Date() })
          .where(eq(server.id, input.id));
        return { success: true };
      }),
  },

  customWorkflow: {
    list: protectedProcedure.handler(async ({ context }) => {
      return await db.query.customWorkflow.findMany({
        where: eq(customWorkflow.userId, context.session.user.id),
        orderBy: (fields, { desc }) => [desc(fields.createdAt)],
      });
    }),

    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .handler(async ({ input, context }) => {
        const result = await db.query.customWorkflow.findFirst({
          where: and(
            eq(customWorkflow.id, input.id),
            eq(customWorkflow.userId, context.session.user.id),
          ),
        });
        if (!result) throw new ORPCError("NOT_FOUND");
        return result;
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          n8nJson: z.any(),
          blueprint: z.any().optional(),
          description: z.string().optional(),
        }),
      )
      .handler(async ({ input, context }) => {
        const id = randomUUID();
        await db.insert(customWorkflow).values({
          id,
          name: input.name,
          n8nJson: input.n8nJson,
          blueprint: input.blueprint,
          description: input.description,
          userId: context.session.user.id,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().optional(),
          n8nJson: z.any().optional(),
          blueprint: z.any().optional(),
          description: z.string().optional(),
        }),
      )
      .handler(async ({ input, context }) => {
        await db
          .update(customWorkflow)
          .set({
            name: input.name,
            n8nJson: input.n8nJson,
            blueprint: input.blueprint,
            description: input.description,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(customWorkflow.id, input.id),
              eq(customWorkflow.userId, context.session.user.id),
            ),
          );
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .handler(async ({ input, context }) => {
        await db
          .delete(customWorkflow)
          .where(
            and(
              eq(customWorkflow.id, input.id),
              eq(customWorkflow.userId, context.session.user.id),
            ),
          );
        return { success: true };
      }),
  },

  workflow: {
    generate: protectedProcedure
      .input(
        z.object({
          prompt: z.string(),
          name: z.string().default("New AI Workflow"),
          currentBlueprint: z.any().optional(),
        }),
      )
      .handler(async ({ input }) => {
        let fullPrompt = input.prompt;

        if (input.currentBlueprint) {
          fullPrompt = `Current workflow state: ${JSON.stringify(input.currentBlueprint)}\n\nUser request: ${input.prompt}\n\nPlease modify the current workflow according to the user request. Return the entire updated JSON object.`;
        }

        const { text } = await generateText({
          model: openrouter("nvidia/nemotron-3-nano-30b-a3b:free"),
          system: SYSTEM_PROMPT,
          prompt: fullPrompt,
        });

        try {
          const cleanedText = text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

          const blueprint = JSON.parse(cleanedText);

          // Expand high-level blueprint into full n8n JSON
          const n8nJson = N8NBuilder.build(blueprint);

          return { n8nJson, blueprint };
        } catch (e) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to generate valid n8n JSON from AI blueprint",
            cause: e,
          });
        }
      }),

    deploy: protectedProcedure
      .input(
        z.object({
          serverId: z.string(),
          customWorkflowId: z.string(),
          name: z.string(),
          n8nJson: z.any(),
        }),
      )
      .handler(async ({ input }) => {
        // 1. Get the server to check for API key
        const srv = await db.query.server.findFirst({
          where: eq(server.id, input.serverId),
        });

        if (!srv || !srv.url) throw new ORPCError("NOT_FOUND", { message: "Server not found" });

        // 2. If API key exists, push to real n8n
        if (srv.n8nApiKey) {
          try {
            await N8NService.deployWorkflow({
              baseUrl: srv.url,
              apiKey: srv.n8nApiKey,
              name: input.name,
              n8nJson: input.n8nJson,
            });
          } catch (e: any) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
              message: `Real n8n deployment failed: ${e.message}. Please check your API key and server connection.`,
            });
          }
        }

        // 3. Local record keeping (Snapshot)
        const id = randomUUID();
        await db.insert(workflow).values({
          id,
          serverId: input.serverId,
          customWorkflowId: input.customWorkflowId,
          name: input.name,
          n8nJson: input.n8nJson,
          status: "active",
        });

        return { id, success: true, pushedToRealN8n: !!srv.n8nApiKey };
      }),
  },
};
