#!/usr/bin/env node

const { spawn } = require("node:child_process")
const path = require("node:path")

const args = parseArgs(process.argv.slice(2))
const action = args.action || "Fleet::Scene"
const content = buildContent(args)
const baseUrl = (process.env.M4_BASE_URL || "http://127.0.0.1:5800/api").replace(/\/$/, "")
const bundle = path.join(__dirname, "query-ws.bundle.cjs")

resolveScene(content).then(payload => {
  const child = spawn(process.execPath, [bundle, "--action", action, "--content", JSON.stringify(payload)], {
    stdio: "inherit",
    env: { ...process.env }
  })
  child.on("close", code => process.exitCode = code || 0)
}).catch(error => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})

async function resolveScene(payload) {
  if (!payload.sceneName || payload.sceneId) return payload
  const response = await fetch(`${baseUrl}/fleet/scenes/list`, {
    headers: {
      "xyy-app-id": process.env.M4_APP_ID || "zq-ai-test",
      "xyy-app-key": process.env.M4_APP_KEY || "zq-ai-test"
    }
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.message || `场景列表请求失败：HTTP ${response.status}`)
  const matches = (Array.isArray(data) ? data : data?.data || []).filter(scene =>
    !scene.disabled && scene.name === payload.sceneName
  )
  if (matches.length !== 1) {
    throw new Error(`场景名称“${payload.sceneName}”匹配到 ${matches.length} 个启用场景，无法唯一解析`)
  }
  const { sceneName, ...rest } = payload
  return { ...rest, sceneId: matches[0].id }
}

function parseArgs(values) {
  const result = {}
  for (let i = 0; i < values.length; i += 1) {
    const key = values[i].replace(/^--/, "")
    result[key] = values[++i]
  }
  return result
}

function parseJson(value) {
  try { return JSON.parse(value) } catch { throw new Error("--content 必须是合法 JSON") }
}

function buildContent(args) {
  if (args.content) return parseJson(args.content)
  const content = {}
  if (args["scene-name"]) content.sceneName = args["scene-name"]
  if (args["scene-id"]) content.sceneId = args["scene-id"]
  if (args["order-id"]) content.orderId = args["order-id"]
  if (args.excluded) content.excluded = String(args.excluded).split(",").filter(Boolean)
  if (args["order-query-type"]) content.orderQueryType = args["order-query-type"]
  return content
}
