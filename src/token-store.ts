import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACCOUNTS_PATH = join(__dirname, "..", "accounts.json");

export interface KommoAccount {
  name: string;
  subdomain: string;
  token: string;
}

export function loadAccounts(): KommoAccount[] {
  if (process.env.KOMMO_ACCOUNTS) {
    return JSON.parse(process.env.KOMMO_ACCOUNTS);
  }

  if (!existsSync(ACCOUNTS_PATH)) {
    throw new Error(
      `No se encontró accounts.json en ${ACCOUNTS_PATH}. Copia accounts.example.json y configura tus cuentas, o define la variable de entorno KOMMO_ACCOUNTS.`
    );
  }
  return JSON.parse(readFileSync(ACCOUNTS_PATH, "utf-8"));
}

export function getAccount(accounts: KommoAccount[], nameOrSubdomain: string): KommoAccount | undefined {
  const q = nameOrSubdomain.toLowerCase();
  return accounts.find(
    (a) => a.name.toLowerCase() === q || a.subdomain.toLowerCase() === q
  );
}
