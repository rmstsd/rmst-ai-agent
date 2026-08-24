import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'

const skillFileName = 'SKILL.md'
const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const baseSystemPrompt = [
  '你是 M4 AI 助手。',
  '只能调用系统提供的工具，不要调用未注册或不存在的工具。',
  '如果工具调用所需的参数不完整，先向用户询问缺失参数。',
  '执行工具前遵循工具和已加载 Skill 中的全部约束；不要猜测工具结果或 Skill 中未提供的信息。',
  '如果已经加载过了某个 Skill，不要重复加载。'
].join('\n')

export interface SkillDefinition {
  name: string
  description: string
  location: string
  baseDirectory: string
  content: string
}

export type SkillCapabilities = {
  skills: SkillDefinition[]
  systemPrompt: string
}

function getSkillsDirectory() {
  return resolve(process.cwd(), 'src', 'skills')
}

function parseSkillFrontmatter(content: string, location: string) {
  const lines = content.replaceAll('\r\n', '\n').split('\n')
  if (lines[0]?.trim() !== '---') {
    throw new Error(`${location} 缺少 YAML frontmatter`)
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (endIndex < 0) {
    throw new Error(`${location} 的 YAML frontmatter 没有结束标记`)
  }

  let frontmatter: unknown
  try {
    frontmatter = parse(lines.slice(1, endIndex).join('\n'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${location} 的 YAML frontmatter 无法解析：${message}`)
  }

  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error(`${location} 的 YAML frontmatter 必须是对象`)
  }

  const { name, description } = frontmatter as Record<string, unknown>
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error(`${location} 的 name 必须是非空字符串`)
  }
  if (typeof description !== 'string' || !description.trim()) {
    throw new Error(`${location} 的 description 必须是非空字符串`)
  }

  if (!skillNamePattern.test(name)) {
    throw new Error(`${location} 的 name 只能包含小写字母、数字和连字符`)
  }

  return { name, description: description.trim() }
}

async function loadSkillDirectory(skillsDirectory: string, directoryName: string) {
  const baseDirectory = join(skillsDirectory, directoryName)
  const location = join(baseDirectory, skillFileName)
  let content: string

  try {
    content = await readFile(location, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return
    throw error
  }

  const metadata = parseSkillFrontmatter(content, location)
  if (metadata.name !== directoryName) {
    throw new Error(`${location} 的 name 必须与目录名 ${directoryName} 一致`)
  }

  return {
    ...metadata,
    location,
    baseDirectory,
    content
  }
}

async function loadSkills() {
  const skillsDirectory = getSkillsDirectory()
  const entries = await readdir(skillsDirectory, { withFileTypes: true })
  const skills = (
    await Promise.all(entries.filter(entry => entry.isDirectory()).map(entry => loadSkillDirectory(skillsDirectory, entry.name)))
  )
    .filter((skill): skill is SkillDefinition => Boolean(skill))
    .sort((left, right) => left.name.localeCompare(right.name))

  const names = new Set<string>()
  for (const skill of skills) {
    if (names.has(skill.name)) {
      throw new Error(`Skill 名称重复：${skill.name}`)
    }
    names.add(skill.name)
  }

  return skills
}

const skills = await loadSkills()

export async function loadSkillContent(name: string) {
  const skill = skills.find(item => item.name === name)
  if (!skill) {
    throw new Error(`Skill 不存在：${name}`)
  }

  return [
    `<skill_content name="${skill.name}">`,
    skill.content,
    '',
    `此 skill 的基本目录: ${skill.baseDirectory}`,
    '从上面的基本目录中解析此 skill 中的相对路径。',
    '</skill_content>'
  ].join('\n')
}

function escapeXml(value: string) {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  }

  return value.replace(/[<&>"']/g, character => entities[character])
}

export function createSkillsSystemPrompt(skills: SkillDefinition[]) {
  if (skills.length === 0) {
    return '<available_skills>当前没有可用的 Skills。</available_skills>'
  }

  return [
    '<available_skills>',
    ...skills.map(skill => [
      '  <skill>',
      `    <name>${escapeXml(skill.name)}</name>`,
      `    <description>${escapeXml(skill.description)}</description>`,
      '  </skill>'
    ].join('\n')),
    '</available_skills>',
    '',
    '<skill_usage_rules>',
    '  <rule>当用户任务与某个 Skill 的描述匹配时，先调用 load-skill 工具加载完整内容，再遵循其中的指令完成任务。</rule>',
    '  <rule>不要根据上面的简短描述猜测 Skill 的具体步骤。</rule>',
    '  <rule>Skill 中的相对路径以工具返回的 Base directory 为基准。</rule>',
    '</skill_usage_rules>'
  ].join('\n')
}

/** 根据已读取的技能创建 Agent 使用的完整系统提示词。 */
export function createSystemPrompt() {
  return [baseSystemPrompt, createSkillsSystemPrompt(skills)].join('\n\n')
}

/** 一次性读取 Agent 初始化所需的技能列表和系统提示词。 */
export async function loadSkillCapabilities(): Promise<SkillCapabilities> {
  return {
    skills,
    systemPrompt: createSystemPrompt()
  }
}
