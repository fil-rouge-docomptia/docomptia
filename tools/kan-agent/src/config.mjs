import { access, chmod, copyFile, mkdir, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDirectory = dirname(fileURLToPath(import.meta.url))
export const toolDirectory = resolve(srcDirectory, '..')

function expandPath(path, baseDirectory = process.cwd()) {
  if (path === '~') {
    return homedir()
  }
  if (path?.startsWith('~/')) {
    return resolve(homedir(), path.slice(2))
  }
  if (!path) return path
  return isAbsolute(path) ? resolve(path) : resolve(baseDirectory, path)
}

export function getConfigPath() {
  return process.env.KAN_AGENT_CONFIG
    ? resolve(process.env.KAN_AGENT_CONFIG)
    : resolve(toolDirectory, 'config.local.json')
}

export function getEnvironmentPath() {
  return process.env.KAN_AGENT_ENV_FILE
    ? resolve(process.env.KAN_AGENT_ENV_FILE)
    : resolve(toolDirectory, '.env.local')
}

async function createFileFromExample(target, example, mode) {
  try {
    await access(target, constants.F_OK)
    return false
  } catch {
    await mkdir(dirname(target), { recursive: true })
    await copyFile(example, target)
    if (mode) await chmod(target, mode)
    return true
  }
}

export async function initializeConfig() {
  const target = getConfigPath()
  const environmentPath = getEnvironmentPath()
  const created = await createFileFromExample(
    target,
    resolve(toolDirectory, 'config.example.json'),
  )
  const environmentCreated = await createFileFromExample(
    environmentPath,
    resolve(toolDirectory, '.env.example'),
    0o600,
  )
  return { created, path: target, environmentCreated, environmentPath }
}

async function loadLocalEnvironment() {
  const environmentPath = getEnvironmentPath()
  let content
  try {
    content = await readFile(environmentPath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw new Error(`Unable to read ${environmentPath}: ${error.message}`)
  }

  content.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) return

    const separator = line.indexOf('=')
    const key = line.slice(0, separator).trim()
    if (separator <= 0 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid environment variable at ${environmentPath}:${index + 1}`)
    }

    let value = line.slice(separator + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  })
}

export async function loadConfig() {
  await loadLocalEnvironment()
  const configPath = getConfigPath()
  let raw
  try {
    raw = JSON.parse(await readFile(configPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration not found. Run: kan-agent init\nExpected: ${configPath}`)
    }
    throw new Error(`Unable to read ${configPath}: ${error.message}`)
  }

  raw.jira.baseUrl = process.env.JIRA_BASE_URL || raw.jira.baseUrl
  raw.jira.email = process.env.JIRA_EMAIL
  raw.jira.apiToken = process.env.JIRA_API_TOKEN
  raw.git.baseRepositoryPath = expandPath(raw.git.baseRepositoryPath, toolDirectory)
  raw.git.worktreesDirectory = expandPath(raw.git.worktreesDirectory, toolDirectory)
  raw.state.directory = expandPath(raw.state.directory, toolDirectory)
  raw.configPath = configPath
  raw.toolDirectory = toolDirectory

  validateConfig(raw)
  return raw
}

function validateConfig(config) {
  const missing = []
  if (!config.jira.baseUrl) missing.push('JIRA_BASE_URL or jira.baseUrl')
  if (!config.jira.email) missing.push('JIRA_EMAIL')
  if (!config.jira.apiToken) missing.push('JIRA_API_TOKEN')
  if (!config.jira.projectKey) missing.push('jira.projectKey')
  if (!config.git.repositoryUrl) missing.push('git.repositoryUrl')
  if (!config.git.baseRepositoryPath) missing.push('git.baseRepositoryPath')
  if (!config.git.worktreesDirectory) missing.push('git.worktreesDirectory')

  if (missing.length > 0) {
    throw new Error(`Missing configuration: ${missing.join(', ')}`)
  }
}
