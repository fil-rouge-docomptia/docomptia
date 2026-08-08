function adfNodeToText(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(adfNodeToText).join('')

  const ownText = typeof node.text === 'string' ? node.text : ''
  const children = Array.isArray(node.content)
    ? node.content.map(adfNodeToText).join('')
    : ''
  const separator = ['paragraph', 'heading', 'listItem'].includes(node.type) ? '\n' : ''
  return `${ownText}${children}${separator}`
}

export function adfToText(document) {
  if (!document) return ''
  if (typeof document === 'string') return document
  return adfNodeToText(document).replace(/\n{3,}/g, '\n\n').trim()
}

function textToAdf(text) {
  return {
    type: 'doc',
    version: 1,
    content: text.split('\n').map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  }
}

function replaceJqlVariables(template, variables) {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  )
}

const transitionAliases = [
  ['to do', 'a faire', 'à faire'],
  ['in progress', 'en cours'],
  ['code review', 'in review', 'en revue', 'revue de code'],
  ['done', 'termine', 'terminé'],
]

function normalizeStatus(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function resolveTransition(transitions, targetStatus) {
  const normalizedTarget = normalizeStatus(targetStatus)
  const aliasGroup = transitionAliases.find((aliases) =>
    aliases.map(normalizeStatus).includes(normalizedTarget),
  )
  const acceptedStatuses = new Set(
    (aliasGroup || [targetStatus]).map(normalizeStatus),
  )
  return transitions.find((candidate) =>
    acceptedStatuses.has(normalizeStatus(candidate.name)),
  )
}

export class JiraClient {
  constructor(config) {
    this.config = config.jira
    this.baseUrl = this.config.baseUrl.replace(/\/$/, '')
    this.authorization = `Basic ${Buffer.from(
      `${this.config.email}:${this.config.apiToken}`,
    ).toString('base64')}`
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: this.authorization,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Jira ${response.status} ${response.statusText}: ${body}`)
    }

    if (response.status === 204) {
      return null
    }
    return response.json()
  }

  async searchIssues(jql) {
    const body = await this.request('/rest/api/3/search/jql', {
      method: 'POST',
      body: JSON.stringify({
        jql,
        maxResults: 100,
        fields: [
          'summary',
          'description',
          'status',
          'issuetype',
          'parent',
          this.config.acceptanceCriteriaField,
        ].filter(Boolean),
      }),
    })
    return body.issues.map((issue) => this.mapIssue(issue))
  }

  getEpics() {
    const jql = `project = ${this.config.projectKey} AND issuetype = "${this.config.epicIssueType}" ORDER BY created ASC`
    return this.searchIssues(jql)
  }

  getEpicTasks(epicKey) {
    const jql = replaceJqlVariables(this.config.childrenJqlTemplate, {
      projectKey: this.config.projectKey,
      epicKey,
    })
    return this.searchIssues(jql)
  }

  async getIssue(issueKey) {
    const fields = [
      'summary',
      'description',
      'status',
      'issuetype',
      'parent',
      this.config.acceptanceCriteriaField,
    ].filter(Boolean)
    const issue = await this.request(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=${fields.join(',')}`,
    )
    return this.mapIssue(issue)
  }

  async transitionIssue(issueKey, targetStatus) {
    if (!targetStatus) return

    const body = await this.request(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    )
    const transition = resolveTransition(body.transitions, targetStatus)
    if (!transition) {
      const available = body.transitions.map(({ name }) => name).join(', ')
      throw new Error(
        `Jira transition "${targetStatus}" is unavailable for ${issueKey}. Available: ${available}`,
      )
    }

    await this.request(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
      {
        method: 'POST',
        body: JSON.stringify({ transition: { id: transition.id } }),
      },
    )
    return transition.name
  }

  async addComment(issueKey, comment) {
    await this.request(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, {
      method: 'POST',
      body: JSON.stringify({ body: textToAdf(comment) }),
    })
  }

  async getCurrentUser() {
    const user = await this.request('/rest/api/3/myself')
    return user.displayName || user.emailAddress || user.accountId
  }

  mapIssue(issue) {
    const acceptanceField = this.config.acceptanceCriteriaField
    return {
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      description: adfToText(issue.fields.description),
      acceptanceCriteria: acceptanceField
        ? adfToText(issue.fields[acceptanceField])
        : '',
      status: issue.fields.status?.name || '',
      issueType: issue.fields.issuetype?.name || '',
      parentKey: issue.fields.parent?.key || '',
    }
  }
}
