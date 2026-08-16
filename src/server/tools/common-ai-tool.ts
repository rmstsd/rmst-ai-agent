import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { AiToolDefinition } from '@/server/tools/tool-types'
import { objectParameters, stringProperty } from '@/server/tools/tool-types'

const commandTimeout = 5 * 60 * 1000
const commandMaxBuffer = 10 * 1024 * 1024

function runScript(scriptPath: string, isWindows: boolean) {
  return new Promise<string>((resolve, reject) => {
    const shell = isWindows ? 'powershell.exe' : '/bin/sh'
    const shellArgs = isWindows
      ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]
      : [scriptPath]
    const child = spawn(shell, shellArgs, {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let outputSize = 0
    let timedOut = false
    let outputExceeded = false

    const timeout = setTimeout(() => {
      timedOut = true
      child.kill()
    }, commandTimeout)

    const collectOutput = (chunks: Buffer[], chunk: Buffer) => {
      outputSize += chunk.length
      if (outputSize > commandMaxBuffer) {
        outputExceeded = true
        child.kill()
        return
      }

      chunks.push(chunk)
    }

    child.stdout.on('data', chunk => collectOutput(stdoutChunks, chunk))
    child.stderr.on('data', chunk => collectOutput(stderrChunks, chunk))
    child.on('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (exitCode, signal) => {
      clearTimeout(timeout)

      if (timedOut) {
        reject(new Error(`命令执行超过 ${commandTimeout / 1000} 秒，已终止`))
        return
      }
      if (outputExceeded) {
        reject(new Error(`命令输出超过 ${commandMaxBuffer / 1024 / 1024} MB，已终止`))
        return
      }

      resolve(
        JSON.stringify({
          exitCode,
          signal,
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8')
        })
      )
    })
  })
}

async function executeCommand(command: string) {
  const isWindows = process.platform === 'win32'
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'rmst-ai-command-'))
  const scriptPath = join(temporaryDirectory, isWindows ? 'command.ps1' : 'command.sh')
  const script = isWindows
    ? `\uFEFF$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)\r\n${command}`
    : command

  try {
    await writeFile(scriptPath, script, 'utf8')
    return await runScript(scriptPath, isWindows)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

export const commonAiTools: AiToolDefinition[] = [
  {
    name: 'fetch-url-text',
    description: '从指定 URL 获取 html 内容',
    parameters: objectParameters(
      {
        url: stringProperty('网页 URL 地址')
      },
      ['url']
    ),
    executor: ({ url }) => {
      const targetUrl = new URL(url as string)
      targetUrl.username = ''
      targetUrl.password = ''

      return fetch(targetUrl).then(res => res.text())
    }
  },
  {
    name: 'command-exec',
    description: '在服务端 shell 中执行指定脚本，并返回退出码、标准输出和错误输出',
    parameters: objectParameters(
      {
        command: stringProperty('要执行的 shell 脚本，支持多行')
      },
      ['command']
    ),
    executor: ({ command }) => executeCommand(command as string)
  }
]
// const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses', {
//   method: 'POST',
//   headers: {
//     Authorization: `Bearer ${process.env.ARK_API_KEY}`,
//     'Content-Type': 'application/json'
//   },
//   body: JSON.stringify({
//     model: 'doubao-seed-2-1-pro-260628',
//     input: '查询北京今天的天气',
//     tools: [
//       {
//         type: 'fetch-request',
//         name: '通用的网络请求',
//         description: '用于发送 HTTP 请求; 调用服务端接口',
//         parameters: {
//           type: 'object',
//           properties: {
//             url: {
//               type: 'string',
//               description: '要请求的 URL 地址'
//             }
//           },
//           required: ['url']
//         }
//       },
//       {
//         type: 'load-skill',
//         name: '加载 skill',
//         description: '根据名字加载 skill 详情',
//         parameters: {
//           type: 'object',
//           properties: {
//             skillName: {
//               type: 'string',
//               description: '要加载的 skill 名称'
//             }
//           },
//           required: ['skillName']
//         }
//       }
//     ]
//   })
// })
