import fs from 'fs-extra';
import path from 'path';
import GameKeeFetcher from './fetcher.js';
import type { GameKeeEntry } from './types.js';

const DATA_RAW_DIR = path.resolve('data/raw');

// Define categories we are interested in
const TARGET_CATEGORIES = [
  '干员图鉴',
  '武器图鉴',
  '装备图鉴',
  '怪物图鉴',
  '材料图鉴',
  '可用道具图鉴',
  '设备图鉴'
];

async function ensureDirs() {
  await fs.ensureDir(DATA_RAW_DIR);
  for (const cat of TARGET_CATEGORIES) {
    await fs.ensureDir(path.join(DATA_RAW_DIR, cat));
  }
}

function findTargetEntries(entries: GameKeeEntry[], targetName: string): GameKeeEntry[] {
  for (const entry of entries) {
    if (entry.name.includes(targetName)) {
      return entry.child || [];
    }
    if (entry.child) {
      const found = findTargetEntries(entry.child, targetName);
      if (found.length > 0) return found;
    }
  }
  return [];
}

// Flatten the entry tree to get all leaf nodes with content_id
function flattenEntries(entries: GameKeeEntry[]): GameKeeEntry[] {
  let result: GameKeeEntry[] = [];
  for (const entry of entries) {
    if (entry.content_id) {
      result.push(entry);
    }
    if (entry.child) {
      result = result.concat(flattenEntries(entry.child));
    }
  }
  return result;
}

export async function runCrawler() {
  console.log('Starting crawler...');
  await ensureDirs();

  // Rate Limiting Configuration
  const CRAWL_DELAY = parseInt(process.env.CRAWL_DELAY || '2000'); // Default 2s for safety
  const FORCE_UPDATE = process.env.FORCE_UPDATE === 'true'; // If true, refetch even if exists
  const SKIP_EXISTING = process.env.SKIP_EXISTING === 'true'; // If true, skip if exists (default behavior if FORCE_UPDATE is false)

  console.log(`Config: Delay=${CRAWL_DELAY}ms, Force=${FORCE_UPDATE}, Skip=${SKIP_EXISTING}`);

  const fetcher = new GameKeeFetcher();

  console.log('Fetching entry list...');
  const initialState = await fetcher.fetchEntryList();
  const entryList = initialState.entryList;

  for (const categoryName of TARGET_CATEGORIES) {
    console.log(`Processing category: ${categoryName}`);
    const categoryEntries = findTargetEntries(entryList, categoryName);
    const items = flattenEntries(categoryEntries);

    console.log(`Found ${items.length} items in ${categoryName}`);

    const categoryDir = path.join(DATA_RAW_DIR, categoryName);
    await fs.ensureDir(categoryDir);

    let count = 0;
    for (const item of items) {
      const filePath = path.join(categoryDir, `${item.content_id}.json`);
      const exists = await fs.pathExists(filePath);

      if (exists && !FORCE_UPDATE && SKIP_EXISTING) {
        // console.log(`Skipping ${item.name} (already exists)`);
        continue;
      }

      // If exists but FORCE_UPDATE is false and SKIP_EXISTING is false, we proceed to update?
      // Wait, logic:
      // If FORCE_UPDATE=true, fetch regardless.
      // If FORCE_UPDATE=false:
      //    If SKIP_EXISTING=true, skip if exists.
      //    If SKIP_EXISTING=false (default?), fetch regardless (update).
      
      // Let's refine defaults for CI usage:
      // CI (Daily): FORCE_UPDATE=false, SKIP_EXISTING=false (we want updates). Delay=2000.
      // Manual (Fast): FORCE_UPDATE=false, SKIP_EXISTING=true (just fill missing). Delay=0.
      
      // So if exists and we want to update, we proceed.

      if (exists && SKIP_EXISTING) {
          continue;
      }

      count++;
      console.log(`[${count}/${items.length}] Fetching ${item.name} (${item.content_id})...`);

      try {
        const detail = await fetcher.fetchContentDetail(item.content_id);
        if (detail.code === 0) {
          // Write only if changed? fs.writeJson overwrites.
          // Git handles diff.
          // Optional: Read existing and compare to avoid unnecessary writes/mtime updates?
          // But 'only update changed data' usually refers to commit stage.
          // Let's just write.
          await fs.writeJson(filePath, detail.data, { spaces: 2 });
        } else {
          console.error(`Error fetching ${item.name}: ${detail.msg}`);
        }
      } catch (err) {
        console.error(`Failed to fetch ${item.name}`, err);
      }

      // Rate limiting
      if (CRAWL_DELAY > 0) {
        await new Promise(resolve => setTimeout(resolve, CRAWL_DELAY));
      }
    }
  }

  console.log('Crawler finished.');
}
