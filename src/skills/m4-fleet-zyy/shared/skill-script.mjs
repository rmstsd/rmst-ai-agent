import { readFile } from "node:fs/promises";
import { requestM4 } from "./m4-api.mjs";

export function parseSkillArgs(argv) {
  const args = { _: [], query: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      args._.push(value);
      continue;
    }
    const name = value.slice(2).replaceAll("-", "_");
    if (name === "help") {
      args.help = true;
      continue;
    }
    if (name === "no_auth") {
      args.no_auth = true;
      continue;
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    index += 1;
    if (name === "query") args.query.push(next);
    else args[name] = next;
  }
  return args;
}

async function parseBody(args) {
  if (args.body_json !== undefined && args.body_file !== undefined) {
    throw new Error("Use only one of --body-json and --body-file");
  }
  if (args.body_json !== undefined) return JSON.parse(args.body_json);
  if (args.body_file !== undefined) return JSON.parse(await readFile(args.body_file, "utf8"));
  return undefined;
}

export function resolvePath(template, args) {
  return template.replace(/\{([^}]+)\}/g, (_match, key) => {
    const option = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const value = args[option] ?? args[key];
    if (value === undefined || value === "") {
      throw new Error(`Missing --${option} for path ${template}`);
    }
    return encodeURIComponent(String(value));
  });
}

/** Runs a small domain command table while keeping auth and error handling shared. */
export async function runSkillScript({ name, commands, argv = process.argv.slice(2) }) {
  const args = parseSkillArgs(argv);
  const command = args._[0];
  if (!command || command === "help" || args.help) {
    process.stdout.write(`${name} commands: ${Object.keys(commands).join(", ")}, request\n`);
    process.stdout.write("request options: --method METHOD --path PATH --query key=value --body-json JSON --body-file FILE\n");
    return 0;
  }

  const request = command === "request"
    ? {
        method: args.method || "GET",
        requestPath: args.path,
        query: args.query,
        body: await parseBody(args)
      }
    : commands[command];
  if (!request) throw new Error(`Unknown ${name} command: ${command}`);
  const body = request.body ?? await parseBody(args);

  const result = await requestM4({
    baseUrl: args.base_url,
    method: request.method,
    requestPath: request.requestPath ? resolvePath(request.requestPath, args) : args.path,
    query: args.query,
    body,
    timeoutMs: Number(args.timeout_ms || 15_000),
    noAuth: Boolean(args.no_auth)
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.ok ? 0 : 1;
}
