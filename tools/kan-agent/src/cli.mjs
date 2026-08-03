#!/usr/bin/env node

import {
  abortTask,
  approveTask,
  doctorAgent,
  initAgent,
  pushTask,
  reviewTask,
  reviseTask,
  showStatus,
  startTask,
} from './workflow-service.mjs'

const help = `kan-agent - Jira, Git and Codex workflow

Usage:
  kan-agent init
  kan-agent doctor
  kan-agent start
  kan-agent status
  kan-agent review
  kan-agent revise "requested change"
  kan-agent approve
  kan-agent push
  kan-agent abort
`

const commands = {
  init: () => initAgent(),
  doctor: () => doctorAgent(),
  start: () => startTask(),
  status: () => showStatus(),
  review: () => reviewTask(),
  revise: (args) => reviseTask(args.join(' ')),
  approve: () => approveTask(),
  push: () => pushTask(),
  abort: () => abortTask(),
  help: () => console.log(help),
  '--help': () => console.log(help),
  '-h': () => console.log(help),
}

const [command = 'help', ...args] = process.argv.slice(2)
const action = commands[command]

if (!action) {
  console.error(`Unknown command: ${command}\n`)
  console.error(help)
  process.exitCode = 1
} else {
  try {
    await action(args)
  } catch (error) {
    console.error(`\nError: ${error.message}`)
    process.exitCode = 1
  }
}
