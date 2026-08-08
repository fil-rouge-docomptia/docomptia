export class EventBus {
  constructor(limit = 300) {
    this.limit = limit
    this.events = []
    this.listeners = new Set()
  }

  publish(event) {
    const nextEvent = {
      id: `${Date.now()}-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      level: 'info',
      ...event,
    }
    this.events.push(nextEvent)
    if (this.events.length > this.limit) this.events.shift()
    this.listeners.forEach((listener) => listener(nextEvent))
    return nextEvent
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getRecentEvents(runId) {
    return runId
      ? this.events.filter((event) => event.runId === runId)
      : [...this.events]
  }
}
