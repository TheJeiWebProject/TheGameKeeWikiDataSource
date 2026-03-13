
import GameKeeFetcher from './src/crawler/fetcher.js';
import fs from 'fs-extra';

async function debug() {
  const fetcher = new GameKeeFetcher();
  console.log('Fetching entry list...');
  try {
    const initialState = await fetcher.fetchEntryList();
    const entryList = initialState.entryList;
    
    // Save to file for inspection
    await fs.writeJson('debug_entry_list.json', entryList, { spaces: 2 });
    console.log('Saved entry list to debug_entry_list.json');

    // Helper to print hierarchy
    function printTree(entries: any[], depth = 0) {
      for (const entry of entries) {
        const indent = '  '.repeat(depth);
        console.log(`${indent}- ${entry.name} (id: ${entry.id}, content_id: ${entry.content_id || 'N/A'})`);
        if (entry.child && entry.child.length > 0) {
          printTree(entry.child, depth + 1);
        }
      }
    }

    // Print top level and first level children
    // printTree(entryList);

    // Count items in target categories
    const targets = ['干员图鉴', '武器图鉴', '装备图鉴', '怪物图鉴'];
    
    function countItems(entries: any[], target: string): number {
        let count = 0;
        for (const entry of entries) {
            if (entry.name.includes(target)) {
                // Found category, count leaves
                return countLeaves(entry.child || []);
            }
            if (entry.child) {
                const found = countItems(entry.child, target);
                if (found > 0) return found;
            }
        }
        return 0;
    }

    function countLeaves(entries: any[]): number {
        let c = 0;
        for (const entry of entries) {
            if (entry.content_id) c++;
            if (entry.child) c += countLeaves(entry.child);
        }
        return c;
    }

    for (const t of targets) {
        console.log(`${t}: ${countItems(entryList, t)} items found in entry list.`);
    }

  } catch (e) {
    console.error(e);
  }
}

debug();
