// Cron-Optimizer für bessere Performance und weniger missed executions
import cron from 'node-cron'
import { registerProcessCleanup } from './event-manager'

interface CronJobConfig {
  name: string
  schedule: string
  handler: () => Promise<void>
  timeout?: number
  timezone?: string
  maxRetries?: number
}

class CronOptimizer {
  private jobs = new Map<string, cron.ScheduledTask>()
  private runningJobs = new Set<string>()
  private jobStats = new Map<string, {
    executions: number
    failures: number
    avgDuration: number
    lastExecution: Date | null
  }>()

  public addJob(config: CronJobConfig) {
    const {
      name,
      schedule,
      handler,
      timeout = 60000,
      timezone = "Europe/Berlin",
      maxRetries = 3
    } = config

    // Initialisiere Statistiken
    this.jobStats.set(name, {
      executions: 0,
      failures: 0,
      avgDuration: 0,
      lastExecution: null
    })

    const task = cron.schedule(schedule, async () => {
      // Verhindere überlappende Ausführungen
      if (this.runningJobs.has(name)) {
        console.warn(`[CronOptimizer] Job ${name} läuft bereits, überspringe Ausführung`)
        return
      }

      this.runningJobs.add(name)
      const startTime = Date.now()
      let attempt = 0

      while (attempt < maxRetries) {
        try {
          // Promise mit Timeout
          const jobPromise = Promise.race([
            handler(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error(`Job ${name} timeout after ${timeout}ms`)), timeout)
            )
          ])

          await jobPromise
          
          // Erfolgreiche Ausführung
          const duration = Date.now() - startTime
          this.updateStats(name, duration, true)
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[CronOptimizer] Job ${name} erfolgreich in ${duration}ms ausgeführt`)
          }
          
          break // Erfolg, keine weiteren Versuche nötig

        } catch (error) {
          attempt++
          const duration = Date.now() - startTime
          
          if (attempt >= maxRetries) {
            // Alle Versuche fehlgeschlagen
            this.updateStats(name, duration, false)
            console.error(`[CronOptimizer] Job ${name} fehlgeschlagen nach ${attempt} Versuchen:`, error)
          } else {
            // Retry nach exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
            console.warn(`[CronOptimizer] Job ${name} Versuch ${attempt} fehlgeschlagen, retry in ${delay}ms:`, error)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }

      this.runningJobs.delete(name)
    }, {
      scheduled: true,
      timezone
    })

    this.jobs.set(name, task)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[CronOptimizer] Job ${name} registriert: ${schedule} (${timezone})`)
    }
  }

  private updateStats(name: string, duration: number, success: boolean) {
    const stats = this.jobStats.get(name)
    if (!stats) return

    stats.executions++
    stats.lastExecution = new Date()
    
    if (success) {
      // Gleitender Durchschnitt für Ausführungszeit
      stats.avgDuration = stats.avgDuration === 0 
        ? duration 
        : (stats.avgDuration * 0.8) + (duration * 0.2)
    } else {
      stats.failures++
    }

    this.jobStats.set(name, stats)
  }

  public getJobStats(name?: string) {
    if (name) {
      return this.jobStats.get(name)
    }
    return Object.fromEntries(this.jobStats.entries())
  }

  public stopJob(name: string) {
    const task = this.jobs.get(name)
    if (task) {
      task.stop()
      this.jobs.delete(name)
      this.runningJobs.delete(name)
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CronOptimizer] Job ${name} gestoppt`)
      }
    }
  }

  public stopAllJobs() {
    for (const [name, task] of this.jobs.entries()) {
      task.stop()
    }
    this.jobs.clear()
    this.runningJobs.clear()
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[CronOptimizer] Alle Jobs gestoppt')
    }
  }

  public getRunningJobs() {
    return Array.from(this.runningJobs)
  }

  public isJobRunning(name: string) {
    return this.runningJobs.has(name)
  }
}

// Singleton-Instanz
export const cronOptimizer = new CronOptimizer()

// Cleanup bei Prozessende
const cleanup = () => {
  cronOptimizer.stopAllJobs()
};

registerProcessCleanup('SIGINT', cleanup);
registerProcessCleanup('SIGTERM', cleanup);

export default cronOptimizer