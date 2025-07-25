#!/usr/bin/env ts-node

import { copyFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { config } from '../lib/config';
import { logger } from '../lib/logger';
import { TimeUtils } from '../lib/time-utils';

async function backupDatabase() {
  try {
    const dbPath = config.database.path;
    
    if (!existsSync(dbPath)) {
      throw new Error(`Database file not found: ${dbPath}`);
    }

    // Create backup directory
    const backupDir = path.join(process.cwd(), 'backups');
    if (!existsSync(backupDir)) {
      await mkdir(backupDir, { recursive: true });
    }

    // Generate backup filename with timestamp
    const timestamp = TimeUtils.nowUtc().replace(/[:.]/g, '-');
    const backupFilename = `database-backup-${timestamp}.sqlite`;
    const backupPath = path.join(backupDir, backupFilename);

    // Copy database file
    await copyFile(dbPath, backupPath);

    logger.info({
      originalPath: dbPath,
      backupPath,
      timestamp
    }, 'Database backup completed successfully');

    console.log(`✅ Database backup created: ${backupPath}`);
    
  } catch (error) {
    logger.error({ error }, 'Database backup failed');
    console.error('❌ Database backup failed:', error);
    process.exit(1);
  }
}

// Run backup if called directly
if (require.main === module) {
  backupDatabase();
}

export { backupDatabase };