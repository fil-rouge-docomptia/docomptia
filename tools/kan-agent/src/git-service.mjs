import { access, mkdir, readdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { runCommand } from './process.mjs'

export function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 70)
    .replace(/_+$/g, '')
}

function globToRegExp(pattern) {
  let expression = '^'
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    const next = pattern[index + 1]
    if (character === '*' && next === '*') {
      expression += '.*'
      index += 1
    } else if (character === '*') {
      expression += '[^/]*'
    } else if ('\\.^$+?()[]{}|'.includes(character)) {
      expression += `\\${character}`
    } else {
      expression += character
    }
  }
  return new RegExp(`${expression}$`, 'i')
}

export function matchesForbiddenPath(path, patterns) {
  return (patterns || []).some((pattern) => globToRegExp(pattern).test(path))
}

function statusLinePath(line) {
  const pathStart = line[2] === ' ' ? 3 : 2
  const path = line.slice(pathStart).trim()
  const renameSeparator = path.lastIndexOf(' -> ')
  return renameSeparator === -1 ? path : path.slice(renameSeparator + 4)
}

export function splitWorkingTreeStatus(status, ignoredPatterns = []) {
  const lines = status ? status.split('\n').filter(Boolean) : []
  const ignored = []
  const blocking = []

  for (const line of lines) {
    const target = matchesForbiddenPath(statusLinePath(line), ignoredPatterns)
      ? ignored
      : blocking
    target.push(line)
  }

  return {
    blockingStatus: blocking.join('\n'),
    ignoredStatus: ignored.join('\n'),
  }
}

