import { getSupabaseAdmin } from "@/lib/data/supabase";
import { hashString } from "@/lib/utils";

interface FetchOptions extends RequestInit {
  cacheTtlSeconds?: number;
  cacheKey?: string;
  force?: boolean;
  sourceId?: string;
  asText?: boolean;
  timeoutMs?: number;
}

export interface FetchResult<T = unknown> {
  data: T;
  url: string;
  retrievedAt: string;
  status: number;
  fromCache: boolean;
  stale?: boolean;
  contentType?: string;
}

const DEFAULT_TTL = Number(process.env.SOURCE_CACHE_TTL_SECONDS ?? 3600);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithCache<T = unknown>(url: string, options: FetchOptions = {}): Promise<FetchResult<T>> {
  const {
    cacheTtlSeconds = DEFAULT_TTL,
    cacheKey = hashString(`${options.method ?? "GET"}:${url}:${options.body?.toString() ?? ""}`),
    force = false,
    sourceId,
    asText = false,
    timeoutMs = force ? 9000 : 4000,
    cache: requestCache,
    headers,
    next: _next,
    ...fetchInit
  } = options as FetchOptions & { next?: unknown };

  const supabase = getSupabaseAdmin();
  const now = new Date();

  if (supabase && !force) {
    const { data } = await supabase
      .from("raw_payloads")
      .select("*")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (data?.payload && new Date(data.expires_at).getTime() > now.getTime()) {
      return {
        data: data.payload as T,
        url,
        retrievedAt: data.retrieved_at,
        status: data.status ?? 200,
        fromCache: true,
        contentType: data.content_type ?? undefined
      };
    }
  }

  let lastError: unknown;
  const maxAttempts = force ? 2 : 1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const requestHeaders = new Headers(headers);
      requestHeaders.set("User-Agent", "MacroIntelligenceDashboard/0.1 contact=personal-dashboard");
      requestHeaders.set("Accept", asText ? "text/*,*/*" : "application/json,text/csv,text/plain,*/*");
      const requestInit: RequestInit = {
        ...fetchInit,
        signal: controller.signal,
        cache: force ? "no-store" : requestCache,
        headers: requestHeaders
      };
      const response = await fetch(
        url,
        force
          ? requestInit
          : ({ ...requestInit, next: { revalidate: cacheTtlSeconds } } as RequestInit & { next: { revalidate: number } })
      );
      clearTimeout(timeout);

      const contentType = response.headers.get("content-type") ?? undefined;
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        if (attempt < maxAttempts - 1) {
          await sleep((retryAfter || 2 ** attempt) * 1000);
          continue;
        }
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${url}`);
      }

      const payload = asText || contentType?.includes("text/") || contentType?.includes("csv")
        ? await response.text()
        : await response.json();

      const retrievedAt = new Date().toISOString();
      if (supabase) {
        await supabase.from("raw_payloads").upsert({
          cache_key: cacheKey,
          source_id: sourceId,
          url,
          payload: payload as unknown,
          content_type: contentType,
          status: response.status,
          retrieved_at: retrievedAt,
          expires_at: new Date(Date.now() + cacheTtlSeconds * 1000).toISOString(),
          error: null
        });
      }

      return {
        data: payload as T,
        url,
        retrievedAt,
        status: response.status,
        fromCache: false,
        contentType
      };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt < maxAttempts - 1) await sleep((2 ** attempt) * 750);
    }
  }

  if (supabase) {
    const { data } = await supabase
      .from("raw_payloads")
      .select("*")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (data?.payload) {
      return {
        data: data.payload as T,
        url,
        retrievedAt: data.retrieved_at,
        status: data.status ?? 200,
        fromCache: true,
        stale: true,
        contentType: data.content_type ?? undefined
      };
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

export async function recordSourceHealth(sourceId: string, ok: boolean, startedAt: number, status?: number, error?: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("source_health").upsert({
    source_id: sourceId,
    ok,
    checked_at: new Date().toISOString(),
    latency_ms: Math.round(performance.now() - startedAt),
    status,
    error: error ?? null
  });
}
