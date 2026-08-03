import test from 'node:test'
import assert from 'node:assert/strict'
import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { GitService, matchesForbiddenPath, slugify } from '../src/git-service.mjs'
import { runCommand } from '../src/process.mjs'

test('slugify builds a readable branch suffix', () => {
  assert.equal(
    slugify("Creer la facture brouillon avant le lancement de l'OCR"),
    'creer_la_facture_brouillon_avant_le_lancement_de_l_ocr',
  )
})

test('forbidden paths identify certificates and generated files', () => {
  const patterns = [
    '**/certs/**',
    '**/*netskope*',
    '**/__pycache__/**',
    'out/**',
  ]

  assert.equal(matchesForbiddenPath('backend/certs/netskope-ca.pem', patterns), true)
  assert.equal(matchesForbiddenPath('ocr/app/__pycache__/service.pyc', patterns), true)
  assert.equal(matchesForbiddenPath('out/production/backend/app.yml', patterns), true)
  assert.equal(matchesForbiddenPath('backend/src/main/java/Invoice.java', patterns), false)
})

test('GitService creates the ticket branch in the shared repository', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'kan-agent-git-'))
  const remote = resolve(directory, 'remote.git')
  const seed = resolve(directory, 'seed')
  const worktrees = resolve(directory, 'agent', 'worktrees')

  try {
    await mkdir(seed, { recursive: true })
    await runCommand('git', ['init', '--bare', '--initial-branch=main', remote])
    await runCommand('git', ['init', '--initial-branch=main'], { cwd: seed })
    await runCommand('git', ['config', 'user.email', 'agent@example.test'], { cwd: seed })
    await runCommand('git', ['config', 'user.name', 'KAN Agent Test'], { cwd: seed })
    await writeFile(resolve(seed, 'README.md'), '# Test\n', 'utf8')
    await runCommand('git', ['add', 'README.md'], { cwd: seed })
    await runCommand('git', ['commit', '-m', 'Initial commit'], { cwd: seed })
    await runCommand('git', ['remote', 'add', 'origin', remote], { cwd: seed })
    await runCommand('git', ['push', '-u', 'origin', 'main'], { cwd: seed })

    const service = new GitService({
      git: {
        repositoryUrl: remote,
        sharedRepository: true,
        baseRepositoryPath: seed,
        worktreesDirectory: worktrees,
        remote: 'origin',
        mainBranch: 'main',
        forbiddenFiles: ['**/certs/**', 'out/**'],
      },
    })
    const prepared = await service.prepareWorktree({
      key: 'KAN-123',
      summary: 'Implement local integration test',
    })

    await runCommand('git', ['config', 'user.email', 'agent@example.test'], {
      cwd: prepared.worktree,
    })
    await runCommand('git', ['config', 'user.name', 'KAN Agent Test'], {
      cwd: prepared.worktree,
    })
    await writeFile(resolve(prepared.worktree, 'feature.txt'), 'implemented\n', 'utf8')
    await runCommand('git', ['add', 'feature.txt'], { cwd: prepared.worktree })
    await runCommand('git', ['commit', '-m', 'KAN-123: Implement local test'], {
      cwd: prepared.worktree,
    })

    const validation = await service.validateForApproval(
      'KAN-123',
      prepared.worktree,
      prepared.branch,
    )
    const localBranch = await runCommand(
      'git',
      ['branch', '--list', 'KAN-123_implement_local_integration_test'],
      { cwd: seed },
    )
    assert.equal(prepared.branch, 'KAN-123_implement_local_integration_test')
    assert.match(localBranch.stdout, /KAN-123_implement_local_integration_test/)
    assert.equal(validation.valid, true)
    assert.deepEqual(validation.review.files, ['feature.txt'])

    const released = await service.releaseWorktree(prepared.worktree)
    assert.equal(released.released, true)
    await assert.rejects(access(prepared.worktree))

    const detachedValidation = await service.validateForApproval(
      'KAN-123',
      null,
      prepared.branch,
    )
    assert.equal(detachedValidation.valid, true)
    assert.deepEqual(detachedValidation.review.files, ['feature.txt'])

    await runCommand('git', ['switch', prepared.branch], { cwd: seed })
    const sharedDraftFile = resolve(seed, 'shared-draft.txt')
    await writeFile(sharedDraftFile, 'not committed\n', 'utf8')
    const sharedRepositoryValidation = await service.validateForApproval(
      'KAN-123',
      null,
      prepared.branch,
    )
    assert.equal(sharedRepositoryValidation.valid, false)
    assert.match(sharedRepositoryValidation.review.status, /shared-draft\.txt/)
    await rm(sharedDraftFile)
    await runCommand('git', ['switch', 'main'], { cwd: seed })

    const resumed = await service.prepareWorktree({
      key: 'KAN-123',
      summary: 'Implement local integration test',
    })
    const draftFile = resolve(resumed.worktree, 'draft.txt')
    await writeFile(draftFile, 'not committed\n', 'utf8')

    const kept = await service.releaseWorktree(resumed.worktree)
    assert.equal(kept.released, false)
    assert.match(kept.reason, /draft\.txt/)

    await rm(draftFile)
    const releasedAfterCleanup = await service.releaseWorktree(resumed.worktree)
    assert.equal(releasedAfterCleanup.released, true)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
