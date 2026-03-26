interface BlueprintNode {
  id: string;
  service: string;
  action: string;
  params?: Record<string, any>;
}

interface Blueprint {
  nodes: BlueprintNode[];
  connections: [string, string][];
}

export class N8NBuilder {
  /**
   * Comprehensive registry of supported n8n nodes.
   * Includes default resources for multi-level nodes.
   */
  private static registry: Record<
    string,
    { type: string; version: number | number[]; defaultResource?: string }
  > = {
    // Triggers
    webhook: { type: "n8n-nodes-base.webhook", version: 2.1 },
    schedule: { type: "n8n-nodes-base.scheduleTrigger", version: 1.3 },
    email_trigger: { type: "n8n-nodes-base.emailTriggerImap", version: 2.1 },
    stripe_trigger: { type: "n8n-nodes-base.stripeTrigger", version: 1 },
    telegram_trigger: { type: "n8n-nodes-base.telegramTrigger", version: 1.2 },
    slack_trigger: { type: "n8n-nodes-base.slackTrigger", version: 1 },
    whatsapp_trigger: { type: "n8n-nodes-base.whatsAppTrigger", version: 1 },
    google_sheets_trigger: { type: "n8n-nodes-base.googleSheetsTrigger", version: 1 },
    airtable_trigger: { type: "n8n-nodes-base.airtableTrigger", version: 1 },
    hubspot_trigger: { type: "n8n-nodes-base.hubSpotTrigger", version: 1 },

    // Core / Logic
    code: { type: "n8n-nodes-base.code", version: 2 },
    set: { type: "n8n-nodes-base.set", version: 3.4 },
    if: { type: "n8n-nodes-base.if", version: 2.3 },
    filter: { type: "n8n-nodes-base.filter", version: 2.3 },
    wait: { type: "n8n-nodes-base.wait", version: 1.1 },
    http: { type: "n8n-nodes-base.httpRequest", version: 4.4 },

    // Communication
    slack: { type: "n8n-nodes-base.slack", version: 2.4, defaultResource: "message" },
    discord: { type: "n8n-nodes-base.discord", version: 2, defaultResource: "message" },
    telegram: { type: "n8n-nodes-base.telegram", version: 1.2, defaultResource: "message" },
    whatsapp: { type: "n8n-nodes-base.whatsApp", version: 1.1, defaultResource: "message" },
    gmail: { type: "n8n-nodes-base.gmail", version: 2.2, defaultResource: "message" },
    email_send: { type: "n8n-nodes-base.emailSend", version: 2.1 },
    twilio: { type: "n8n-nodes-base.twilio", version: 1, defaultResource: "sms" },

    // Productivity & Data
    google_sheets: {
      type: "n8n-nodes-base.googleSheetsV2",
      version: 4.7,
      defaultResource: "sheet",
    },
    google_drive: { type: "n8n-nodes-base.googleDrive", version: 3, defaultResource: "file" },
    google_calendar: {
      type: "n8n-nodes-base.googleCalendar",
      version: 1.3,
      defaultResource: "event",
    },
    airtable: { type: "n8n-nodes-base.airtable", version: 2.1, defaultResource: "record" },
    notion: { type: "n8n-nodes-base.notion", version: 2.2, defaultResource: "page" },
    trello: { type: "n8n-nodes-base.trello", version: 1, defaultResource: "card" },
    asana: { type: "n8n-nodes-base.asana", version: 1, defaultResource: "task" },
    clickup: { type: "n8n-nodes-base.clickUp", version: 1, defaultResource: "task" },

    // CRM & Marketing
    hubspot: { type: "n8n-nodes-base.hubSpot", version: 2.2, defaultResource: "contact" },
    salesforce: { type: "n8n-nodes-base.salesforce", version: 1, defaultResource: "contact" },
    activecampaign: {
      type: "n8n-nodes-base.activeCampaign",
      version: 1,
      defaultResource: "contact",
    },
    mailchimp: { type: "n8n-nodes-base.mailchimp", version: 1, defaultResource: "member" },
    pipedrive: { type: "n8n-nodes-base.pipedrive", version: 1, defaultResource: "deal" },

    // Finance & Payment
    stripe: { type: "n8n-nodes-base.stripe", version: 1, defaultResource: "charge" },
    paypal: { type: "n8n-nodes-base.paypal", version: 1, defaultResource: "payout" },
    quickbooks: { type: "n8n-nodes-base.quickbooks", version: 1, defaultResource: "invoice" },

    // Database
    postgres: { type: "n8n-nodes-base.postgres", version: 2.6, defaultResource: "database" },
    mysql: { type: "n8n-nodes-base.mysql", version: 2.5, defaultResource: "database" },
    mongodb: { type: "n8n-nodes-base.mongoDb", version: 1.2, defaultResource: "document" },
    supabase: { type: "n8n-nodes-base.supabase", version: 1, defaultResource: "row" },

    // AI
    openai: { type: "n8n-nodes-base.openAi", version: 1.8, defaultResource: "chat" },
    anthropic: { type: "n8n-nodes-base.anthropic", version: 1, defaultResource: "text" },
  };

  /**
   * Expands a simplified blueprint into a full n8n workflow JSON
   */
  static build(blueprint: Blueprint) {
    const nodes: any[] = [];
    const connections: any = {};

    // 1. Process Nodes and calculate positions
    blueprint.nodes.forEach((node, index) => {
      const reg = this.registry[node.service.toLowerCase()] || {
        type: `n8n-nodes-base.${node.service}`,
        version: 1,
      };

      // Heuristic for automated parameter mapping
      const parameters: Record<string, any> = { ...node.params };

      // Many nodes use 'operation' instead of 'action'
      if (!parameters.operation) {
        parameters.operation = node.action;
      }

      // If the node needs a resource and it's not provided, use the default
      if (reg.defaultResource && !parameters.resource) {
        parameters.resource = reg.defaultResource;
      }

      // Special case: Webhook node uses 'httpMethod' instead of 'operation' for its primary action
      if (reg.type === "n8n-nodes-base.webhook" && !parameters.httpMethod) {
        parameters.httpMethod = node.action.toUpperCase() || "POST";
        delete parameters.operation;
      }

      // Special case: HTTP Request uses 'method'
      if (reg.type === "n8n-nodes-base.httpRequest" && !parameters.method) {
        parameters.method = node.action.toUpperCase() || "GET";
        delete parameters.operation;
      }

      // Latest version selection if multiple available
      const typeVersion = Array.isArray(reg.version) ? Math.max(...reg.version) : reg.version;

      nodes.push({
        name: node.id,
        parameters,
        type: reg.type,
        typeVersion,
        position: [index * 300, 300],
      });
    });

    // 2. Process Connections
    blueprint.connections.forEach(([from, to]) => {
      if (!connections[from]) connections[from] = { main: [[]] };

      connections[from].main[0].push({
        node: to,
        type: "main",
        index: 0,
      });
    });

    return {
      nodes,
      connections,
      settings: {
        executionOrder: "v1",
      },
      staticData: null,
      meta: {
        templateId: "ai-designer-v2",
      },
    };
  }
}
