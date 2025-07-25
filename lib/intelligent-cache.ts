import fs from 'fs';
import path from 'path';
import { LRUCache } from 'lru-cache';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccess: number;
  tags: string[];
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  memoryUsage: number;
}

export class IntelligentCache {
  private memoryCache: LRUCache<string, CacheEntry<any>>;
  private diskCacheDir: string;
  private stats: CacheStats;
  private tagIndex: Map<string, Set<string>>;
  private compressionEnabled: boolean;

  constructor(options: {
    maxMemoryItems?: number;
    maxMemorySize?: number; // in MB
    diskCacheDir?: string;
    compressionEnabled?: boolean;
  } = {}) {
    this.memoryCache = new LRUCache({
      max: options.maxMemoryItems || 1000,
      maxSize: (options.maxMemorySize || 100) * 1024 * 1024, // Convert MB to bytes
      sizeCalculation: (value: CacheEntry<any>) => {
        return JSON.stringify(value.data).length;
      },
      dispose: (value, key) => {
        // Schreibe häufig genutzte Einträge auf Disk
        if (value.hits > 5) {
          this.writeToDisk(key, value);
        }
      }
    });

    this.diskCacheDir = options.diskCacheDir || path.join(process.cwd(), 'cache');
    this.compressionEnabled = options.compressionEnabled || true;
    this.tagIndex = new Map();
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0,
      memoryUsage: 0
    };

