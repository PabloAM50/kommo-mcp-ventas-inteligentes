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

app.get("/", (_req, res) => {
  res.redirect("/reportes/Molinacasasola");
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", tools: Object.keys(allTools).length, version: "1.2.0" });
});

// Serve Assets folder (logo, images)
app.use("/assets", express.static(path.resolve(__dirname, "..", "Assets")));

// Serve weekly HTML reports — only files matching reporte_semanal_NN.html
const reportsDir = path.resolve(__dirname, "..");
// Same-month week: reporte_semanal_10_16_agosto_26.html
const SAME_MONTH_RE = /^reporte_semanal_(\d{1,2})_(\d{1,2})_([a-z]+)_(\d{2})\.html$/;
// Week that crosses a month boundary: reporte_semanal_27_julio_2_agosto_26.html
const CROSS_MONTH_RE = /^reporte_semanal_(\d{1,2})_([a-z]+)_(\d{1,2})_([a-z]+)_(\d{2})\.html$/;

const MONTH_NUMS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const CLIENTS = [
  { slug: "Molinacasasola", name: "Molina Casasola" },
];

const PAGE_STYLE = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Inter:wght@300;400;500;600&display=swap');
    :root{
      --cream:#FAF8F3; --cream-card:#F5EFE6; --gold:#C5963A; --gold-fade:#F9F2E5;
      --gold-light:#E2C07A; --charcoal:#1E1A17; --warm-mid:#5A5047; --warm-lt:#8A7D72;
      --divider:#E5DDD3; --white:#FFFFFF;
    }
    *{box-sizing:border-box;}
    body{margin:0;background:var(--cream);color:var(--warm-mid);font-family:'Inter',sans-serif;
      min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 20px;}
    .panel{max-width:560px;width:100%;}
    h1{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:2.2rem;color:var(--charcoal);margin:0 0 4px;}
    .eyebrow{font-size:.72rem;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:18px;
      padding-bottom:14px;border-bottom:1px solid var(--divider);}
    ul{list-style:none;margin:0;padding:0;}
    li + li{margin-top:10px;}
    a.item{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;
      background:var(--white);border:1px solid var(--divider);border-radius:8px;
      color:var(--charcoal);text-decoration:none;font-size:1rem;transition:border-color .15s,background .15s;}
    a.item:hover{border-color:var(--gold);background:var(--gold-fade);}
    a.item .arrow{color:var(--gold);}
    .empty{color:var(--warm-lt);font-style:italic;padding:16px 0;}
    .footer-note{margin-top:24px;font-size:.75rem;color:var(--warm-lt);}
    .footer-note strong{color:var(--gold);}
  </style>
`;

function monthName(m: string): string {
  const map: Record<string, string> = {
    "01": "enero", "02": "febrero", "03": "marzo", "04": "abril", "05": "mayo", "06": "junio",
    "07": "julio", "08": "agosto", "09": "septiembre", "10": "octubre", "11": "noviembre", "12": "diciembre",
  };
  return map[m] || m;
}

function isReportFile(f: string): boolean {
  return SAME_MONTH_RE.test(f) || CROSS_MONTH_RE.test(f);
}

// Parses a report filename into a display label and a numeric sort key
// (year*10000 + endMonth*100 + endDay) so weeks sort chronologically even
// when day numbers aren't zero-padded (e.g. "3_9_agosto" vs "10_16_agosto").
function parseReportFile(f: string): { label: string; sortKey: number } | null {
  let m = f.match(SAME_MONTH_RE);
  if (m) {
    const [, d1, d2, mon, yy] = m;
    const label = `${d1} – ${d2} de ${monthName(mon)} de 20${yy}`;
    const sortKey = Number(`20${yy}`) * 10000 + (MONTH_NUMS[mon] || 0) * 100 + Number(d2);
    return { label, sortKey };
  }
  m = f.match(CROSS_MONTH_RE);
  if (m) {
    const [, d1, mon1, d2, mon2, yy] = m;
    const label = `${d1} de ${monthName(mon1)} – ${d2} de ${monthName(mon2)} de 20${yy}`;
    const sortKey = Number(`20${yy}`) * 10000 + (MONTH_NUMS[mon2] || 0) * 100 + Number(d2);
    return { label, sortKey };
  }
  return null;
}

app.get("/reportes", (_req, res) => {
  const items = CLIENTS.map(c =>
    `<li><a class="item" href="/reportes/${c.slug}"><span>${c.name}</span><span class="arrow">&rarr;</span></a></li>`
  ).join("");
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Reportes</title>${PAGE_STYLE}</head><body>
    <div class="panel">
      <div class="eyebrow">Reportes semanales</div>
      <h1>Selecciona un cliente</h1>
      <ul style="margin-top:20px;">${items}</ul>
      <div class="footer-note">Generado por <strong>Miaia.ai</strong></div>
    </div></body></html>`);
});

app.get("/reportes/Molinacasasola", (_req, res) => {
  const files = readdirSync(reportsDir)
    .map(f => ({ f, parsed: parseReportFile(f) }))
    .filter((x): x is { f: string; parsed: { label: string; sortKey: number } } => x.parsed !== null)
    .sort((a, b) => b.parsed.sortKey - a.parsed.sortKey);

  const items = files.length
    ? files.map(({ f, parsed }) =>
        `<li><a class="item" href="/reportes/Molinacasasola/${f}"><span>${parsed.label}</span><span class="arrow">&rarr;</span></a></li>`
      ).join("")
    : `<div class="empty">No hay reportes disponibles.</div>`;

  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Reportes · Molina Casasola</title>${PAGE_STYLE}</head><body>
    <div class="panel">
      <div class="eyebrow"><a href="/reportes" style="color:var(--gold);text-decoration:none;">&larr; Clientes</a> · Molina Casasola</div>
      <h1>Reportes semanales</h1>
      <ul style="margin-top:20px;">${items}</ul>
      <div class="footer-note">Generado por <strong>Miaia.ai</strong></div>
    </div></body></html>`);
});

app.get("/reportes/Molinacasasola/:filename", (req, res) => {
  const { filename } = req.params;
  if (!isReportFile(filename)) {
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
