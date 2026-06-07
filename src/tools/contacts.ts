import { z } from "zod";
import { KommoClient } from "../kommo-client.js";
import { loadAccounts, getAccount } from "../token-store.js";

export const contactTools = {
  get_contacts: {
    description:
      "Obtiene la lista de contactos de una cuenta Kommo. Permite buscar por nombre, teléfono o email.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      page: z.number().optional().describe("Número de página (default 1)"),
      limit: z.number().optional().describe("Contactos por página, max 250 (default 50)"),
      query: z.string().optional().describe("Búsqueda por nombre, teléfono, email"),
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
        with: "leads,customers",
      };
      if (params.query) query["query"] = params.query;

      const data = await client.request("GET", "/contacts", undefined, query);
      const contacts = data?._embedded?.contacts ?? [];
      return {
        account: acc.name,
        total: data?._total_items ?? contacts.length,
        contacts: contacts.map((c: any) => ({
          id: c.id,
          name: c.name,
          first_name: c.first_name,
          last_name: c.last_name,
          responsible_user_id: c.responsible_user_id,
          created_at: c.created_at,
          updated_at: c.updated_at,
          custom_fields_values: c.custom_fields_values,
          leads: c._embedded?.leads,
        })),
      };
    },
  },

  get_contact: {
    description: "Obtiene los detalles de un contacto específico por su ID.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      contact_id: z.number().describe("ID del contacto"),
    }),
    handler: async ({ account, contact_id }: { account: string; contact_id: number }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("GET", `/contacts/${contact_id}`, undefined, {
        with: "leads,customers",
      });
      return { account: acc.name, contact: data };
    },
  },

  create_contact: {
    description: "Crea uno o varios contactos nuevos en una cuenta Kommo.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      contacts: z
        .array(
          z.object({
            name: z.string().optional().describe("Nombre completo"),
            first_name: z.string().optional(),
            last_name: z.string().optional(),
            responsible_user_id: z.number().optional(),
            custom_fields_values: z
              .array(
                z.object({
                  field_code: z.string().optional().describe("Código del campo (ej: PHONE, EMAIL)"),
                  field_id: z.number().optional(),
                  values: z.array(
                    z.object({
                      value: z.any(),
                      enum_code: z.string().optional().describe("Tipo: WORK, HOME, MOB, etc."),
                    })
                  ),
                })
              )
              .optional(),
          })
        )
        .describe("Array de contactos a crear"),
    }),
    handler: async ({ account, contacts }: { account: string; contacts: any[] }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("POST", "/contacts", contacts);
      return { account: acc.name, created: data?._embedded?.contacts ?? data };
    },
  },

  update_contact: {
    description: "Actualiza un contacto existente.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      contact_id: z.number().describe("ID del contacto"),
      updates: z.object({
        name: z.string().optional(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        responsible_user_id: z.number().optional(),
        custom_fields_values: z
          .array(
            z.object({
              field_code: z.string().optional(),
              field_id: z.number().optional(),
              values: z.array(z.object({ value: z.any(), enum_code: z.string().optional() })),
            })
          )
          .optional(),
      }),
    }),
    handler: async ({
      account,
      contact_id,
      updates,
    }: {
      account: string;
      contact_id: number;
      updates: any;
    }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("PATCH", `/contacts/${contact_id}`, updates);
      return { account: acc.name, updated: data };
    },
  },
};
