/**
 * Secure env secret helpers: never ship real credentials as code defaults.
 * Missing secrets fail closed in production; local/dev may use an ephemeral secret.
 */

type SecretEnv = {
  NODE_ENV?: string;
  [key: string]: string | undefined;
};

function envBag(): SecretEnv {
  return process.env as SecretEnv;
}

/** Trimmed env value, or empty string when unset. */
export function readEnvSecret(name: string): string {
  return envBag()[name]?.trim() || "";
}

/**
 * First non-empty env value from the given keys.
 * No hardcoded credential fallbacks.
 */
export function requireEnvSecret(...names: string[]): string {
  for (const name of names) {
    const value = readEnvSecret(name);
    if (value) return value;
  }
  return "";
}

function createEphemeralLocalSecret(): string {
  // Web Crypto works in Node and Edge (middleware) — avoid node:crypto imports.
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const ephemeralLocalSecrets = new Map<string, string>();

/**
 * Resolve a signing/encryption secret from env.
 * Production: throws if none of the keys are set.
 * Local/test: returns a process-local ephemeral secret (not a shared default password).
 */
export function resolveSigningSecret(
  cacheKey: string,
  ...envNames: string[]
): string {
  const fromEnv = requireEnvSecret(...envNames);
  if (fromEnv) return fromEnv;

  const nodeEnv = envBag().NODE_ENV || "development";
  if (nodeEnv === "production") {
    throw new Error(
      `Missing required secret. Set one of: ${envNames.join(", ")}`
    );
  }

  const cached = ephemeralLocalSecrets.get(cacheKey);
  if (cached) return cached;
  const generated = createEphemeralLocalSecret();
  ephemeralLocalSecrets.set(cacheKey, generated);
  return generated;
}

/**
 * Signing secret that must match across Edge middleware and Node runtimes
 * (e.g. customer session cookies). Ephemeral secrets cannot be shared across
 * isolates, so local/dev uses a fixed non-credential placeholder instead.
 * Production still requires a real env value.
 */
export function resolveCrossRuntimeSigningSecret(...envNames: string[]): string {
  const fromEnv = requireEnvSecret(...envNames);
  if (fromEnv) return fromEnv;

  const nodeEnv = envBag().NODE_ENV || "development";
  if (nodeEnv === "production") {
    throw new Error(
      `Missing required secret. Set one of: ${envNames.join(", ")}`
    );
  }

  return "local-dev-only-signing-secret-not-for-production";
}
