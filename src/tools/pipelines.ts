import { z } from "zod";
import { KommoClient } from "../kommo-client.js";
import { loadAccounts, getAccount } from "../token-store.js";

export const pipelineTools = {
  get_pipelines: {
    description:
      "Obtiene todos los pipelines (embudos de venta) y sus etapas de una cuenta Kommo.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
    }),
    handler: async ({ account }: { account: string }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("GET", "/leads/pipelines");
      const pipelines = data?._embedded?.pipelines ?? [];
      return {
        account: acc.name,
        pipelines: pipelines.map((p: any) => ({
          id: p.id,
          name: p.name,
          sort: p.sort,
          is_main: p.is_main,
          is_archive: p.is_archive,
          statuses: (p._embedded?.statuses ?? []).map((s: any) => ({
            id: s.id,
            name: s.name,
            sort: s.sort,
            color: s.color,
            type: s.type,
          })),
        })),
      };
    },
  },

  get_pipeline: {
    description: "Obtiene un pipeline específico con sus etapas.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      pipeline_id: z.number().describe("ID del pipeline"),
    }),
    handler: async ({ account, pipeline_id }: { account: string; pipeline_id: number }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("GET", `/leads/pipelines/${pipeline_id}`);
      return { account: acc.name, pipeline: data };
    },
  },

  get_pipeline_leads_summary: {
    description:
      "Obtiene un resumen de cuántos leads hay en cada etapa de un pipeline. Útil para dashboard rápido.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      pipeline_id: z.number().describe("ID del pipeline"),
    }),
    handler: async ({ account, pipeline_id }: { account: string; pipeline_id: number }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);

      const pipelineData = await client.request("GET", `/leads/pipelines/${pipeline_id}`);
      const statuses = pipelineData?._embedded?.statuses ?? [];

      const leadsData = await client.request("GET", "/leads", undefined, {
        limit: "250",
        "filter[pipeline_id]": String(pipeline_id),
        with: "contacts",
      });
      const leads = leadsData?._embedded?.leads ?? [];

      const summary = statuses.map((s: any) => {
        const stageLeads = leads.filter((l: any) => l.status_id === s.id);
        const totalValue = stageLeads.reduce((sum: number, l: any) => sum + (l.price || 0), 0);
        return {
          status_id: s.id,
          status_name: s.name,
          color: s.color,
          lead_count: stageLeads.length,
          total_value: totalValue,
        };
      });

      return {
        account: acc.name,
        pipeline_id,
        pipeline_name: pipelineData.name,
        total_leads: leads.length,
        total_value: leads.reduce((sum: number, l: any) => sum + (l.price || 0), 0),
        stages: summary,
      };
    },
  },
};
