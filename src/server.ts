import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { accountTools } from "./tools/accounts.js";
import { leadTools } from "./tools/leads.js";
import { contactTools } from "./tools/contacts.js";
import { companyTools } from "./tools/companies.js";
import { pipelineTools } from "./tools/pipelines.js";
import { taskTools } from "./tools/tasks.js";
import { eventTools } from "./tools/events.js";
import { talkTools } from "./tools/talks.js";
import { salsbotTools } from "./tools/salesbots.js";
import { templateTools } from "./tools/templates.js";
import { customFieldTools } from "./tools/custom-fields.js";

const allTools: Record<string, { description: string; schema: any; handler: (params: any) => Promise<any> }> = {
  ...accountTools,
  ...leadTools,
  ...contactTools,
  ...companyTools,
  ...pipelineTools,
  ...taskTools,
  ...eventTools,
  ...talkTools,
  ...salsbotTools,
  ...templateTools,
  ...customFieldTools,
};

function createServer(): McpServer {
  const server = new McpServer({
    name: "kommo-mcp",
    version: "1.2.0",
  });

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

  return server;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3000", 10);

const app = createMcpExpressApp({ host: "0.0.0.0" });

const transports: Record<string, StreamableHTTPServerTransport> = {};

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          delete transports[sid];
        }
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", tools: Object.keys(allTools).length, version: "1.2.0" });
});

// Serve weekly HTML reports — only files matching reporte_semanal_NN.html
const reportsDir = path.resolve(__dirname, "..");
app.get("/reportes/Molinacasasola", (_req, res) => {
  const files = readdirSync(reportsDir)
    .filter(f => /^reporte_semanal_\d{1,2}_\d{1,2}_[a-z]+_\d{2}\.html$/.test(f))
    .sort()
    .reverse();
  if (files.length === 0) { res.status(404).send("No hay reportes disponibles."); return; }
  res.redirect(`/reportes/Molinacasasola/${files[0]}`);
});
app.get("/reportes/Molinacasasola/:filename", (req, res) => {
  const { filename } = req.params;
  if (!/^reporte_semanal_\d{1,2}_\d{1,2}_[a-z]+_\d{2}\.html$/.test(filename)) {
    res.status(404).send("Not found");
    return;
  }
  res.sendFile(path.join(reportsDir, filename));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Kommo MCP Remote Server running on port ${PORT} — ${Object.keys(allTools).length} tools loaded`);
});

process.on("SIGINT", async () => {
  for (const sid of Object.keys(transports)) {
    await transports[sid].close();
    delete transports[sid];
  }
  process.exit(0);
});
