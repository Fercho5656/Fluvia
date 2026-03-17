import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, pgEnum, jsonb, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const serverStatusEnum = pgEnum("server_status", ["provisioning", "active", "error"]);
export const workflowStatusEnum = pgEnum("workflow_status", ["draft", "active", "error"]);

export const workspace = pgTable(
  "workspace",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("workspace_agencyId_idx").on(table.agencyId)],
);

export const server = pgTable(
  "server",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    cubePathId: text("cube_path_id"), // Mocked ID from CubePath
    status: serverStatusEnum("status").default("provisioning").notNull(),
    url: text("url"),
    n8nApiKey: text("n8n_api_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("server_workspaceId_idx").on(table.workspaceId)],
);

export const workflow = pgTable(
  "workflow",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"), // Natural language description
    n8nJson: jsonb("n8n_json"), // n8n workflow JSON
    status: workflowStatusEnum("status").default("draft").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("workflow_serverId_idx").on(table.serverId)],
);

export const workspaceRelations = relations(workspace, ({ one, many }) => ({
  agency: one(user, {
    fields: [workspace.agencyId],
    references: [user.id],
  }),
  servers: many(server),
}));

export const serverRelations = relations(server, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [server.workspaceId],
    references: [workspace.id],
  }),
  workflows: many(workflow),
}));

export const workflowRelations = relations(workflow, ({ one }) => ({
  server: one(server, {
    fields: [workflow.serverId],
    references: [server.id],
  }),
}));
