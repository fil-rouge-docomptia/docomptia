import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function replace(template, name, value) {
  return template.replaceAll(`{{${name}}}`, value || 'Not provided')
}

export async function buildPrompt(config, state, revisionInstruction = '') {
  const template = await readFile(
    resolve(config.toolDirectory, 'prompts', 'implement-ticket.md'),
    'utf8',
  )
  const contextFiles = config.codex.contextFiles
    .map((path, index) => `${index + 1}. ${path}`)
    .join('\n')

  const values = {
    ISSUE_KEY: state.issue.key,
    ISSUE_SUMMARY: state.issue.summary,
    ISSUE_STATUS: state.issue.status,
    ISSUE_DESCRIPTION: state.issue.description,
    ACCEPTANCE_CRITERIA: state.issue.acceptanceCriteria,
    EPIC_KEY: state.epic.key,
    EPIC_SUMMARY: state.epic.summary,
    CONTEXT_FILES: contextFiles,
    REVISION_INSTRUCTION: revisionInstruction
      ? `The user reviewed the previous implementation and requested this revision:\n<user-feedback>\n${revisionInstruction}\n</user-feedback>\nInspect the current branch and commits, apply the revision, rerun relevant tests, and create any necessary atomic commit.`
      : '',
  }

  return Object.entries(values).reduce(
    (result, [name, value]) => replace(result, name, value),
    template,
  )
}
