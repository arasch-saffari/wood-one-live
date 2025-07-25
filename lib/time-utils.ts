import { DateTime } from 'luxon';

// Default timezone for the application
const DEFAULT_TIMEZONE = 'Europe/Berlin'; // Adjust based on your location

export class TimeUtils {
  /**
   * Get current time in UTC as ISO string
   */
  static nowUtc(): string {
    return DateTime.now().toUTC().toISO()!;
  }

  /**
   * Convert a date to UTC ISO string for database storage
   */
  static toUtcIso(date: Date | string | DateTime): string {
    if (date instanceof DateTime) {
      return date.toUTC().toISO()!;
    }
    
    if (typeof date === 'string') {
      return DateTime.fromISO(date).toUTC().toISO()!;
    }
    
    return DateTime.fromJSDate(date).toUTC().toISO()!;
  }

  /**
   * Parse UTC ISO string from database to DateTime
   */
  static fromUtcIso(isoString: string): DateTime {
    return DateTime.fromISO(isoString, { zone: 'utc' });
  }

  /**
   * Convert UTC time to local timezone for display
   */
  static toLocalTime(utcIsoString: string, timezone: string = DEFAULT_TIMEZONE): DateTime {
    return DateTime.fromISO(utcIsoString, { zone: 'utc' }).setZone(timezone);
  }

  /**
   * Format time for API responses
   */
  static formatForApi(utcIsoString: string, timezone: string = DEFAULT_TIMEZONE): {
    utc: string;
    local: string;
    timezone: string;
  } {
    const utcTime = DateTime.fromISO(utcIsoString, { zone: 'utc' });
    const localTime = utcTime.setZone(timezone);

    return {
      utc: utcTime.toISO()!,
      local: localTime.toISO()!,
      timezone: timezone
    };
  }

  /**
   * Parse user input date with timezone awareness
   */
  static parseUserDate(dateString: string, timezone: string = DEFAULT_TIMEZONE): DateTime {
    // Try to parse as ISO first
    let parsed = DateTime.fromISO(dateString);
    
    if (!parsed.isValid) {
      // Try other common formats
      parsed = DateTime.fromFormat(dateString, 'yyyy-MM-dd HH:mm:ss', { zone: timezone });
    }
    
    if (!parsed.isValid) {
      parsed = DateTime.fromFormat(dateString, 'yyyy-MM-dd', { zone: timezone });
    }
    
    if (!parsed.isValid) {
      throw new Error(`Invalid date format: ${dateString}`);
    }
    
    return parsed;
  }

  /**
   * Get date range for queries (start of day to end of day in local timezone)
   */
  static getDayRange(dateString: string, timezone: string = DEFAULT_TIMEZONE): {
    start: string;
    end: string;
  } {
    const date = this.parseUserDate(dateString, timezone);
    const startOfDay = date.startOf('day');
    const endOfDay = date.endOf('day');

    return {
      start: startOfDay.toUTC().toISO()!,
      end: endOfDay.toUTC().toISO()!
    };
  }

  /**
   * Validate if a date string is valid
   */
  static isValidDate(dateString: string): boolean {
    try {
      const parsed = DateTime.fromISO(dateString);
      return parsed.isValid;
    } catch {
      return false;
    }
  }

  /**
   * Get relative time description (e.g., "2 hours ago")
   */
  static getRelativeTime(utcIsoString: string, timezone: string = DEFAULT_TIMEZONE): string {
    const time = DateTime.fromISO(utcIsoString, { zone: 'utc' }).setZone(timezone);
    return time.toRelative() || 'unknown';
  }

  /**
   * Format time for display in different formats
   */
  static formatDisplay(
    utcIsoString: string, 
    format: 'short' | 'medium' | 'long' | 'full' = 'medium',
    timezone: string = DEFAULT_TIMEZONE
  ): string {
    const time = DateTime.fromISO(utcIsoString, { zone: 'utc' }).setZone(timezone);
    
    switch (format) {
      case 'short':
        return time.toFormat('HH:mm');
      case 'medium':
        return time.toFormat('yyyy-MM-dd HH:mm');
      case 'long':
        return time.toFormat('yyyy-MM-dd HH:mm:ss');
      case 'full':
        return time.toFormat('cccc, yyyy-MM-dd HH:mm:ss ZZZZ');
      default:
        return time.toISO()!;
    }
  }

  /**
   * Check if a timestamp is within a certain age (in minutes)
   */
  static isWithinAge(utcIsoString: string, maxAgeMinutes: number): boolean {
    const time = DateTime.fromISO(utcIsoString, { zone: 'utc' });
    const now = DateTime.now().toUTC();
    const diffMinutes = now.diff(time, 'minutes').minutes;
    
    return diffMinutes <= maxAgeMinutes;
  }

  /**
   * Get timezone offset for a specific timezone
   */
  static getTimezoneOffset(timezone: string = DEFAULT_TIMEZONE): string {
    const now = DateTime.now().setZone(timezone);
    return now.toFormat('ZZ');
  }
}