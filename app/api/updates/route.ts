import { initializeApplication } from '@/lib/app-init'
import { registerProcessCleanup } from '@/lib/event-manager'

let initialized = false

let subscribers: { controller: ReadableStreamDefaultController, closed: boolean, id: string }[] = []

// Singleton für Event-Listener-Registrierung
let eventListenersRegistered = false

// Debouncing für SSE-Updates
let updateTimeout: NodeJS.Timeout | null = null
let pendingUpdates: Record<string, unknown>[] = []

// Controller state tracking
const controllerStates = new Map<string, boolean>()

// Aggressive SSE-Schutz während CSV-Processing
let isProcessingCSV = false

// Circuit Breaker für SSE-Controller-Fehler
let sseCircuitBreakerOpen = false
let controllerErrorCount = 0
const MAX_CONTROLLER_ERRORS = 5 // Erhöht von 2 auf 5 für weniger empfindliche Reaktion
const CIRCUIT_BREAKER_TIMEOUT = 60000 // 1 Minute
let lastControllerError = 0

// Intelligente SSE-Deaktivierung - nur problematische Controller blockieren
const problematicControllers = new Set<string>()

// Controller cleanup timer
let controllerCleanupTimer: NodeJS.Timeout | null = null

// Heartbeat mechanism
let heartbeatInterval: NodeJS.Timeout | null = null
const HEARTBEAT_INTERVAL = 120000 // 2 minutes

// Funktion zum Bereinigen alter problematischer Controller
function cleanupProblematicControllers() {
  if (problematicControllers.size > 0) {
    console.debug(`🧹 Cleaning up ${problematicControllers.size} problematic controllers`)
    problematicControllers.clear()
  }
  
  // Automatische Bereinigung alle 30 Sekunden
  controllerCleanupTimer = setTimeout(cleanupProblematicControllers, 30000)
}

// Setup heartbeat mechanism
function setupHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
  }
  
  heartbeatInterval = setInterval(() => {
    try {
      // Send heartbeat to all active subscribers
      subscribers.forEach(subscriber => {
        if (!subscriber.closed && controllerStates.get(subscriber.id)) {
          try {
            const encoder = new TextEncoder()
            subscriber.controller.enqueue(encoder.encode(':\n\n')) // Heartbeat comment
          } catch (error) {
            console.debug(`💓 Heartbeat failed for subscriber ${subscriber.id}:`, error)
            problematicControllers.add(subscriber.id)
          }
        }
      })
    } catch (error) {
      console.debug('💓 Heartbeat mechanism error:', error)
    }
  }, HEARTBEAT_INTERVAL)
  
  console.debug('💓 SSE heartbeat mechanism started')
}

// Global rate limiting für SSE-Updates
let lastGlobalUpdate = 0
const MIN_GLOBAL_UPDATE_INTERVAL = 10000 // 10 Sekunden zwischen globalen Updates

export async function GET() {
  // Initialize application on first API call
  if (!initialized) {
    try {
      initializeApplication()
      initialized = true
      
      // Setup heartbeat mechanism on first connection
      setupHeartbeat()
    } catch (error) {
      console.error('Application initialization failed:', error)
      // Continue anyway, don't fail the SSE connection
    }
  }

  let cleanup: (() => void) | undefined
  let subscriber: { controller: ReadableStreamDefaultController, closed: boolean, id: string }
  const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode('retry: 10000\n\n'))
      subscriber = { controller, closed: false, id: subscriberId }
      subscribers.push(subscriber)
      controllerStates.set(subscriberId, true)
      
      cleanup = () => {
        subscriber.closed = true
        controllerStates.set(subscriberId, false)
        subscribers = subscribers.filter(s => s !== subscriber)
        problematicControllers.delete(subscriberId) // Remove from problematic controllers on cleanup
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
  // Intelligente SSE-Deaktivierung Check - nur bei zu vielen problematischen Controllern blockieren
  if (problematicControllers.size > 10) { // Erhöht von 5 auf 10 für weniger empfindliche Reaktion
    console.debug(`🛡️  SSE blocked for ${problematicControllers.size} problematic controllers`)
    return
  }
  
  // Circuit Breaker Check - nur bei sehr vielen Controller-Fehlern deaktivieren
  const now = Date.now()
  if (sseCircuitBreakerOpen) {
    if (now - lastControllerError < CIRCUIT_BREAKER_TIMEOUT) {
      console.debug('🛡️  SSE circuit breaker open - updates blocked')
      return
    } else {
      // Circuit Breaker zurücksetzen nach Timeout
      sseCircuitBreakerOpen = false
      controllerErrorCount = 0
      problematicControllers.clear() // Problematic controllers zurücksetzen
      console.debug('🛡️  SSE circuit breaker reset')
      
      // Cleanup timer zurücksetzen
      if (controllerCleanupTimer) {
        clearTimeout(controllerCleanupTimer)
        controllerCleanupTimer = null
      }
      
      // Cleanup function aufrufen
      cleanupProblematicControllers()
    }
  }
  
  // CSV-Processing-Schutz - komplett deaktivieren wenn CSV-Processing läuft
  if (isProcessingCSV) {
    console.debug('🛡️  SSE update blocked during CSV processing')
    return
  }
  
  // Global rate limiting check
  if (now - lastGlobalUpdate < MIN_GLOBAL_UPDATE_INTERVAL) {
    console.debug('⏱️  Global SSE update rate limited (10s interval)')
    return
  }
  
  // Add to pending updates
  if (updateData) {
    pendingUpdates.push(updateData)
  }
  
  // Clear existing timeout
  if (updateTimeout) {
    clearTimeout(updateTimeout)
  }
  
  // Debounce updates - send after 100ms of inactivity (increased from 50ms)
  updateTimeout = setTimeout(() => {
    lastGlobalUpdate = Date.now()
    sendDebouncedUpdate()
  }, 100)
}

