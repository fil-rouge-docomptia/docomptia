import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export class StateStore {
  constructor(directory) {
    this.directory = directory
    this.activeFile = resolve(directory, 'active.json')
  }

  async load() {
    try {
      return JSON.parse(await readFile(this.activeFile, 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  async save(state) {
    await mkdir(this.directory, { recursive: true })
    const nextState = {
      ...state,
      updatedAt: new Date().toISOString(),
    }
    const temporaryFile = `${this.activeFile}.tmp`
    await writeFile(temporaryFile, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8')
    await rename(temporaryFile, this.activeFile)
    return nextState
  }

  async archive(state) {
    await mkdir(resolve(this.directory, 'history'), { recursive: true })
    const timestamp = new Date().toISOString().replaceAll(':', '-')
    const destination = resolve(
      this.directory,
      'history',
      `${state.issue.key}-${timestamp}.json`,
    )
    await writeFile(destination, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  }
}
