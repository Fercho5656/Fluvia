import { randomUUID } from "node:crypto";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { db } from "@my-better-t-app/db";
import { workspace, server, workflow } from "@my-better-t-app/db/schema/fluvia";
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

        // In a real app, we'd start a background job.
        // For the hackathon prototype, we'll just return the id.
        return { id };
      }),
  },

  workflow: {
    generate: protectedProcedure
      .input(
        z.object({
          serverId: z.string(),
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
          // Clean up markdown code blocks if AI included them
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

        const id = randomUUID();
        await db.insert(workflow).values({
          id,
          serverId: input.serverId,
          name: input.name,
          description: input.prompt,
          n8nJson: n8nJson,
          status: "draft",
        });

        return { id, n8nJson };
      }),

    deploy: protectedProcedure
      .input(z.object({ workflowId: z.string() }))
      .handler(async ({ input }) => {
        // Mocking deployment to n8n
        await db
          .update(workflow)
          .set({ status: "active" })
          .where(eq(workflow.id, input.workflowId));

        return { success: true };
      }),
  },
};