// Funktion zum Aktivieren des CSV-Processing-Schutzes
export function setCSVProcessingState(processing: boolean) {
  isProcessingCSV = processing
  if (processing) {
    console.debug('🛡️  SSE protection activated for CSV processing')
  } else {
    console.debug('🛡️  SSE protection deactivated')
  }
}

// Funktion zum Zurücksetzen der intelligenten SSE-Deaktivierung
export function resetGlobalSSEDisable() {
  sseCircuitBreakerOpen = false
  controllerErrorCount = 0
  problematicControllers.clear()
  
  // Cleanup timer zurücksetzen
  if (controllerCleanupTimer) {
    clearTimeout(controllerCleanupTimer)
    controllerCleanupTimer = null
  }
  
  console.debug('🛡️  Intelligent SSE disable reset')
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
      controllerStates.set(sub.id, false)
      return false
    }
    
    // Check if controller state is still valid
    if (!controllerStates.get(sub.id)) {
      sub.closed = true
      return false
    }
    
    // Validate controller state
    try {
      // Test if controller is still valid by checking its state
      if (!sub.controller || typeof sub.controller.enqueue !== 'function') {
        sub.closed = true
        controllerStates.set(sub.id, false)
        return false
      }
      return true
    } catch {
      sub.closed = true
      controllerStates.set(sub.id, false)
      return false
    }
  });
  
  // Update the main subscribers array to remove invalid ones
  subscribers = subscribers.filter(sub => !sub.closed)
  
  for (const sub of activeSubscribers) {
    try {
      // Triple-check controller state before sending
      if (!sub.closed && 
          sub.controller && 
          typeof sub.controller.enqueue === 'function' &&
          controllerStates.get(sub.id)) {
        
        // Additional safety check - try to access controller properties
        if (sub.controller.desiredSize !== undefined) {
          // Final safety check - wrap the enqueue call in try-catch
          try {
            // Additional check: ensure controller is not in closed state
            if (sub.controller.desiredSize !== null) {
              // One more check: ensure controller is still valid
              if (typeof sub.controller.enqueue === 'function' && !sub.closed) {
                sub.controller.enqueue(encoder.encode(data))
                successCount++;
              } else {
                // Controller became invalid
                sub.closed = true;
                controllerStates.set(sub.id, false);
                errorCount++;
              }
            } else {
              // Controller is closed
              sub.closed = true;
              controllerStates.set(sub.id, false);
              errorCount++;
            }
          } catch (enqueueError) {
            // Controller became invalid between checks
            sub.closed = true;
            controllerStates.set(sub.id, false);
            errorCount++;
            console.debug('Controller became invalid during enqueue:', enqueueError)
            
            // Intelligente Controller-Blockierung
            problematicControllers.add(sub.id)
            console.debug(`🛡️  Controller ${sub.id} marked as problematic`)
            
            // Circuit Breaker Logic
            controllerErrorCount++;
            lastControllerError = Date.now()
            
            if (controllerErrorCount >= MAX_CONTROLLER_ERRORS) {
              sseCircuitBreakerOpen = true
              console.warn('🛡️  SSE circuit breaker opened due to controller errors')
            }
          }
        } else {
          sub.closed = true;
          controllerStates.set(sub.id, false);
          errorCount++;
        }
      } else {
        sub.closed = true;
        controllerStates.set(sub.id, false);
        errorCount++;
      }
    } catch (error) {
      sub.closed = true // Mark as closed to avoid repeated errors
      controllerStates.set(sub.id, false);
      errorCount++;
      console.error('Fehler beim Senden von SSE-Update:', error)
      
      // Circuit Breaker Logic
      controllerErrorCount++;
      lastControllerError = Date.now()
      
      if (controllerErrorCount >= MAX_CONTROLLER_ERRORS) {
        sseCircuitBreakerOpen = true
        console.warn('🛡️  SSE circuit breaker opened due to controller errors')
      }
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
  // Cleanup controller states for closed subscribers
  for (const sub of subscribers) {
    if (sub.closed) {
      controllerStates.delete(sub.id)
    }
  }
}
setInterval(cleanupSubscribers, 30000)

// Registriere Cleanup bei Prozessende (nur einmal)
if (!eventListenersRegistered) {
  eventListenersRegistered = true
  
  // Verwende zentralen Event-Manager statt direkte process.on Aufrufe
  registerProcessCleanup('SIGINT', () => {
    subscribers = []
    controllerStates.clear()
  })
  
  registerProcessCleanup('SIGTERM', () => {
    subscribers = []
    controllerStates.clear()
  })
} 