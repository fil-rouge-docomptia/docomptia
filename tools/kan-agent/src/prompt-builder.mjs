import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'

function replace(template, name, value) {
  return template.replaceAll(`{{${name}}}`, value || 'Not provided')
}

async function exists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function resolveContextFile(config, state, path) {
  if (await exists(resolve(state.worktree, path))) return path

  const repositoryPath = resolve(config.git.baseRepositoryPath, path)
  return await exists(repositoryPath) ? repositoryPath : `${path} (missing)`
}

function buildRevisionInstruction(revisionRequest = '') {
  if (!revisionRequest) return ''

  const revision = typeof revisionRequest === 'string'
    ? { source: 'user', message: revisionRequest }
    : {
      source: revisionRequest.source || 'user',
      message: revisionRequest.message || '',
    }
  if (!revision.message.trim()) return ''

  if (revision.source === 'agent') {
    return [
      'The previous execution still has failing test results and needs another implementation pass:',
      '<agent-feedback>',
      revision.message.trim(),
      '</agent-feedback>',
      'Inspect the current branch and commits, fix the reported failures, and rerun the relevant tests.',
      'Finish only when the latest reported test results pass or you reach a real blocker.',
      'The orchestrator creates commits after your successful result.',
    ].join('\n')
  }

  return [
    'The user reviewed the previous implementation and requested this revision:',
    '<user-feedback>',
    revision.message.trim(),
    '</user-feedback>',
    'Inspect the current branch and commits, apply the revision, and rerun relevant tests.',
    'The orchestrator creates commits after your successful result.',
  ].join('\n')
}

export async function buildPrompt(config, state, revisionRequest = '') {
  const template = await readFile(
    resolve(config.toolDirectory, 'prompts', 'implement-ticket.md'),
    'utf8',
  )
  const resolvedContextFiles = await Promise.all(
    config.codex.contextFiles.map((path) => resolveContextFile(config, state, path)),
  )
  const contextFiles = resolvedContextFiles
    .map((path, index) => `${index + 1}. ${path}`)
    .join('\n')

  const values = {
    ISSUE_KEY: state.issue.key,
    ISSUE_SUMMARY: state.issue.summary,
    ISSUE_STATUS: state.issue.status,
    ISSUE_DESCRIPTION: state.issue.description,
    ACCEPTANCE_CRITERIA: state.issue.acceptanceCriteria,
    EPIC_KEY: state.epic?.key || state.issue.parentKey,
    EPIC_SUMMARY: state.epic?.summary,
    CONTEXT_FILES: contextFiles,
    REVISION_INSTRUCTION: buildRevisionInstruction(revisionRequest),
  }

  return Object.entries(values).reduce(
    (result, [name, value]) => replace(result, name, value),
    template,
  )
}