async function exists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export class GitService {
  constructor(config) {
    this.config = config.git
  }

  git(args, options = {}) {
    return runCommand('git', args, options)
  }

  async ensureBaseRepository() {
    const repository = this.config.baseRepositoryPath
    if (await exists(resolve(repository, '.git'))) {
      return
    }

    if (this.config.sharedRepository) {
      throw new Error(`Shared Git repository not found: ${repository}`)
    }

    await mkdir(dirname(repository), { recursive: true })
    if (await exists(repository)) {
      const entries = await readdir(repository)
      if (entries.length > 0) {
        throw new Error(`${repository} exists but is not an empty Git repository`)
      }
    }

    console.log(`Cloning ${this.config.repositoryUrl} into ${repository}...`)
    await this.git(['clone', this.config.repositoryUrl, repository], { inherit: true })
  }

  async syncMain() {
    await this.ensureBaseRepository()
    const repository = this.config.baseRepositoryPath
    await this.git(['fetch', this.config.remote], { cwd: repository, inherit: true })

    if (this.config.sharedRepository) {
      return `${this.config.remote}/${this.config.mainBranch}`
    }

    const status = await this.git(['status', '--porcelain'], { cwd: repository })
    if (status.stdout) {
      throw new Error(`The agent base repository is not clean:\n${status.stdout}`)
    }

    await this.git(['switch', this.config.mainBranch], { cwd: repository, inherit: true })
    await this.git(
      ['pull', '--ff-only', this.config.remote, this.config.mainBranch],
      { cwd: repository, inherit: true },
    )
    return this.config.mainBranch
  }

  async prepareWorktree(issue) {
    const baseRevision = await this.syncMain()

    const branch = `${issue.key}_${slugify(issue.summary)}`
    const worktree = resolve(this.config.worktreesDirectory, branch)
    await mkdir(this.config.worktreesDirectory, { recursive: true })
    await this.git(['worktree', 'prune'], { cwd: this.config.baseRepositoryPath })

    if (await exists(worktree)) {
      await this.git(['rev-parse', '--is-inside-work-tree'], { cwd: worktree })
      const currentBranch = await this.git(['branch', '--show-current'], { cwd: worktree })
      if (currentBranch.stdout !== branch) {
        throw new Error(
          `${worktree} is checked out on ${currentBranch.stdout}, expected ${branch}`,
        )
      }
      return { branch, worktree, resumed: true }
    }

    const localBranch = await this.git(
      ['branch', '--list', branch],
      { cwd: this.config.baseRepositoryPath },
    )
    const remoteBranch = await this.git(
      ['show-ref', '--verify', `refs/remotes/${this.config.remote}/${branch}`],
      { cwd: this.config.baseRepositoryPath, allowFailure: true },
    )

    if (localBranch.stdout) {
      await this.git(['worktree', 'add', worktree, branch], {
        cwd: this.config.baseRepositoryPath,
        inherit: true,
      })
    } else if (remoteBranch.code === 0) {
      await this.git(
        [
          'worktree',
          'add',
          '-b',
          branch,
          worktree,
          `${this.config.remote}/${branch}`,
        ],
        { cwd: this.config.baseRepositoryPath, inherit: true },
      )
    } else {
      await this.git(
        ['worktree', 'add', '-b', branch, worktree, baseRevision],
        { cwd: this.config.baseRepositoryPath, inherit: true },
      )
    }

    return { branch, worktree, resumed: false }
  }

  async isWorktreeAvailable(worktree) {
    return Boolean(worktree) && await exists(resolve(worktree, '.git'))
  }

  async releaseWorktree(worktree) {
    if (!worktree) {
      return { released: true, alreadyReleased: true }
    }
    if (resolve(worktree) === resolve(this.config.baseRepositoryPath)) {
      throw new Error('The shared repository cannot be released as a worktree')
    }
    if (!await this.isWorktreeAvailable(worktree)) {
      await this.git(['worktree', 'prune'], { cwd: this.config.baseRepositoryPath })
      return { released: true, alreadyReleased: true }
    }

    const status = await this.git(['status', '--short'], { cwd: worktree })
    if (status.stdout) {
      return {
        released: false,
        reason: `Uncommitted changes remain:\n${status.stdout}`,
      }
    }

    await this.git(['worktree', 'remove', worktree], {
      cwd: this.config.baseRepositoryPath,
      inherit: true,
    })
    return { released: true, alreadyReleased: false }
  }

  async getReview(worktree, branch) {
    const worktreeAvailable = await this.isWorktreeAvailable(worktree)
    const repository = worktreeAvailable ? worktree : this.config.baseRepositoryPath
    const currentBranch = worktreeAvailable
      ? null
      : await this.git(['branch', '--show-current'], { cwd: repository })
    const branchIsOpenInSharedRepository = currentBranch?.stdout === branch
    const inspectStatus = worktreeAvailable || branchIsOpenInSharedRepository
    const revision = inspectStatus ? 'HEAD' : branch
    if (!revision) {
      throw new Error('The ticket branch has not been prepared yet')
    }
    const branchComparison = `${this.config.remote}/${this.config.mainBranch}...${revision}`
    const [status, log, diffStat, files] = await Promise.all([
      inspectStatus
        ? this.git(['status', '--short'], { cwd: repository })
        : Promise.resolve({ stdout: '' }),
      this.git(
        [
          'log',
          '--format=%h %s',
          `${this.config.remote}/${this.config.mainBranch}..${revision}`,
        ],
        { cwd: repository },
      ),
      this.git(['diff', '--stat', branchComparison], { cwd: repository }),
      this.git(['diff', '--name-only', branchComparison], { cwd: repository }),
    ])

    const workingTreeStatus = splitWorkingTreeStatus(
      status.stdout,
      this.config.ignoredWorkingTreeFiles,
    )

    return {
      status: status.stdout,
      ...workingTreeStatus,
      commits: log.stdout ? log.stdout.split('\n') : [],
      diffStat: diffStat.stdout,
      files: files.stdout ? files.stdout.split('\n') : [],
    }
  }

  async validateForApproval(issueKey, worktree, branch) {
    const review = await this.getReview(worktree, branch)
    const problems = []

    if (review.blockingStatus) {
      problems.push(`Uncommitted changes remain:\n${review.blockingStatus}`)
    }
    if (review.commits.length === 0) {
      problems.push('No commit was created')
    }

    const commitPattern = new RegExp(`^[a-f0-9]+ ${issueKey}: .+`, 'i')
    const invalidCommits = review.commits.filter((commit) => !commitPattern.test(commit))
    if (invalidCommits.length > 0) {
      problems.push(`Invalid commit messages:\n${invalidCommits.join('\n')}`)
    }

    const forbiddenFiles = review.files.filter((file) =>
      matchesForbiddenPath(file, this.config.forbiddenFiles),
    )
    if (forbiddenFiles.length > 0) {
      problems.push(`Forbidden files changed:\n${forbiddenFiles.join('\n')}`)
    }

    return { valid: problems.length === 0, problems, review }
  }

  async push(branch, worktree) {
    const repository = await this.isWorktreeAvailable(worktree)
      ? worktree
      : this.config.baseRepositoryPath
    await this.git(
      ['push', '--set-upstream', this.config.remote, branch],
      { cwd: repository, inherit: true },
    )
  }

  async version() {
    return (await this.git(['--version'])).stdout
  }
}
