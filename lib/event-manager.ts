/**
 * Zentrale Event-Management für Prozess-Events
 * Verhindert MaxListenersExceededWarning durch Singleton-Pattern
 */

interface CleanupFunction {
  (): void | Promise<void>;
}

class EventManager {
  private static instance: EventManager;
  private listeners: Map<string, CleanupFunction[]> = new Map();
  private registered = false;

  private constructor() {}

  static getInstance(): EventManager {
    if (!EventManager.instance) {
      EventManager.instance = new EventManager();
    }
    return EventManager.instance;
  }

  /**
   * Registriert eine Cleanup-Funktion für SIGINT/SIGTERM
   */
  registerCleanup(event: 'SIGINT' | 'SIGTERM', cleanup: CleanupFunction): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(cleanup);

    // Registriere Event-Listener nur einmal
    if (!this.registered) {
      this.registerProcessEvents();
    }
  }

  /**
   * Registriert Prozess-Events nur einmal
   */
  private registerProcessEvents(): void {
    if (this.registered || typeof process === 'undefined') {
      return;
    }

    this.registered = true;

    // Erhöhe MaxListeners für den Prozess
    process.setMaxListeners(20);

    process.on('SIGINT', async () => {
      console.log('🛑 SIGINT received, cleaning up...');
      await this.executeCleanup('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, cleaning up...');
      await this.executeCleanup('SIGTERM');
      process.exit(0);
    });

    console.log('✅ Event manager registered for SIGINT/SIGTERM');
  }

  /**
   * Führt alle registrierten Cleanup-Funktionen aus
   */
  private async executeCleanup(event: 'SIGINT' | 'SIGTERM'): Promise<void> {
    const cleanups = this.listeners.get(event) || [];
    
    console.log(`🧹 Executing ${cleanups.length} cleanup functions for ${event}`);
    
    for (const cleanup of cleanups) {
      try {
        await cleanup();
      } catch (error) {
        console.error('❌ Cleanup function failed:', error);
      }
    }
  }

  /**
   * Entfernt alle Event-Listener (für Tests)
   */
  clear(): void {
    this.listeners.clear();
    this.registered = false;
  }
}

// Singleton-Instanz exportieren
export const eventManager = EventManager.getInstance();

// Hilfsfunktion für einfache Registrierung
export function registerProcessCleanup(event: 'SIGINT' | 'SIGTERM', cleanup: CleanupFunction): void {
  eventManager.registerCleanup(event, cleanup);
} 