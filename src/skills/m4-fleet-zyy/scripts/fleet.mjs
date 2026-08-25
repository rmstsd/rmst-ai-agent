#!/usr/bin/env node
import { runSkillScript } from "../../../shared/skill-script.mjs";

runSkillScript({
  name: "m4-fleet",
  commands: {
    ping: { method: "GET", requestPath: "/api/ping" },
    scenes: { method: "GET", requestPath: "/api/fleet/scenes/list" },
    robots: { method: "GET", requestPath: "/api/fleet/robots/all-all" },
    traffic: { method: "GET", requestPath: "/api/fleet/robots/{sceneId}/traffic-resource" },
    points: { method: "GET", requestPath: "/api/fleet/scenes/{sceneId}/list-points-bins" },
    diagnosis: { method: "GET", requestPath: "/api/fleet/diagnosis/{sceneId}/diagnosis-list" }
  }
}).then((code) => { process.exitCode = code; }).catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: { code: "M4_FLEET_SCRIPT_ERROR", message: error.message } })}\n`);
  process.exitCode = 1;
});
