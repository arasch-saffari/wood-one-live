let subscribers: { controller: ReadableStreamDefaultController, closed: boolean }[] = []

// Singleton für Event-Listener-Registrierung
let eventListenersRegistered = false

export async function GET() {
  let cleanup: (() => void) | undefined
  let subscriber: { controller: ReadableStreamDefaultController, closed: boolean }
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode('retry: 10000\n\n'))
      subscriber = { controller, closed: false }
      subscribers.push(subscriber)
      cleanup = () => {
        subscriber.closed = true
        subscribers = subscribers.filter(s => s !== subscriber)
        controller.close()
      }
    },
  })
  ;(stream as unknown as { cancel: () => Promise<void> }).cancel = async () => { if (cleanup) cleanup() }
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export function triggerDeltaUpdate() {
  const encoder = new TextEncoder()
  const data = `event: update\ndata: {"timestamp": "${new Date().toISOString()}"}\n\n`
  for (const sub of subscribers) {
    if (!sub.closed) {
      try {
        sub.controller.enqueue(encoder.encode(data))
      } catch (error) {
        sub.closed = true // Mark as closed to avoid repeated errors
        console.error('Fehler beim Senden von SSE-Update:', error)
      }
    }
  }
}

// Cleanup-Funktion für SSE-Subscriber
function cleanupSubscribers() {
  subscribers = subscribers.filter(s => !s.closed)
}
setInterval(cleanupSubscribers, 30000)

// Registriere Cleanup bei Prozessende (nur einmal)
if (typeof process !== 'undefined' && process.on && !eventListenersRegistered) {
  eventListenersRegistered = true
  process.on('SIGINT', () => {
    subscribers = []
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    subscribers = []
    process.exit(0)
  })
} 