    this.ensureCacheDir();
    this.startCleanupInterval();
  }

  /**
   * Intelligentes Get mit Multi-Level-Caching
   */
  async get<T>(key: string, tags: string[] = []): Promise<T | null> {
    // 1. Versuche Memory-Cache
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      memoryEntry.hits++;
      memoryEntry.lastAccess = Date.now();
      this.stats.hits++;
      return memoryEntry.data as T;
    }

    // 2. Versuche Disk-Cache
    const diskEntry = await this.readFromDisk<T>(key);
    if (diskEntry && !this.isExpired(diskEntry)) {
      // Lade zurück in Memory-Cache
      this.memoryCache.set(key, diskEntry);
      diskEntry.hits++;
      diskEntry.lastAccess = Date.now();
      this.stats.hits++;
      return diskEntry.data;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Intelligentes Set mit adaptiver TTL
   */
  async set<T>(
    key: string, 
    data: T, 
    options: {
      ttl?: number;
      tags?: string[];
      priority?: 'low' | 'normal' | 'high';
      persistToDisk?: boolean;
    } = {}
  ): Promise<void> {
    const now = Date.now();
    const ttl = this.calculateAdaptiveTTL(key, options.ttl);
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
      hits: 0,
      lastAccess: now,
      tags: options.tags || []
    };

    // Setze in Memory-Cache
    this.memoryCache.set(key, entry);

    // Aktualisiere Tag-Index
    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }

    // Persistiere wichtige Daten sofort auf Disk
    if (options.priority === 'high' || options.persistToDisk) {
      await this.writeToDisk(key, entry);
    }

    this.stats.sets++;
    this.updateStats();
  }

  /**
   * Löscht Einträge basierend auf Tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let deletedCount = 0;
    const keysToDelete = new Set<string>();

    for (const tag of tags) {
      const taggedKeys = this.tagIndex.get(tag);
      if (taggedKeys) {
        taggedKeys.forEach(key => keysToDelete.add(key));
      }
    }

    for (const key of keysToDelete) {
      await this.delete(key);
      deletedCount++;
    }

    return deletedCount;
  }

  /**
   * Löscht einen Cache-Eintrag
   */
  async delete(key: string): Promise<boolean> {
    const memoryDeleted = this.memoryCache.delete(key);
    const diskDeleted = await this.deleteFromDisk(key);
    
    // Entferne aus Tag-Index
    for (const [tag, keys] of this.tagIndex) {
      keys.delete(key);
      if (keys.size === 0) {
        this.tagIndex.delete(tag);
      }
    }

    if (memoryDeleted || diskDeleted) {
      this.stats.deletes++;
      this.updateStats();
      return true;
    }

    return false;
  }

  /**
   * Berechnet adaptive TTL basierend auf Nutzungsmustern
   */
  private calculateAdaptiveTTL(key: string, requestedTTL?: number): number {
    const defaultTTL = 5 * 60 * 1000; // 5 Minuten
    
    if (requestedTTL) {
      return requestedTTL;
    }

    // Analysiere Nutzungsmuster für intelligente TTL
    const existingEntry = this.memoryCache.get(key);
    if (existingEntry) {
      // Häufig genutzte Einträge bekommen längere TTL
      if (existingEntry.hits > 10) {
        return defaultTTL * 3; // 15 Minuten
      } else if (existingEntry.hits > 5) {
        return defaultTTL * 2; // 10 Minuten
      }
    }

    // Spezielle TTL für verschiedene Datentypen
    if (key.includes('station_data')) {
      return 2 * 60 * 1000; // 2 Minuten für Live-Daten
    } else if (key.includes('aggregated')) {
      return 15 * 60 * 1000; // 15 Minuten für Aggregate
    } else if (key.includes('historical')) {
      return 60 * 60 * 1000; // 1 Stunde für historische Daten
    }

    return defaultTTL;
  }

  /**
   * Schreibt Eintrag auf Disk
   */
  private async writeToDisk<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const filePath = this.getDiskPath(key);
      const data = this.compressionEnabled 
        ? await this.compress(JSON.stringify(entry))
        : JSON.stringify(entry);
      
      await fs.promises.writeFile(filePath, data);
    } catch (error) {
      console.warn(`Failed to write cache entry to disk: ${key}`, error);
    }
  }

  /**
   * Liest Eintrag von Disk
   */
  private async readFromDisk<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const filePath = this.getDiskPath(key);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = await fs.promises.readFile(filePath, 'utf-8');
      const decompressed = this.compressionEnabled 
        ? await this.decompress(data)
        : data;
      
      return JSON.parse(decompressed) as CacheEntry<T>;
    } catch (error) {
      console.warn(`Failed to read cache entry from disk: ${key}`, error);
      return null;
    }
  }

  /**
   * Löscht Eintrag von Disk
   */
  private async deleteFromDisk(key: string): Promise<boolean> {
    try {
      const filePath = this.getDiskPath(key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
    } catch (error) {
      console.warn(`Failed to delete cache entry from disk: ${key}`, error);
    }
    return false;
  }

  /**
   * Generiert Disk-Pfad für Cache-Key
   */
  private getDiskPath(key: string): string {
    const hash = this.hashKey(key);
    const subDir = hash.substring(0, 2);
    const dir = path.join(this.diskCacheDir, subDir);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    return path.join(dir, `${hash}.cache`);
  }

  /**
   * Erstellt Hash für Cache-Key
   */
  private hashKey(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Komprimiert Daten (vereinfacht)
   */
  private async compress(data: string): Promise<string> {
    // Hier könnte echte Komprimierung implementiert werden (z.B. mit zlib)
    // Für jetzt nur Base64-Encoding als Platzhalter
    return Buffer.from(data).toString('base64');
  }

  /**
   * Dekomprimiert Daten
   */
  private async decompress(data: string): Promise<string> {
    return Buffer.from(data, 'base64').toString('utf-8');
  }

  /**
   * Prüft ob Eintrag abgelaufen ist
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > (entry.timestamp + entry.ttl);
  }

  /**
   * Stellt sicher, dass Cache-Verzeichnis existiert
   */
  private ensureCacheDir(): void {
    if (!fs.existsSync(this.diskCacheDir)) {
      fs.mkdirSync(this.diskCacheDir, { recursive: true });
    }
  }

  /**
   * Startet Cleanup-Interval
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Alle 5 Minuten
  }

  /**
   * Bereinigt abgelaufene Einträge
   */
  private async cleanup(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;

    // Memory-Cache wird automatisch durch LRU bereinigt
    
    // Disk-Cache bereinigen
    try {
      const files = await this.getAllDiskCacheFiles();
      
      for (const file of files) {
        try {
          const data = await fs.promises.readFile(file, 'utf-8');
          const entry = JSON.parse(
            this.compressionEnabled ? await this.decompress(data) : data
          ) as CacheEntry<any>;
          
          if (this.isExpired(entry)) {
            await fs.promises.unlink(file);
            cleanedCount++;
          }
        } catch (error) {
          // Defekte Datei löschen
          await fs.promises.unlink(file);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} expired cache entries from disk`);
      }
    } catch (error) {
      console.warn('Cache cleanup failed:', error);
    }
  }

  /**
   * Holt alle Disk-Cache-Dateien
   */
  private async getAllDiskCacheFiles(): Promise<string[]> {
    const files: string[] = [];
    
    const scanDir = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.name.endsWith('.cache')) {
          files.push(fullPath);
        }
      }
    };
    
    if (fs.existsSync(this.diskCacheDir)) {
      await scanDir(this.diskCacheDir);
    }
    
    return files;
  }

  /**
   * Aktualisiert Cache-Statistiken
   */
  private updateStats(): void {
    this.stats.size = this.memoryCache.size;
    this.stats.memoryUsage = this.memoryCache.calculatedSize || 0;
  }

  /**
   * Gibt Cache-Statistiken zurück
   */
  getStats(): CacheStats & {
    hitRate: number;
    avgHitsPerEntry: number;
    topKeys: Array<{ key: string; hits: number }>;
  } {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    // Top-Keys nach Hits
    const topKeys: Array<{ key: string; hits: number }> = [];
    for (const [key, entry] of this.memoryCache.entries()) {
      topKeys.push({ key, hits: entry.hits });
    }
    topKeys.sort((a, b) => b.hits - a.hits);
    
    const avgHitsPerEntry = this.stats.size > 0 
      ? topKeys.reduce((sum, item) => sum + item.hits, 0) / this.stats.size 
      : 0;

    return {
      ...this.stats,
      hitRate,
      avgHitsPerEntry,
      topKeys: topKeys.slice(0, 10)
    };
  }

  /**
   * Leert den gesamten Cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.tagIndex.clear();
    
    // Lösche Disk-Cache
    try {
      const files = await this.getAllDiskCacheFiles();
      await Promise.all(files.map(file => fs.promises.unlink(file)));
    } catch (error) {
      console.warn('Failed to clear disk cache:', error);
    }
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0,
      memoryUsage: 0
    };
  }

  /**
   * Warming-Funktion für häufig genutzte Daten
   */
  async warmup(keys: Array<{ key: string; generator: () => Promise<any>; ttl?: number; tags?: string[] }>): Promise<void> {
    console.log(`🔥 Starting cache warmup for ${keys.length} keys...`);
    
    const promises = keys.map(async ({ key, generator, ttl, tags }) => {
      try {
        const existing = await this.get(key);
        if (!existing) {
          const data = await generator();
          await this.set(key, data, { ttl, tags, priority: 'high' });
        }
      } catch (error) {
        console.warn(`Failed to warm up cache key: ${key}`, error);
      }
    });
    
    await Promise.all(promises);
    console.log('✅ Cache warmup completed');
  }
}

// Singleton-Instanz
export const intelligentCache = new IntelligentCache({
  maxMemoryItems: 2000,
  maxMemorySize: 256, // 256MB
  diskCacheDir: path.join(process.cwd(), 'cache', 'intelligent'),
  compressionEnabled: true
});