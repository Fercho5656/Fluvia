import { randomUUID } from "node:crypto";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { db } from "@my-better-t-app/db";
import { workspace, server, workflow, customWorkflow } from "@my-better-t-app/db/schema/fluvia";
import { env } from "@my-better-t-app/env/server";
import { CubePathService } from "../services/cubepath";
import { ORPCError } from "@orpc/server";
import { generateText } from "ai";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";

const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

export const fluviaRouter = {
  workspace: {
    list: protectedProcedure.handler(async ({ context }) => {
      const userId = context.session.user.id;
      const workspaces = await db.query.workspace.findMany({
        where: eq(workspace.agencyId, userId),
        with: {
          servers: {
            with: {
              workflows: true,
            },
          },
        },
      });

      // Optionally sync status with CubePath for each server
      // For performance in a real app, we'd do this via webhooks or background sync
      // But for the hackathon, we can try to fetch live status if it's not provisioning
      const syncedWorkspaces = await Promise.all(
        workspaces.map(async (ws) => {
          if (ws.servers) {
            ws.servers = await Promise.all(
              ws.servers.map(async (srv) => {
                if (srv.cubePathId && srv.status !== "provisioning") {
                  try {
                    const details = await CubePathService.getVpsDetails(srv.cubePathId);
                    // Map CubePath status to our enum: active, stopped, error
                    let mappedStatus: "active" | "stopped" | "error" | "provisioning" = "active";
                    if (details.status === "off" || details.status === "stopped")
                      mappedStatus = "stopped";
                    if (details.status === "error") mappedStatus = "error";

                    if (mappedStatus !== srv.status) {
                      await db
                        .update(server)
                        .set({ status: mappedStatus })
                        .where(eq(server.id, srv.id));
                      srv.status = mappedStatus;
                    }
                  } catch (e) {
                    console.error(`Failed to sync server ${srv.id}:`, e);
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
        // Delete all associated VPS from CubePath first
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
      .input(z.object({ workspaceId: z.string() }))
      .handler(async ({ input }) => {
        const id = randomUUID();

        try {
          // Real CubePath Provisioning
          const vps = await CubePathService.createVps({
            name: `n8n-${id.slice(0, 8)}`,
            plan_name: "gp.nano",
            template_name: "n8n",
            location: "3",
          });

          await db.insert(server).values({
            id,
            workspaceId: input.workspaceId,
            cubePathId: vps.id,
            status: "provisioning",
            url: `https://n8n-${vps.id.slice(0, 8)}.cubepath.io`, // Assuming standard URL pattern
          });

          return { id, cubePathId: vps.id };
        } catch (e: any) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: `Failed to provision VPS: ${e.message}`,
          });
        }
      }),

    stop: protectedProcedure.input(z.object({ id: z.string() })).handler(async ({ input }) => {
      const srv = await db.query.server.findFirst({ where: eq(server.id, input.id) });
      if (!srv?.cubePathId) throw new ORPCError("NOT_FOUND");

      await CubePathService.performAction(srv.cubePathId, "stop");
      await db.update(server).set({ status: "stopped" }).where(eq(server.id, input.id));
      return { success: true };
    }),

    resume: protectedProcedure.input(z.object({ id: z.string() })).handler(async ({ input }) => {
      const srv = await db.query.server.findFirst({ where: eq(server.id, input.id) });
      if (!srv?.cubePathId) throw new ORPCError("NOT_FOUND");

      await CubePathService.performAction(srv.cubePathId, "start");
      await db.update(server).set({ status: "active" }).where(eq(server.id, input.id));
      return { success: true };
    }),

    restart: protectedProcedure.input(z.object({ id: z.string() })).handler(async ({ input }) => {
      const srv = await db.query.server.findFirst({ where: eq(server.id, input.id) });
      if (!srv?.cubePathId) throw new ORPCError("NOT_FOUND");

      await CubePathService.performAction(srv.cubePathId, "reboot");
      await db
        .update(server)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(server.id, input.id));
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.string() })).handler(async ({ input }) => {
      const srv = await db.query.server.findFirst({ where: eq(server.id, input.id) });
      if (srv?.cubePathId) {
        try {
          await CubePathService.deleteVps(srv.cubePathId);
        } catch (e) {
          console.error(`CubePath VPS deletion failed:`, e);
        }
      }
      await db.delete(server).where(eq(server.id, input.id));
      return { success: true };
    }),

    reinstall: protectedProcedure.input(z.object({ id: z.string() })).handler(async ({ input }) => {
      const srv = await db.query.server.findFirst({ where: eq(server.id, input.id) });
      if (!srv?.cubePathId) throw new ORPCError("NOT_FOUND");

      await db.transaction(async (tx) => {
        await CubePathService.reinstallVps(srv.cubePathId!, "n8n");
        await tx
          .update(server)
          .set({ status: "provisioning", updatedAt: new Date() })
          .where(eq(server.id, input.id));
        await tx.delete(workflow).where(eq(workflow.serverId, input.id));
      });
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
          description: z.string().optional(),
        }),
      )
      .handler(async ({ input, context }) => {
        const id = randomUUID();
        await db.insert(customWorkflow).values({
          id,
          name: input.name,
          n8nJson: input.n8nJson,
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
          description: z.string().optional(),
        }),
      )
      .handler(async ({ input, context }) => {
        await db
          .update(customWorkflow)
          .set({
            name: input.name,
            n8nJson: input.n8nJson,
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
        }),
      )
      .handler(async ({ input }) => {
        const { text } = await generateText({
          model: openrouter("anthropic/claude-3.5-sonnet"),
          system: `You are an expert in n8n automation. 
          Your task is to generate valid n8n workflow JSON based on the user's description.
          Output ONLY the JSON. No explanations, no markdown blocks. 
          The JSON must be a valid n8n workflow structure with "nodes" and "connections".`,
          prompt: input.prompt,
        });

        let n8nJson;
        try {
          const cleanedText = text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
          n8nJson = JSON.parse(cleanedText);
        } catch (e) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to generate valid n8n JSON",
            cause: e,
          });
        }

        return { n8nJson };
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
        const id = randomUUID();
        await db.insert(workflow).values({
          id,
          serverId: input.serverId,
          customWorkflowId: input.customWorkflowId,
          name: input.name,
          n8nJson: input.n8nJson, // Snapshot
          status: "active",
        });

        return { id, success: true };
      }),
  },
};
