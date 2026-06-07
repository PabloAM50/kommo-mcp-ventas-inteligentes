import { KommoAccount } from "./token-store.js";

export class KommoClient {
  private account: KommoAccount;

  constructor(account: KommoAccount) {
    this.account = account;
  }

  get baseUrl(): string {
    return `https://${this.account.subdomain}.kommo.com/api/v4`;
  }

  async request<T = any>(
    method: string,
    path: string,
    body?: Record<string, any> | any[],
    query?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }

    const opts: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.account.token}`,
        "Content-Type": "application/json",
      },
    };
    if (body && method !== "GET") {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(url.toString(), opts);

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Kommo API error [${this.account.name}]: ${res.status} ${errBody}`);
    }

    if (res.status === 204) return {} as T;

    return res.json();
  }

  get accountName(): string {
    return this.account.name;
  }

  get subdomain(): string {
    return this.account.subdomain;
  }
}
