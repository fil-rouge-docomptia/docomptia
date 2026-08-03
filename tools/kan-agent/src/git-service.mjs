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
  return patterns.some((pattern) => globToRegExp(pattern).test(path))
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
    const status = await this.git(['status', '--porcelain'], { cwd: repository })
    if (status.stdout) {
      throw new Error(`The agent base repository is not clean:\n${status.stdout}`)
    }

    await this.git(['fetch', this.config.remote], { cwd: repository, inherit: true })
    await this.git(['switch', this.config.mainBranch], { cwd: repository, inherit: true })
    await this.git(
      ['pull', '--ff-only', this.config.remote, this.config.mainBranch],
      { cwd: repository, inherit: true },
    )
  }

  async prepareWorktree(issue) {
    await this.syncMain()

    const branch = `${issue.key}_${slugify(issue.summary)}`
    const worktree = resolve(this.config.worktreesDirectory, branch)
    await mkdir(this.config.worktreesDirectory, { recursive: true })

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
        ['worktree', 'add', '-b', branch, worktree, this.config.mainBranch],
        { cwd: this.config.baseRepositoryPath, inherit: true },
      )
    }

    return { branch, worktree, resumed: false }
  }

  async getReview(worktree) {
    const comparison = `${this.config.remote}/${this.config.mainBranch}...HEAD`
    const [status, log, diffStat, files] = await Promise.all([
      this.git(['status', '--short'], { cwd: worktree }),
      this.git(['log', '--format=%h %s', `${this.config.remote}/${this.config.mainBranch}..HEAD`], {
        cwd: worktree,
      }),
      this.git(['diff', '--stat', comparison], { cwd: worktree }),
      this.git(['diff', '--name-only', comparison], { cwd: worktree }),
    ])

    return {
      status: status.stdout,
      commits: log.stdout ? log.stdout.split('\n') : [],
      diffStat: diffStat.stdout,
      files: files.stdout ? files.stdout.split('\n') : [],
    }
  }

  async validateForApproval(issueKey, worktree) {
    const review = await this.getReview(worktree)
    const problems = []

    if (review.status) {
      problems.push(`Uncommitted changes remain:\n${review.status}`)
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
    await this.git(
      ['push', '--set-upstream', this.config.remote, branch],
      { cwd: worktree, inherit: true },
    )
  }

  async version() {
    return (await this.git(['--version'])).stdout
  }
}
