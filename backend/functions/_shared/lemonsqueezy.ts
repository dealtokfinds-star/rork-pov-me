/**
 * Lemon Squeezy REST + webhook helpers for edge functions.
 * Uses fetch against https://api.lemonsqueezy.com/v1 to avoid bundling an SDK.
 *
 * POVMe uses Lemon Squeezy as a Merchant of Record (MoR): LS handles cards,
 * tax/VAT/GST globally, chargebacks, and fraud. POVMe is the seller of record
 * and receives net proceeds to its bank account; the platform pays each
 * creator their 80% share out-of-band (admin-triggered weekly payout).
 */

const LS_API = "https://api.lemonsqueezy.com/v1";

export class LemonSqueezyError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "LemonSqueezyError";
    this.status = status;
    this.body = body;
  }
}

function getApiKey(): string {
  const key = Deno.env.get("LEMONSQUEEZY_API_KEY");
  if (!key) throw new Error("LEMONSQUEEZY_API_KEY is not set");
  return key;
}

function getStoreId(): string {
  const id = Deno.env.get("LEMONSQUEEZY_STORE_ID");
  if (!id) throw new Error("LEMONSQUEEZY_STORE_ID is not set");
  return id;
}

/** JSON:API request helper. Returns the parsed `data` payload. */
export async function lsRequest<T = unknown>(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${getApiKey()}`,
  };
  const init: RequestInit = { method, headers };
  if (options.body) init.body = JSON.stringify(options.body);

  const res = await fetch(`${LS_API}${path}`, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { errors?: Array<{ detail?: string }> })?.errors?.[0]?.detail ??
      `Lemon Squeezy ${res.status}`;
    throw new LemonSqueezyError(message, res.status, data);
  }
  return data as T;
}

// ---- Typed responses (subset of fields we use) ----

export interface LSCheckout {
  id: string;
  type: "checkouts";
  attributes: {
    url: string;
    status: "open" | "completed" | "expired";
    expires_at: string | null;
    created_at: string;
    custom_data: Record<string, string> | null;
  };
}

export interface LSVariant {
  id: string;
  type: "variants";
  attributes: {
    name: string;
    price: number; // cents
    sku: string | null;
    is_subscription: boolean;
    interval: "month" | "year" | "day" | "week" | null;
    status: "active" | "draft";
  };
}

export interface LSProduct {
  id: string;
  type: "products";
  attributes: {
    name: string;
    description: string | null;
    status: "active" | "draft";
  };
}

// ---- Webhook signature verification ----

/**
 * Verify a Lemon Squeezy webhook signature. LS signs the raw payload body with
 * HMAC-SHA256 using the webhook signing secret and sends the hex digest in the
 * `X-Signature` header. Returns true if the signature matches.
 */
export async function verifyLsSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const secret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET");
  if (!secret || !signatureHeader) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time-ish compare
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

// ---- Checkout helpers ----

/**
 * Create a Lemon Squeezy checkout for a one-time purchase (tip / PPV / top-up).
 * LS-hosted checkout handles card collection, tax, and fraud.
 */
export async function createCheckout(params: {
  variantId: string;
  email?: string;
  name?: string;
  customData?: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
  preview?: boolean;
}): Promise<LSCheckout> {
  const data = await lsRequest<{ data: LSCheckout }>("/checkouts", {
    method: "POST",
    body: {
      data: {
        type: "checkouts",
        attributes: {
          ...(params.email ? { email: params.email } : {}),
          ...(params.name ? { name: params.name } : {}),
          ...(params.customData ? { custom_data: params.customData } : {}),
          ...(params.successUrl ? { product_options: { redirect_url: params.successUrl } } : {}),
          ...(params.cancelUrl ? { custom_options: { cancel_url: params.cancelUrl } } : {}),
          ...(params.preview ? { preview: true } : {}),
        },
        relationships: {
          store: { data: { type: "stores", id: getStoreId() } },
          variant: { data: { type: "variants", id: params.variantId } },
        },
      },
    },
  });
  return data.data;
}

/** List variants for a product (to find a price id for subscriptions). */
export async function listVariants(productId: string): Promise<LSVariant[]> {
  const data = await lsRequest<{ data: LSVariant[] }>(
    `/variants?filter[product_id]=${productId}`,
  );
  return data.data;
}

/** Retrieve a single variant by id. */
export async function getVariant(variantId: string): Promise<LSVariant> {
  const data = await lsRequest<{ data: LSVariant }>(`/variants/${variantId}`);
  return data.data;
}

/** Create a product (parent of variants). */
export async function createProduct(params: {
  name: string;
  description?: string;
}): Promise<LSProduct> {
  const data = await lsRequest<{ data: LSProduct }>("/products", {
    method: "POST",
    body: {
      data: {
        type: "products",
        attributes: {
          name: params.name,
          description: params.description ?? "",
          store_id: getStoreId(),
          status: "active",
        },
      },
    },
  });
  return data.data;
}

/** Create a variant (price) under a product. */
export async function createVariant(params: {
  productId: string;
  name: string;
  priceCents: number;
  isSubscription?: boolean;
  interval?: "month" | "year";
  customData?: Record<string, string>;
}): Promise<LSVariant> {
  const data = await lsRequest<{ data: LSVariant }>("/variants", {
    method: "POST",
    body: {
      data: {
        type: "variants",
        attributes: {
          name: params.name,
          price: params.priceCents,
          is_subscription: params.isSubscription ?? false,
          ...(params.interval ? { interval: params.interval } : {}),
          ...(params.customData ? { custom_data: params.customData } : {}),
          status: "active",
        },
        relationships: {
          product: { data: { type: "products", id: params.productId } },
        },
      },
    },
  });
  return data.data;
}

// ---- Webhook payload shape (subset) ----

export interface LSEvent {
  meta: {
    event_name: string;
    custom_data: Record<string, string> | null;
    store_id: string;
  };
  data: {
    id: string;
    type: string;
    attributes: {
      status: string;
      total: number; // cents
      currency: string;
      subtotal: number;
      tax: number;
      customer_id?: string;
      email?: string;
      created_at: string;
      updated_at: string;
      // subscription fields (only on subscription events)
      status_formatted?: string;
      renews_at?: string | null;
      ends_at?: string | null;
      cancelled?: boolean;
      variant_id?: string;
      product_id?: string;
      // order fields
      first_order_item?: {
        id: string;
        order_id: string;
        product_id: string;
        variant_id: string;
        product_name: string;
        variant_name: string;
        price: number;
        quantity: number;
      };
      refunded?: boolean;
      refunded_at?: string | null;
    };
  };
}

/** Cents → dollars (LS amounts are in cents, like Stripe). */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/** Decide whether to use Lemon Squeezy as the payment provider. */
export function useLemonSqueezy(): boolean {
  return (Deno.env.get("PAYMENT_PROVIDER") ?? "lemonsqueezy").toLowerCase() ===
    "lemonsqueezy";
}
