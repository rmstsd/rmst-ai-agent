#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "http://localhost:5800";
const DEFAULT_TIMEOUT_MS = 15_000;

// Keep this list in the framework-neutral client so every Agent adapter uses
// the same read boundary. The patterns intentionally cover only documented
// query endpoints; arbitrary POST requests must use m4_write.
export const M4_READ_POST_PATH_PATTERNS = Object.freeze([
  /^\/api\/fleet\/scenes\/[^/]+\/query-all$/,
  /^\/api\/wcs\/plc\/(?:modbus|opcua|mc)\/read$/,
  /^\/api\/entity\/find\/(?:page|count|many|one|batch)$/,
  /^\/api\/stats\/timeline$/
]);

export function assertM4ApiPath(requestPath) {
  if (typeof requestPath !== "string" || requestPath.length === 0) {
    throw new Error("M4 tool path must be a relative /api/ path");
  }
  let decodedPath = requestPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    throw new Error("M4 tool path contains invalid URL encoding");
  }
  if (
    !requestPath.startsWith("/api/") ||
    requestPath.includes("\\") ||
    requestPath.includes("#") ||
    requestPath.includes("?") ||
    decodedPath.includes("\\") ||
    decodedPath.includes("#") ||
    decodedPath.includes("?") ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(decodedPath)
  ) {
    throw new Error("M4 tool path must be a relative /api/ path");
  }
  return requestPath;
}

export function isM4ReadOnlyPostPath(requestPath) {
  return M4_READ_POST_PATH_PATTERNS.some((pattern) => pattern.test(requestPath));
}

function required(value, name) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required option: ${name}`);
  }
  return value;
}

function parseQueryItems(items = []) {
  const query = new URLSearchParams();
  if (!Array.isArray(items)) {
    if (typeof items !== "object" || items === null) {
      throw new Error("Query values must be an array or object");
    }
    for (const [key, value] of Object.entries(items)) {
      if (typeof value !== "string") {
        throw new Error(`Query value for ${key} must be a string`);
      }
      query.append(key, value);
    }
    return query;
  }
  for (const item of items) {
    const separator = item.indexOf("=");
    if (separator <= 0) throw new Error(`Invalid query value: ${item}`);
    query.append(item.slice(0, separator), item.slice(separator + 1));
  }
  return query;
}

export function makeUrl(baseUrl, requestPath, queryItems = []) {
  const normalizedPath = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
  const url = new URL(normalizedPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of parseQueryItems(queryItems)) {
    url.searchParams.append(key, value);
  }
  return url;
}

async function fetchWithTimeout(
  url,
  options,
  timeoutMs,
  fetchImpl = fetch,
  parentSignal
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = parentSignal && typeof AbortSignal.any === "function"
    ? AbortSignal.any([parentSignal, controller.signal])
    : controller.signal;
  try {
    return await fetchImpl(url, { ...options, signal });
  } catch (error) {
    if (error?.name === "AbortError" && !parentSignal?.aborted) {
      throw new Error(`M4 request timed out after ${timeoutMs} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readResponse(response, maxResponseBytes) {
  const text = await response.text();
  const boundedText = maxResponseBytes === undefined
    ? text
    : text.slice(0, maxResponseBytes);
  const truncated = maxResponseBytes !== undefined && boundedText.length < text.length;
  if (!boundedText) return { data: null, truncated };
  try {
    return { data: JSON.parse(boundedText), truncated };
  } catch {
    return { data: boundedText, truncated };
  }
}

export function buildError(status, data) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return {
      code: data.code ?? `HTTP_${status}`,
      message: data.message ?? `M4 request failed with HTTP ${status}`,
      args: data.args ?? [],
      details: data
    };
  }
  return {
    code: `HTTP_${status}`,
    message: typeof data === "string" && data
      ? data
      : `M4 request failed with HTTP ${status}`,
    args: [],
    details: data
  };
}

