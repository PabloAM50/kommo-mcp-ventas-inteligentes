import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { accountTools } from "./tools/accounts.js";
import { leadTools } from "./tools/leads.js";
import { contactTools } from "./tools/contacts.js";
import { companyTools } from "./tools/companies.js";
import { pipelineTools } from "./tools/pipelines.js";
import { taskTools } from "./tools/tasks.js";
import { eventTools } from "./tools/events.js";

const server = new McpServer({
  name: "kommo-mcp",
  version: "1.0.0",
});

const allTools: Record<string, { description: string; schema: any; handler: (params: any) => Promise<any> }> = {
  ...accountTools,
  ...leadTools,
  ...contactTools,
  ...companyTools,
  ...pipelineTools,
  ...taskTools,
  ...eventTools,
};

for (const [name, tool] of Object.entries(allTools)) {
  server.tool(name, tool.description, tool.schema.shape, async (params: any) => {
    try {
      const result = await tool.handler(params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }, null, 2) }],
        isError: true,
      };
    }
  });
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Kommo MCP Server running - ${Object.keys(allTools).length} tools loaded`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
