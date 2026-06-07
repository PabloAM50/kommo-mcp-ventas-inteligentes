import { z } from "zod";
import { KommoClient } from "../kommo-client.js";
import { loadAccounts, getAccount } from "../token-store.js";

export const taskTools = {
  get_tasks: {
    description:
      "Obtiene la lista de tareas de una cuenta Kommo. Puede filtrar por responsable y si están completadas o no.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      page: z.number().optional().describe("Número de página (default 1)"),
      limit: z.number().optional().describe("Tareas por página, max 250 (default 50)"),
      responsible_user_id: z.number().optional().describe("Filtrar por ID del responsable"),
      is_completed: z.boolean().optional().describe("true = completadas, false = pendientes"),
    }),
    handler: async (params: {
      account: string;
      page?: number;
      limit?: number;
      responsible_user_id?: number;
      is_completed?: boolean;
    }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, params.account);
      if (!acc) return { error: `Cuenta "${params.account}" no encontrada` };

      const client = new KommoClient(acc);
      const query: Record<string, string> = {
        page: String(params.page ?? 1),
        limit: String(params.limit ?? 50),
      };
      if (params.responsible_user_id)
        query["filter[responsible_user_id]"] = String(params.responsible_user_id);
      if (params.is_completed !== undefined)
        query["filter[is_completed]"] = params.is_completed ? "1" : "0";

      const data = await client.request("GET", "/tasks", undefined, query);
      const tasks = data?._embedded?.tasks ?? [];
      return {
        account: acc.name,
        total: data?._total_items ?? tasks.length,
        tasks: tasks.map((t: any) => ({
          id: t.id,
          text: t.text,
          task_type_id: t.task_type_id,
          complete_till: t.complete_till,
          is_completed: t.is_completed,
          responsible_user_id: t.responsible_user_id,
          entity_id: t.entity_id,
          entity_type: t.entity_type,
          created_at: t.created_at,
          updated_at: t.updated_at,
          result: t.result,
        })),
      };
    },
  },

  get_task: {
    description: "Obtiene los detalles de una tarea específica por su ID.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      task_id: z.number().describe("ID de la tarea"),
    }),
    handler: async ({ account, task_id }: { account: string; task_id: number }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("GET", `/tasks/${task_id}`);
      return { account: acc.name, task: data };
    },
  },

  create_task: {
    description: "Crea una o varias tareas nuevas en Kommo.",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      tasks: z
        .array(
          z.object({
            text: z.string().describe("Descripción de la tarea"),
            complete_till: z.number().describe("Fecha límite (Unix timestamp)"),
            entity_id: z.number().optional().describe("ID de la entidad asociada (lead, contacto)"),
            entity_type: z
              .string()
              .optional()
              .describe("Tipo de entidad: leads, contacts, companies"),
            task_type_id: z.number().optional().describe("Tipo de tarea (1=llamada, 2=reunión, etc.)"),
            responsible_user_id: z.number().optional(),
          })
        )
        .describe("Array de tareas a crear"),
    }),
    handler: async ({ account, tasks }: { account: string; tasks: any[] }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("POST", "/tasks", tasks);
      return { account: acc.name, created: data?._embedded?.tasks ?? data };
    },
  },

  update_task: {
    description: "Actualiza una tarea existente (completar, cambiar fecha, etc).",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
      task_id: z.number().describe("ID de la tarea"),
      updates: z.object({
        text: z.string().optional(),
        complete_till: z.number().optional(),
        is_completed: z.boolean().optional(),
        responsible_user_id: z.number().optional(),
        result: z.object({ text: z.string() }).optional().describe("Resultado al completar"),
      }),
    }),
    handler: async ({
      account,
      task_id,
      updates,
    }: {
      account: string;
      task_id: number;
      updates: any;
    }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("PATCH", `/tasks/${task_id}`, updates);
      return { account: acc.name, updated: data };
    },
  },
};
