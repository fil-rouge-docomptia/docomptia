import { access, copyFile, mkdir, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDirectory = dirname(fileURLToPath(import.meta.url))
export const toolDirectory = resolve(srcDirectory, '..')

function expandHome(path) {
  if (path === '~') {
    return homedir()
  }
  if (path?.startsWith('~/')) {
    return resolve(homedir(), path.slice(2))
  }
  return path ? resolve(path) : path
}

export function getConfigPath() {
  return process.env.KAN_AGENT_CONFIG
    ? resolve(process.env.KAN_AGENT_CONFIG)
    : resolve(toolDirectory, 'config.local.json')
}

export async function initializeConfig() {
  const target = getConfigPath()
  try {
    await access(target, constants.F_OK)
    return { created: false, path: target }
  } catch {
    await mkdir(dirname(target), { recursive: true })
    await copyFile(resolve(toolDirectory, 'config.example.json'), target)
    return { created: true, path: target }
  }
}

export async function loadConfig() {
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
  raw.git.baseRepositoryPath = expandHome(raw.git.baseRepositoryPath)
  raw.git.worktreesDirectory = expandHome(raw.git.worktreesDirectory)
  raw.state.directory = expandHome(raw.state.directory)
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
