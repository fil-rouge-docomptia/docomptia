import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { WebWorkflowService } from './web-workflow-service.mjs'

const sourceDirectory = dirname(fileURLToPath(import.meta.url))
const webDistribution = resolve(sourceDirectory, '..', 'web', 'dist')
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('Request body is too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function routeParts(pathname) {
  return pathname.split('/').filter(Boolean).map(decodeURIComponent)
}

function openEventStream(request, response, workflowService) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  response.write('retry: 2000\n\n')
  workflowService.events.getRecentEvents().forEach((event) => {
    response.write(`data: ${JSON.stringify(event)}\n\n`)
  })

  const unsubscribe = workflowService.events.subscribe((event) => {
    response.write(`data: ${JSON.stringify(event)}\n\n`)
  })
  const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 20_000)
  request.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
}

async function serveFrontend(pathname, response) {
  let relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
  let filePath = resolve(webDistribution, relativePath)
  if (!filePath.startsWith(`${webDistribution}${sep}`)) {
    sendJson(response, 403, { error: 'Forbidden path' })
    return
  }

  try {
    const fileStat = await stat(filePath)
    if (fileStat.isDirectory()) filePath = resolve(filePath, 'index.html')
    await access(filePath)
  } catch {
    filePath = resolve(webDistribution, 'index.html')
    try {
      await access(filePath)
    } catch {
      sendJson(response, 404, {
        error: 'Web build not found. Run npm run web:build or npm run web.',
      })
      return
    }
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  createReadStream(filePath).pipe(response)
}

export function createAgentRequestHandler(workflowService = new WebWorkflowService()) {
  return async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    const parts = routeParts(url.pathname)

    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { status: 'ok' })
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/events') {
        openEventStream(request, response, workflowService)
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/doctor') {
        sendJson(response, 200, await workflowService.doctor())
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/epics') {
        sendJson(response, 200, await workflowService.getEpics())
        return
      }
      if (
        request.method === 'GET' &&
        parts[0] === 'api' && parts[1] === 'epics' && parts[3] === 'tickets'
      ) {
        sendJson(response, 200, await workflowService.getEpicTasks(parts[2]))
        return
      }
      if (
        request.method === 'GET' &&
        parts[0] === 'api' && parts[1] === 'tickets' && parts[2]
      ) {
        sendJson(response, 200, await workflowService.getIssue(parts[2]))
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/workflows/active') {
        sendJson(response, 200, await workflowService.getActive())
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/workflows/history') {
        sendJson(response, 200, await workflowService.getHistory())
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/workflows/review') {
        sendJson(response, 200, await workflowService.getReview())
        return
      }
      if (request.method === 'POST' && url.pathname === '/api/workflows') {
        const body = await readJson(request)
        if (!body.issueKey) throw new Error('issueKey is required')
        sendJson(
          response,
          202,
          await workflowService.start(body.issueKey, body.epicKey),
        )
        return
      }
      if (request.method === 'POST' && url.pathname === '/api/workflows/revise') {
        const body = await readJson(request)
        sendJson(response, 202, await workflowService.revise(body.instruction))
        return
      }
      if (request.method === 'POST' && url.pathname === '/api/workflows/approve') {
        sendJson(response, 200, await workflowService.approve())
        return
      }
      if (request.method === 'POST' && url.pathname === '/api/workflows/push') {
        sendJson(response, 202, await workflowService.push())
        return
      }
      if (request.method === 'POST' && url.pathname === '/api/workflows/abort') {
        sendJson(response, 200, await workflowService.abort())
        return
      }
      if (url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'API route not found' })
        return
      }
      await serveFrontend(url.pathname, response)
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : 409
      sendJson(response, status, { error: error.message })
    }
  }
}

export function createAgentServer(workflowService = new WebWorkflowService()) {
  return createServer(createAgentRequestHandler(workflowService))
}

export function startAgentServer() {
  const port = Number.parseInt(process.env.KAN_AGENT_WEB_PORT || '4310', 10)
  const host = process.env.KAN_AGENT_WEB_HOST || '127.0.0.1'
  const server = createAgentServer()
  server.listen(port, host, () => {
    console.log(`KAN Agent web API: http://${host}:${port}`)
  })
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startAgentServer()
}
