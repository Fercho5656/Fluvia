import { randomUUID } from "node:crypto";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { db } from "@my-better-t-app/db";
import { workspace, server, workflow, customWorkflow } from "@my-better-t-app/db/schema/fluvia";
import { env } from "@my-better-t-app/env/server";
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
      return await db.query.workspace.findMany({
        where: eq(workspace.agencyId, userId),
        with: {
          servers: {
            with: {
              workflows: true,
            },
          },
        },
      });
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
  },

  server: {
    provision: protectedProcedure
      .input(z.object({ workspaceId: z.string() }))
      .handler(async ({ input }) => {
        const id = randomUUID();
        // Mocking CubePath provisioning
        await db.insert(server).values({
          id,
          workspaceId: input.workspaceId,
          status: "provisioning",
          url: `https://n8n-${id.slice(0, 8)}.cubepath.io`,
        });

        return { id };
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
          model: openrouter("openrouter/free"),
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
          n8nJson: input.n8nJson, // Snapshot of the JSON
          status: "active",
        });

        return { id, success: true };
      }),
  },
};
