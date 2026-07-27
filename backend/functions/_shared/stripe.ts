/**
 * Minimal Stripe REST helpers for edge functions.
 * We use fetch against https://api.stripe.com/v1 to avoid bundling the SDK.
 */

const STRIPE_API = "https://api.stripe.com/v1";

export class StripeError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "StripeError";
    this.status = status;
    this.body = body;
  }
}

function getSecretKey(): string {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return key;
}

/** URL-encode a flat or one-level-nested object for x-www-form-urlencoded bodies. */
function encodeForm(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v === undefined || v === null) continue;
        parts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(String(v))}`);
      }
    } else if (typeof value === "object") {
      for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
        if (subVal === undefined || subVal === null) continue;
        parts.push(
          `${encodeURIComponent(key)}[${encodeURIComponent(subKey)}]=${encodeURIComponent(String(subVal))}`,
        );
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join("&");
}

export async function stripeRequest<T = unknown>(
  path: string,
  options: { method?: string; params?: Record<string, unknown>; stripeAccount?: string } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (options.stripeAccount) headers["Stripe-Account"] = options.stripeAccount;
  const init: RequestInit = { method, headers };
  let url = `${STRIPE_API}${path}`;
  if (options.params) {
    const body = encodeForm(options.params);
    if (method === "GET" || method === "DELETE") {
      url += `?${body}`;
    } else {
      init.body = body;
    }
  }

  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { error?: { message?: string } })?.error?.message ??
      `Stripe ${res.status}`;
    throw new StripeError(message, res.status, data);
  }
  return data as T;
}

// ---- Typed responses (subset of fields we use) ----

export interface VerificationSession {
  id: string;
  object: string;
  url: string;
  status: string;
  last_verification_error?: { reason?: string } | null;
  verified?: boolean;
  redaction?: { status?: string } | null;
}

export interface Account {
  id: string;
  object: string;
  details_submitted?: boolean;
  payouts_enabled?: boolean;
  requirements?: {
    currently_due?: string[];
    eventually_due?: string[];
    disabled_reason?: string | null;
  };
  capabilities?: Record<string, { status?: string }>;
}

export interface AccountLink {
  object: string;
  url: string;
  expires_at: number;
}

export interface BalanceTransaction {
  id: string;
  amount: number;
  currency: string;
  fee: number;
  net: number;
  type: string;
  created: number;
}

export interface Customer {
  id: string;
  object: string;
  email?: string;
  name?: string;
  default_source?: string;
  balance?: number;
}

export interface Price {
  id: string;
  object: string;
  unit_amount: number;
  currency: string;
  recurring?: {
    interval: "month" | "year" | "week";
    interval_count: number;
  };
  product: string;
  active: boolean;
}

export interface Product {
  id: string;
  object: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface Subscription {
  id: string;
  object: string;
  status: "active" | "canceled" | "past_due" | "trialing" | "ended";
  customer: string;
  current_period_start: number;
  current_period_end: number;
  canceled_at?: number | null;
  items: {
    data: Array<{
      id: string;
      price: Price;
      quantity: number;
    }>;
  };
  metadata?: Record<string, string>;
}

export interface CheckoutSession {
  id: string;
  object: string;
  url: string;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired";
  customer?: string;
  subscription?: string;
  payment_intent?: string;
  mode: "payment" | "setup" | "subscription";
  amount_total?: number;
  metadata?: Record<string, string>;
}

export interface PaymentIntent {
  id: string;
  object: string;
  amount: number;
  currency: string;
  status: string;
  client_secret?: string;
  customer?: string;
  metadata?: Record<string, string>;
  charges?: {
    data: Array<{
      id: string;
      balance_transaction: string | BalanceTransaction;
      transfer?: string;
      transfer_data?: {
        destination: string;
        amount?: number;
      };
    }>;
  };
}

export interface Payout {
  id: string;
  object: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "in_transit" | "failed" | "canceled";
  arrival_date: number;
  method: "standard" | "instant";
  destination: string;
  failure_reason?: string | null;
}

export interface Balance {
  object: string;
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
  instant_available?: Array<{ amount: number; currency: string }>;
}

export interface Transfer {
  id: string;
  object: string;
  amount: number;
  currency: string;
  destination: string;
  destination_payment?: string;
  transfer_group?: string;
}

export interface Invoice {
  id: string;
  object: string;
  status: "draft" | "open" | "paid" | "uncollectible" | "void";
  customer: string;
  subscription?: string;
  amount_paid: number;
  total: number;
  currency: string;
  charge?: string;
  payment_intent?: string;
  metadata?: Record<string, string>;
}

// ---- Convenience wrappers ----

export function createVerificationSession(params: {
  metadata_user_id: string;
  return_url: string;
}): Promise<VerificationSession> {
  return stripeRequest<VerificationSession>("/identity/verification_sessions", {
    method: "POST",
    params: {
      type: "document",
      metadata: { user_id: params.metadata_user_id },
      "options[document][require_matching_selfie]": true,
      "options[document][require_live_capture]": true,
      return_url: params.return_url,
    },
  });
}

export function retrieveVerificationSession(id: string): Promise<VerificationSession> {
  return stripeRequest<VerificationSession>(`/identity/verification_sessions/${id}`);
}

export function createConnectAccount(params: {
  email: string;
  country: string;
  metadata_user_id: string;
}): Promise<Account> {
  return stripeRequest<Account>("/accounts", {
    method: "POST",
    params: {
      type: "express",
      country: params.country,
      email: params.email,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      metadata: { user_id: params.metadata_user_id },
      "business_type": "individual",
      "tos_acceptance[service_agreement]": "full",
    },
  });
}

export function createAccountLink(params: {
  account: string;
  refresh_url: string;
  return_url: string;
}): Promise<AccountLink> {
  return stripeRequest<AccountLink>("/account_links", {
    method: "POST",
    params: {
      account: params.account,
      type: "account_onboarding",
      refresh_url: params.refresh_url,
      return_url: params.return_url,
    },
  });
}

export function retrieveAccount(id: string): Promise<Account> {
  return stripeRequest<Account>(`/accounts/${id}`);
}

// ---- Customer helpers ----

export function createCustomer(params: {
  email: string;
  name?: string;
  metadata_user_id: string;
}): Promise<Customer> {
  return stripeRequest<Customer>("/customers", {
    method: "POST",
    params: {
      email: params.email,
      name: params.name,
      metadata: { user_id: params.metadata_user_id },
    },
  });
}

export function retrieveCustomer(id: string): Promise<Customer> {
  return stripeRequest<Customer>(`/customers/${id}`);
}

export function listCustomersByEmail(email: string): Promise<{ data: Customer[] }> {
  return stripeRequest<{ data: Customer[] }>("/customers", {
    params: { email },
  });
}

// ---- Product & Price helpers (for subscriptions) ----

export function createProduct(params: {
  name: string;
  description?: string;
  metadata_creator_id: string;
}): Promise<Product> {
  return stripeRequest<Product>("/products", {
    method: "POST",
    params: {
      name: params.name,
      description: params.description,
      metadata: { creator_id: params.metadata_creator_id },
    },
  });
}

export function createPrice(params: {
  product: string;
  unit_amount: number;
  currency: string;
  recurring_interval: "month";
  metadata_creator_id: string;
}): Promise<Price> {
  return stripeRequest<Price>("/prices", {
    method: "POST",
    params: {
      product: params.product,
      unit_amount: params.unit_amount,
      currency: params.currency,
      recurring: { interval: params.recurring_interval },
      metadata: { creator_id: params.metadata_creator_id },
    },
  });
}

export function listPricesForProduct(productId: string): Promise<{ data: Price[] }> {
  return stripeRequest<{ data: Price[] }>("/prices", {
    params: { product: productId, active: true },
  });
}

// ---- Checkout Session helpers ----

export function createCheckoutSession(params: {
  mode: "payment" | "subscription";
  customer?: string;
  customer_email?: string;
  line_items?: Array<{
    price?: string;
    quantity?: number;
    price_data?: {
      currency: string;
      unit_amount: number;
      product_data?: { name: string; description?: string; metadata?: Record<string, string> };
      recurring?: { interval: "month" | "year" | "week" };
    };
  }>;
  metadata?: Record<string, string>;
  success_url: string;
  cancel_url: string;
  application_fee_amount?: number;
  transfer_data?: { destination: string; amount?: number };
  payment_intent_data?: {
    application_fee_amount?: number;
    transfer_data?: { destination: string };
    metadata?: Record<string, string>;
  };
  subscription_data?: {
    application_fee_percent?: number;
    metadata?: Record<string, string>;
  };
  tax_id_collection?: { enabled: boolean };
  automatic_tax?: { enabled: boolean };
}): Promise<CheckoutSession> {
  const p: Record<string, unknown> = {
    mode: params.mode,
    success_url: params.success_url,
    cancel_url: params.cancel_url,
  };
  if (params.customer) p.customer = params.customer;
  if (params.customer_email) p.customer_email = params.customer_email;
  if (params.metadata) p.metadata = params.metadata;
  if (params.application_fee_amount !== undefined) p.application_fee_amount = params.application_fee_amount;
  if (params.transfer_data) p.transfer_data = params.transfer_data;
  if (params.payment_intent_data) p.payment_intent_data = params.payment_intent_data;
  if (params.subscription_data) p.subscription_data = params.subscription_data;
  if (params.tax_id_collection) p.tax_id_collection = params.tax_id_collection;
  if (params.automatic_tax) p.automatic_tax = params.automatic_tax;
  if (params.line_items) {
    p.line_items = params.line_items;
  }
  return stripeRequest<CheckoutSession>("/checkout/sessions", { method: "POST", params: p });
}

export function retrieveCheckoutSession(id: string): Promise<CheckoutSession> {
  return stripeRequest<CheckoutSession>(`/checkout/sessions/${id}`);
}

// ---- PaymentIntent helpers ----

export function retrievePaymentIntent(id: string): Promise<PaymentIntent> {
  return stripeRequest<PaymentIntent>(`/payment_intents/${id}`);
}

// ---- Subscription helpers ----

export function retrieveSubscription(id: string): Promise<Subscription> {
  return stripeRequest<Subscription>(`/subscriptions/${id}`);
}

export function cancelSubscription(id: string): Promise<Subscription> {
  return stripeRequest<Subscription>(`/subscriptions/${id}`, { method: "DELETE" });
}

// ---- Transfer helpers (for creator payouts / split) ----

export function createTransfer(params: {
  amount: number;
  currency: string;
  destination: string;
  transfer_group?: string;
  metadata?: Record<string, string>;
}): Promise<Transfer> {
  return stripeRequest<Transfer>("/transfers", {
    method: "POST",
    params: {
      amount: params.amount,
      currency: params.currency,
      destination: params.destination,
      transfer_group: params.transfer_group,
      metadata: params.metadata,
    },
  });
}

// ---- Balance helpers ----

export function retrieveBalance(account?: string): Promise<Balance> {
  return stripeRequest<Balance>("/balance", account ? { stripeAccount: account } : {});
}

export function createPayout(params: {
  amount: number;
  currency: string;
  destination?: string;
  method?: "standard" | "instant";
  metadata?: Record<string, string>;
}, account?: string): Promise<Payout> {
  const p: Record<string, unknown> = {
    amount: params.amount,
    currency: params.currency,
    method: params.method ?? "standard",
  };
  if (params.destination) p.destination = params.destination;
  if (params.metadata) p.metadata = params.metadata;
  return stripeRequest<Payout>("/payouts", {
    method: "POST",
    params: p,
    stripeAccount: account,
  });
}

/** List recent payouts on a connected account (default 10, newest first). */
export function listPayouts(account: string, limit = 10): Promise<{ data: Payout[]; has_more: boolean }> {
  return stripeRequest<{ data: Payout[]; has_more: boolean }>("/payouts", {
    params: { limit, "arrival_date[gt]": 0 },
    stripeAccount: account,
  });
}

/** List external accounts (banks/cards) on a connected account. */
export function listExternalAccounts(
  account: string,
  type: "bank_account" | "card" = "bank_account",
): Promise<{ data: Array<{ id: string; object: string; last4?: string; bank_name?: string; brand?: string; currency?: string }> }> {
  return stripeRequest<{ data: Array<{ id: string; object: string; last4?: string; bank_name?: string; brand?: string; currency?: string }> }>(
    `/accounts/${account}/external_accounts`,
    { params: { object: type } },
  );
}

// ---- Invoice helpers ----

export function retrieveInvoice(id: string): Promise<Invoice> {
  return stripeRequest<Invoice>(`/invoices/${id}`);
}

// ---- Tax helper (Stripe Tax) ----

export function createTaxCalculation(params: {
  currency: string;
  line_items: Array<{ amount: number; reference: string; quantity?: number }>;
  customer_details: { address: { country: string; postal_code?: string }; address_country?: string };
}): Promise<{ id: string; tax_amount_excluding_tax: number; tax: number }> {
  return stripeRequest<{ id: string; tax_amount_excluding_tax: number; tax: number }>(
    "/tax/calculations",
    { method: "POST", params: { ...params } },
  );
}
