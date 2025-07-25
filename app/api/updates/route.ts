let subscribers: { controller: ReadableStreamDefaultController, closed: boolean }[] = []

// Singleton für Event-Listener-Registrierung
let eventListenersRegistered = false

// Debouncing für SSE-Updates
let updateTimeout: NodeJS.Timeout | null = null
let pendingUpdates: Record<string, unknown>[] = []

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
        try {
          controller.close()
        } catch {
          // Controller already closed, ignore
        }
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

export function triggerDeltaUpdate(updateData?: Record<string, unknown>) {
  // Add to pending updates
  if (updateData) {
    pendingUpdates.push(updateData)
  }
  
  // Clear existing timeout
  if (updateTimeout) {
    clearTimeout(updateTimeout)
  }
  
  // Debounce updates - send after 50ms of inactivity (reduced from 100ms)
  updateTimeout = setTimeout(() => {
    sendDebouncedUpdate()
  }, 50)
}

function sendDebouncedUpdate() {
  const encoder = new TextEncoder()
  
  // Combine all pending updates into one payload
  const payload = {
    timestamp: new Date().toISOString(),
    updates: pendingUpdates.length > 0 ? pendingUpdates : undefined,
    type: pendingUpdates.length > 0 ? 'batch_update' : 'generic_update'
  };
  
  const data = `event: update\ndata: ${JSON.stringify(payload)}\n\n`
  
  let successCount = 0;
  let errorCount = 0;
  
  // Create a copy of subscribers and validate their state
  const activeSubscribers = subscribers.filter(sub => {
    // Remove closed subscribers
    if (sub.closed) {
      return false
    }
    
    // Validate controller state
    try {
      // Test if controller is still valid by checking its state
      if (!sub.controller || typeof sub.controller.enqueue !== 'function') {
        sub.closed = true
        return false
      }
      return true
    } catch {
      sub.closed = true
      return false
    }
  });
  
  // Update the main subscribers array to remove invalid ones
  subscribers = subscribers.filter(sub => !sub.closed)
  
  for (const sub of activeSubscribers) {
    try {
      // Double-check controller state before sending
      if (!sub.closed && sub.controller && typeof sub.controller.enqueue === 'function') {
        // Additional safety check - try to access controller properties
        if (sub.controller.desiredSize !== undefined) {
          // Final safety check - wrap the enqueue call in try-catch
          try {
            sub.controller.enqueue(encoder.encode(data))
            successCount++;
          } catch (enqueueError) {
            // Controller became invalid between checks
            sub.closed = true;
            errorCount++;
            console.debug('Controller became invalid during enqueue:', enqueueError)
          }
        } else {
          sub.closed = true;
          errorCount++;
        }
      } else {
        sub.closed = true;
        errorCount++;
      }
    } catch (error) {
      sub.closed = true // Mark as closed to avoid repeated errors
      errorCount++;
      console.error('Fehler beim Senden von SSE-Update:', error)
    }
  }
  
  // Log Update-Statistiken
  if (process.env.NODE_ENV === 'development') {
    console.log(`📡 SSE Update sent: ${successCount} success, ${errorCount} errors, updates: ${pendingUpdates.length}`);
  }
  
  // Cleanup geschlossene Verbindungen
  if (errorCount > 0) {
    cleanupSubscribers();
  }
  
  // Clear pending updates
  pendingUpdates = []
  updateTimeout = null
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