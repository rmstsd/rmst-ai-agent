import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'

const skillFileName = 'SKILL.md'
const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface SkillDefinition {
  name: string
  description: string
  location: string
  baseDirectory: string
  content: string
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

export async function loadSkills() {
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

export async function executeSkillTool(name: string) {
  const skills = await loadSkills()
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

export function createSkillsSystemPrompt(skills: SkillDefinition[]) {
  if (skills.length === 0) {
    return '当前没有可用的 Skills。'
  }

  return [
    '可用 Skills：',
    ...skills.map(skill => `- ${skill.name}: ${skill.description}`),
    '',
    '当用户任务与某个 Skill 的描述匹配时，先调用 load-skill 工具加载完整内容，再遵循其中的指令完成任务。',
    '不要根据上面的简短描述猜测 Skill 的具体步骤。Skill 中的相对路径以工具返回的 Base directory 为基准。'
  ].join('\n')
}
