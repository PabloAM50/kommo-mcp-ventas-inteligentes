import { z } from "zod";
import { KommoClient } from "../kommo-client.js";
import { loadAccounts, getAccount } from "../token-store.js";

export const companyTools = {
  get_companies: {
    description: "Obtiene la lista de empresas de una cuenta Kommo.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      page: z.number().optional().describe("Número de página (default 1)"),
      limit: z.number().optional().describe("Empresas por página, max 250 (default 50)"),
      query: z.string().optional().describe("Búsqueda por nombre"),
    }),
    handler: async (params: {
      account: string;
      page?: number;
      limit?: number;
      query?: string;
    }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, params.account);
      if (!acc) return { error: `Cuenta "${params.account}" no encontrada` };

      const client = new KommoClient(acc);
      const query: Record<string, string> = {
        page: String(params.page ?? 1),
        limit: String(params.limit ?? 50),
        with: "leads,contacts",
      };
      if (params.query) query["query"] = params.query;

      const data = await client.request("GET", "/companies", undefined, query);
      const companies = data?._embedded?.companies ?? [];
      return {
        account: acc.name,
        total: data?._total_items ?? companies.length,
        companies: companies.map((c: any) => ({
          id: c.id,
          name: c.name,
          responsible_user_id: c.responsible_user_id,
          created_at: c.created_at,
          updated_at: c.updated_at,
          custom_fields_values: c.custom_fields_values,
          leads: c._embedded?.leads,
          contacts: c._embedded?.contacts,
        })),
      };
    },
  },

  get_company: {
    description: "Obtiene los detalles de una empresa específica por su ID.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      company_id: z.number().describe("ID de la empresa"),
    }),
    handler: async ({ account, company_id }: { account: string; company_id: number }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("GET", `/companies/${company_id}`, undefined, {
        with: "leads,contacts",
      });
      return { account: acc.name, company: data };
    },
  },

  create_company: {
    description: "Crea una o varias empresas nuevas en Kommo.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      companies: z
        .array(
          z.object({
            name: z.string().describe("Nombre de la empresa"),
            responsible_user_id: z.number().optional(),
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
        .describe("Array de empresas a crear"),
    }),
    handler: async ({ account, companies }: { account: string; companies: any[] }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("POST", "/companies", companies);
      return { account: acc.name, created: data?._embedded?.companies ?? data };
    },
  },
};
