import { z } from "zod";
import { KommoClient } from "../kommo-client.js";
import { loadAccounts, getAccount } from "../token-store.js";

export const eventTools = {
  get_events: {
    description:
      "Obtiene los eventos recientes de una cuenta Kommo (actividad: leads creados, notas, llamadas, cambios de estado, etc.).",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      page: z.number().optional().describe("Número de página (default 1)"),
      limit: z.number().optional().describe("Eventos por página, max 100 (default 50)"),
      types: z
        .array(z.string())
        .optional()
        .describe(
          "Tipos de evento a filtrar: lead_added, lead_status_changed, contact_added, note_added, task_added, incoming_call, outgoing_call, etc."
        ),
      created_at_from: z
        .number()
        .optional()
        .describe("Filtrar desde fecha (Unix timestamp)"),
      created_at_to: z
        .number()
        .optional()
        .describe("Filtrar hasta fecha (Unix timestamp)"),
    }),
    handler: async (params: {
      account: string;
      page?: number;
      limit?: number;
      types?: string[];
      created_at_from?: number;
      created_at_to?: number;
    }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, params.account);
      if (!acc) return { error: `Cuenta "${params.account}" no encontrada` };

      const client = new KommoClient(acc);
      const query: Record<string, string> = {
        page: String(params.page ?? 1),
        limit: String(params.limit ?? 50),
      };
      if (params.types) {
        params.types.forEach((t, i) => {
          query[`filter[type][]`] = t;
        });
      }
      if (params.created_at_from)
        query["filter[created_at][from]"] = String(params.created_at_from);
      if (params.created_at_to)
        query["filter[created_at][to]"] = String(params.created_at_to);

      const data = await client.request("GET", "/events", undefined, query);
      const events = data?._embedded?.events ?? [];
      return {
        account: acc.name,
        total: data?._total_items ?? events.length,
        events: events.map((e: any) => ({
          id: e.id,
          type: e.type,
          entity_id: e.entity_id,
          entity_type: e.entity_type,
          created_by: e.created_by,
          created_at: e.created_at,
          value_before: e.value_before,
          value_after: e.value_after,
        })),
      };
    },
  },

  get_users: {
    description:
      "Obtiene la lista de usuarios de una cuenta Kommo (responsables, vendedores, etc.).",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
    }),
    handler: async ({ account }: { account: string }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("GET", "/users");
      const users = data?._embedded?.users ?? [];
      return {
        account: acc.name,
        users: users.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          lang: u.lang,
          rights: u.rights,
        })),
      };
    },
  },

  multi_account_summary: {
    description:
      "Obtiene un resumen rápido de TODAS las cuentas configuradas: leads activos, tareas pendientes, y actividad reciente. Ideal para dashboard multi-cuenta.",
    schema: z.object({}),
    handler: async () => {
      const accounts = loadAccounts();
      const summaries = [];

      for (const acc of accounts) {
        if (!acc.token) {
          summaries.push({
            name: acc.name,
            subdomain: acc.subdomain,
            status: "sin_token",
          });
          continue;
        }

        try {
          const client = new KommoClient(acc);

          const [leadsRes, tasksRes] = await Promise.all([
            client.request("GET", "/leads", undefined, { limit: "1" }).catch(() => null),
            client
              .request("GET", "/tasks", undefined, {
                limit: "1",
                "filter[is_completed]": "0",
              })
              .catch(() => null),
          ]);

          summaries.push({
            name: acc.name,
            subdomain: acc.subdomain,
            status: "conectado",
            total_leads: leadsRes?._total_items ?? 0,
            pending_tasks: tasksRes?._total_items ?? 0,
          });
        } catch (err: any) {
          summaries.push({
            name: acc.name,
            subdomain: acc.subdomain,
            status: "error",
            error: err.message,
          });
        }
      }

      return { accounts: summaries, total_accounts: summaries.length };
    },
  },
};
