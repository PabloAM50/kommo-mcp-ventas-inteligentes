import { z } from "zod";
import { KommoClient } from "../kommo-client.js";
import { loadAccounts, getAccount, KommoAccount } from "../token-store.js";

export const accountTools = {
  list_accounts: {
    description:
      "Lista todas las cuentas Kommo configuradas. Muestra nombre, subdominio y estado de conexión.",
    schema: z.object({}),
    handler: async () => {
      const accounts = loadAccounts();
      const list = accounts.map((a, i) => ({
        index: i + 1,
        name: a.name,
        subdomain: a.subdomain,
        has_token: !!a.token,
      }));
      return { total: list.length, accounts: list };
    },
  },

  get_account_info: {
    description:
      "Obtiene información detallada de una cuenta Kommo específica (plan, usuarios, moneda, etc).",
    schema: z.object({
      account: z.string().describe("Nombre o subdominio de la cuenta"),
    }),
    handler: async ({ account }: { account: string }) => {
      const accounts = loadAccounts();
      const acc = getAccount(accounts, account);
      if (!acc) return { error: `Cuenta "${account}" no encontrada` };

      const client = new KommoClient(acc);
      const data = await client.request("GET", "/account", undefined, {
        with: "amojo_id,amojo_rights,users_groups,task_types,version,datetime_settings,is_api_filter_enabled",
      });
      return { account: acc.name, subdomain: acc.subdomain, ...data };
    },
  },
};
