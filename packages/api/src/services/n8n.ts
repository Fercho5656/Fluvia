export class N8NService {
  /**
   * Pushes a workflow to a real n8n instance via its Public API
   * n8n API docs: https://docs.n8n.io/api/remote-api/
   */
  static async deployWorkflow(params: {
    baseUrl: string;
    apiKey: string;
    name: string;
    n8nJson: any;
  }) {
    const url = params.baseUrl.replace(/\/$/, "");
    const fullUrl = `${url}/api/v1/workflows`;

    // n8n expects "nodes" and "connections" in the root
    // Ref: https://docs.n8n.io/api/remote-api/#tag/Workflows/paths/~1workflows/post
    const body = {
      name: params.name,
      nodes: params.n8nJson.nodes || [],
      connections: params.n8nJson.connections || {},
      settings: params.n8nJson.settings || {},
    };

    console.log(`[n8n] Deploying to ${fullUrl}`);
    console.log(
      `[n8n] Body: ${body.nodes.length} nodes, ${Object.keys(body.connections).length} connection paths`,
    );
    console.log(`[n8n] API Key: ${params.apiKey.slice(0, 8)}...`);

    try {
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "X-N8N-API-KEY": params.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = response.statusText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }

        console.error(`[n8n] Deployment failed (${response.status}): ${errorMessage}`);
        throw new Error(`n8n API Error (${response.status}): ${errorMessage}`);
      }

      const result = await response.json();
      console.log(`[n8n] Successfully deployed workflow ID: ${result.id}`);
      return result;
    } catch (e: any) {
      console.error(`[n8n] Request failed: ${e.message}`);
      throw e;
    }
  }

  /**
   * Test if the API key is valid
   */
  static async validateKey(baseUrl: string, apiKey: string) {
    const url = baseUrl.replace(/\/$/, "");
    try {
      const response = await fetch(`${url}/api/v1/workflows?limit=1`, {
        headers: { "X-N8N-API-KEY": apiKey },
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  }
}