async function signIn(baseUrl, timeoutMs, fetchImpl, authConfig, signal) {
  const response = await fetchWithTimeout(
    makeUrl(baseUrl, "/api/sign-in"),
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        username: required(authConfig.username, "M4_USERNAME"),
        password: required(authConfig.password, "M4_PASSWORD")
      })
    },
    timeoutMs,
    fetchImpl,
    signal
  );
  const { data } = await readResponse(response);
  if (!response.ok) throw new Error(buildError(response.status, data).message);
  if (!data?.userId || !data?.userToken) {
    throw new Error("M4 sign-in response did not contain userId and userToken");
  }
  const cookieHeaderValues = typeof response.headers?.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : (response.headers?.get("set-cookie") ? [response.headers.get("set-cookie")] : []);
  const setCookies = Array.isArray(cookieHeaderValues) ? cookieHeaderValues : [];
  return {
    ...data,
    cookie: setCookies.map((value) => value.split(";", 1)[0]).filter(Boolean).join("; ")
  };
}

async function resolveAuthHeaders(
  baseUrl,
  timeoutMs,
  noAuth,
  fetchImpl,
  authConfig,
  signal
) {
  if (noAuth) return {};
  const authMode = (authConfig.authMode || "header").toLowerCase();
  if (!['header', 'cookie'].includes(authMode)) {
    throw new Error("M4_AUTH_MODE must be header or cookie");
  }
  if (authConfig.appId && authConfig.appKey) {
    return { "xyy-app-id": authConfig.appId, "xyy-app-key": authConfig.appKey };
  }
  if (authMode === "cookie" && authConfig.cookie) {
    return { cookie: authConfig.cookie };
  }
  if (authConfig.userId && authConfig.userToken) {
    if (authMode === "cookie") throw new Error("M4_COOKIE is required for cookie auth");
    return {
      [authConfig.userIdHeader || "x-xzz-qyq"]: authConfig.userId,
      [authConfig.userTokenHeader || "x-xzz-qyx"]: authConfig.userToken
    };
  }
  const session = await signIn(baseUrl, timeoutMs, fetchImpl, authConfig, signal);
  if (authMode === "cookie") {
    if (!session.cookie) throw new Error("M4 sign-in response did not contain Set-Cookie");
    return { cookie: session.cookie };
  }
  return {
    [authConfig.userIdHeader || "x-xzz-qyq"]: session.userId,
    [authConfig.userTokenHeader || "x-xzz-qyx"]: session.userToken
  };
}

