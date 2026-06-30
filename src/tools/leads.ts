import { z } from "zod";
import { KommoClient } from "../kommo-client.js";
import { loadAccounts, getAccount } from "../token-store.js";

export const leadTools = {
  get_leads: {
    description:
      "Obtiene la lista de leads de una cuenta Kommo. Permite filtrar por página, límite, query, responsable y estado del pipeline.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      page: z.number().optional().describe("Número de página (default 1)"),
      limit: z.number().optional().describe("Leads por página, max 250 (default 50)"),
      query: z.string().optional().describe("Búsqueda por nombre, teléfono, email, etc."),
      responsible_user_id: z.number().optional().describe("Filtrar por ID del responsable"),
      pipeline_id: z.number().optional().describe("Filtrar por ID de pipeline (embudo)"),
      statuses: z
        .array(
          z.object({
            pipeline_id: z.number(),
            status_id: z.number(),
          })
        )
        .optional()
        .describe("Filtrar por pipeline y estado"),
      order: z.string().optional().describe("Campo de orden: created_at, updated_at, id"),
    }),
    handler: async (params: {
      account: string;
      page?: number;
      limit?: number;
      query?: string;
      responsible_user_id?: number;
      pipeline_id?: number;
      statuses?: { pipeline_id: number; status_id: number }[];
      order?: string;
    }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, params.account);
      if (!acc) return { error: `Cuenta "${params.account}" no encontrada` };

      const client = new KommoClient(acc);
      const query: Record<string, string> = {
        page: String(params.page ?? 1),
        limit: String(params.limit ?? 50),
        with: "contacts,loss_reason,catalog_elements,source_id,tags",
      };
      if (params.query) query["query"] = params.query;
      if (params.responsible_user_id) query["filter[responsible_user_id]"] = String(params.responsible_user_id);
      if (params.pipeline_id) query["filter[pipeline_id]"] = String(params.pipeline_id);
      if (params.statuses && params.statuses.length > 0) {
        params.statuses.forEach((s, i) => {
          query[`filter[${i}][pipeline_id]`] = String(s.pipeline_id);
          query[`filter[${i}][status_id]`] = String(s.status_id);
        });
      }
      if (params.order) query["order[updated_at]"] = params.order === "asc" ? "asc" : "desc";

      const data = await client.request("GET", "/leads", undefined, query);
      const leads = data?._embedded?.leads ?? [];
      return {
        account: acc.name,
        total: data?._total_items ?? leads.length,
        page: params.page ?? 1,
        leads: leads.map((l: any) => ({
          id: l.id,
          name: l.name,
          price: l.price,
          responsible_user_id: l.responsible_user_id,
          pipeline_id: l.pipeline_id,
          status_id: l.status_id,
          created_at: l.created_at,
          updated_at: l.updated_at,
          loss_reason: l.loss_reason,
          contacts: l._embedded?.contacts,
          tags: (l._embedded?.tags ?? []).map((t: any) => ({
            id: t.id,
            name: t.name,
            color: t.color,
          })),
        })),
      };
    },
  },

  get_lead: {
    description: "Obtiene los detalles de un lead específico por su ID.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      lead_id: z.number().describe("ID del lead"),
    }),
    handler: async ({ account, lead_id }: { account: string; lead_id: number }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("GET", `/leads/${lead_id}`, undefined, {
        with: "contacts,loss_reason,catalog_elements,source_id",
      });
      return { account: acc.name, lead: data };
    },
  },

  create_lead: {
    description: "Crea uno o varios leads nuevos en una cuenta Kommo.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      leads: z
        .array(
          z.object({
            name: z.string().describe("Nombre del lead"),
            price: z.number().optional().describe("Valor/precio del lead"),
            pipeline_id: z.number().optional().describe("ID del pipeline"),
            status_id: z.number().optional().describe("ID del estado en el pipeline"),
            responsible_user_id: z.number().optional().describe("ID del usuario responsable"),
            custom_fields_values: z
              .array(
                z.object({
                  field_id: z.number(),
                  values: z.array(z.object({ value: z.any() })),
                })
              )
              .optional(),
          })
        )
        .describe("Array de leads a crear"),
    }),
    handler: async ({ account, leads }: { account: string; leads: any[] }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("POST", "/leads", leads);
      return { account: acc.name, created: data?._embedded?.leads ?? data };
    },
  },

  update_lead: {
    description: "Actualiza un lead existente (precio, estado, responsable, campos custom).",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      lead_id: z.number().describe("ID del lead a actualizar"),
      updates: z.object({
        name: z.string().optional(),
        price: z.number().optional(),
        pipeline_id: z.number().optional(),
        status_id: z.number().optional(),
        responsible_user_id: z.number().optional(),
        custom_fields_values: z
          .array(
            z.object({
              field_id: z.number(),
              values: z.array(z.object({ value: z.any() })),
            })
          )
          .optional(),
      }),
    }),
    handler: async ({
      account,
      lead_id,
      updates,
    }: {
      account: string;
      lead_id: number;
      updates: any;
    }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("PATCH", `/leads/${lead_id}`, updates);
      return { account: acc.name, updated: data };
    },
  },
};
