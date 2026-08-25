const fs = require("fs");

const entityName = "ContainerTransportOrder";
const baseUrl = (process.env.M4_BASE_URL || "http://127.0.0.1:5800").replace(/\/+$/, "");
const appId = process.env.M4_APP_ID || "test";
const appKey = process.env.M4_APP_KEY || "test";

function usage() {
  console.log(`Usage:
  skill\\container-skill\\scripts\\container-skill.bat view <task-id>
  skill\\container-skill\\scripts\\container-skill.bat create <request-json-file>
  skill\\container-skill\\scripts\\container-skill.bat update <request-json-file>
  skill\\container-skill\\scripts\\container-skill.bat batch-update <request-json-file>

Commands:
  view          Query one ContainerTransportOrder.
  create        Create one ContainerTransportOrder.
  update        Update one ContainerTransportOrder.
  batch-update  Update multiple ContainerTransportOrder records.

Environment:
  M4_BASE_URL       M4 service base URL, default: http://127.0.0.1:5800
  M4_APP_ID         xyy-app-id header, default: test
  M4_APP_KEY        xyy-app-key header, default: test
  M4_AUTHORIZATION  Optional Authorization value
  M4_COOKIE         Optional browser session cookie`);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`request JSON file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid request JSON: ${error.message}`);
  }
}

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function preparePayload(command, argument) {
  if (command === "view") {
    if (!argument || !argument.trim()) {
      throw new Error("view requires a task id");
    }
    return {
      url: `${baseUrl}/api/entity/find/one`,
      body: { entityName, id: argument.trim() },
    };
  }

  if (!argument) {
    throw new Error(`${command} requires a request JSON file`);
  }

  const value = readJson(argument);
  requireObject(value, "request JSON");
  if (value.entityName !== entityName) {
    throw new Error(`entityName must be ${entityName}`);
  }

  if (command === "create") {
    requireObject(value.entityValue, "entityValue");
    if (!value.entityValue.kind) {
      throw new Error("create requires entityValue.kind");
    }
    if (!value.entityValue.status) {
      throw new Error("create requires entityValue.status");
    }
    delete value.entityValue.id;
    return { url: `${baseUrl}/api/entity/create/one`, body: value };
  }

  if (command === "update") {
    if (typeof value.id !== "string" || !value.id.trim()) {
      throw new Error("update requires a non-empty id");
    }
    requireObject(value.update, "update");
    if (Object.keys(value.update).length === 0) {
      throw new Error("update requires a non-empty update object");
    }
    return { url: `${baseUrl}/api/entity/update/one`, body: value };
  }

  if (command === "batch-update") {
    requireObject(value.query, "query");
    requireObject(value.update, "update");
    if (Object.keys(value.update).length === 0) {
      throw new Error("batch-update requires a non-empty update object");
    }
    return { url: `${baseUrl}/api/entity/update/many`, body: value };
  }

  throw new Error(`unknown command: ${command}`);
}

async function sendRequest(url, body) {
  const headers = {
    "xyy-app-id": appId,
    "xyy-app-key": appKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (process.env.M4_AUTHORIZATION) {
    headers.Authorization = process.env.M4_AUTHORIZATION;
  }
  if (process.env.M4_COOKIE) {
    headers.Cookie = process.env.M4_COOKIE;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`POST ${url} returned HTTP ${response.status}.\n${text}`);
    }
    if (!text.trim()) {
      return;
    }
    try {
      console.log(JSON.stringify(JSON.parse(text.replace(/^\uFEFF/, "")), null, 2));
    } catch {
      console.log(text);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  if (!command || command === "-h" || command === "--help") {
    usage();
    return;
  }
  const { url, body } = preparePayload(command, argument);
  await sendRequest(url, body);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