export async function requestM4(options = {}) {
  const config = options.config ?? {};
  const useProcessEnv = options.useProcessEnv ?? options.config === undefined;
  const environment = useProcessEnv ? process.env : {};
  const configValue = (name, envName) => config[name] ?? config[envName];
  const baseUrl = options.baseUrl ?? configValue("baseUrl", "M4_BASE_URL") ?? environment.M4_BASE_URL ?? DEFAULT_BASE_URL;
  const method = options.method ?? "GET";
  const requestPath = options.requestPath;
  const query = options.query ?? [];
  const body = options.body;
  const timeoutMs = options.timeoutMs ?? configValue("timeoutMs", "M4_TIMEOUT_MS") ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytesValue = options.maxResponseBytes
    ?? configValue("maxResponseBytes", "M4_MAX_RESPONSE_BYTES")
    ?? (useProcessEnv ? environment.M4_MAX_RESPONSE_BYTES : undefined);
  const maxResponseBytes = maxResponseBytesValue === undefined
    ? undefined
    : Number(maxResponseBytesValue);
  if (maxResponseBytes !== undefined && (!Number.isInteger(maxResponseBytes) || maxResponseBytes <= 0)) {
    throw new Error("M4_MAX_RESPONSE_BYTES must be a positive integer");
  }
  const noAuth = options.noAuth ?? false;
  const fetchImpl = options.fetchImpl ?? fetch;
  const signal = options.signal;
  const authConfig = {
    authMode: options.authMode ?? configValue("authMode", "M4_AUTH_MODE") ?? environment.M4_AUTH_MODE ?? "header",
    userId: options.userId ?? configValue("userId", "M4_USER_ID") ?? environment.M4_USER_ID,
    userToken: options.userToken ?? configValue("userToken", "M4_USER_TOKEN") ?? environment.M4_USER_TOKEN,
    userIdHeader: options.userIdHeader ?? configValue("userIdHeader", "M4_USER_ID_HEADER") ?? environment.M4_USER_ID_HEADER,
    userTokenHeader: options.userTokenHeader ?? configValue("userTokenHeader", "M4_USER_TOKEN_HEADER") ?? environment.M4_USER_TOKEN_HEADER,
    appId: options.appId ?? configValue("appId", "M4_APP_ID") ?? environment.M4_APP_ID,
    appKey: options.appKey ?? configValue("appKey", "M4_APP_KEY") ?? environment.M4_APP_KEY,
    cookie: options.cookie ?? configValue("cookie", "M4_COOKIE") ?? environment.M4_COOKIE,
    username: options.username ?? configValue("username", "M4_USERNAME") ?? environment.M4_USERNAME,
    password: options.password ?? configValue("password", "M4_PASSWORD") ?? environment.M4_PASSWORD
  };
  const headers = {
    accept: "application/json",
    ...(await resolveAuthHeaders(baseUrl, timeoutMs, noAuth, fetchImpl, authConfig, signal))
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetchWithTimeout(
    makeUrl(baseUrl, required(requestPath, "requestPath"), query),
    {
      method: method.toUpperCase(),
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    },
    timeoutMs,
    fetchImpl,
    signal
  );
  const responseBody = await readResponse(response, maxResponseBytes);
  const result = response.ok
    ? { ok: true, status: response.status, data: responseBody.data }
    : { ok: false, status: response.status, error: buildError(response.status, responseBody.data) };
  return maxResponseBytes === undefined
    ? result
    : { ...result, truncated: responseBody.truncated };
}

function parseArgs(argv) {
  const args = { _: [], query: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") { args.help = true; continue; }
    if (arg === "--no-auth") { args.noAuth = true; continue; }
    if (!arg.startsWith("--")) { args._.push(arg); continue; }
    const name = arg.slice(2).replaceAll("-", "_");
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    index += 1;
    if (name === "query") args.query.push(value); else args[name] = value;
  }
  return args;
}

function printHelp() {
  process.stdout.write(`M4 API CLI\n\nUsage:\n  node shared/m4-api.mjs ping [--no-auth]\n  node shared/m4-api.mjs request --method METHOD --path PATH [options]\n\nOptions:\n  --base-url URL --query key=value --body-json JSON --body-file FILE\n  --timeout-ms NUMBER --no-auth\n`);
}

async function run(argv) {
  const args = parseArgs(argv);
  if (args.help || args._.length === 0) { printHelp(); return 0; }
  const command = args._[0];
  const timeoutMs = Number(args.timeout_ms || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("--timeout-ms must be positive");
  let requestPath = "/api/ping";
  let body;
  if (command === "request") {
    requestPath = required(args.path, "--path");
    if (args.body_json !== undefined && args.body_file !== undefined) throw new Error("Use only one body option");
    if (args.body_json !== undefined) body = JSON.parse(args.body_json);
    if (args.body_file !== undefined) body = JSON.parse(await readFile(args.body_file, "utf8"));
  } else if (command !== "ping") {
    throw new Error(`Unknown command: ${command}`);
  }
  const result = await requestM4({
    baseUrl: args.base_url,
    method: args.method || "GET",
    requestPath,
    query: args.query,
    body,
    timeoutMs,
    noAuth: Boolean(args.noAuth)
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: { code: "M4_CLI_ERROR", message: error.message } })}\n`);
    process.exitCode = 1;
  });
}
