// Client helpers for the { ok, data | error } API contract.
export class ClientApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } }
    | null;
  if (!json) throw new ClientApiError(res.status, "bad_response", "Unexpected response from the server.");
  if (!json.ok) throw new ClientApiError(res.status, json.error.code, json.error.message);
  return json.data;
}

export async function apiGet<T>(url: string): Promise<T> {
  return unwrap<T>(await fetch(url, { cache: "no-store" }));
}

export async function apiSend<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  return unwrap<T>(
    await fetch(url, {
      method,
      headers: isForm || body === undefined ? undefined : { "Content-Type": "application/json" },
      body: isForm ? (body as FormData) : body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

export function newKey(prefix = "k") {
  return `${prefix}_${crypto.randomUUID()}`;
}
