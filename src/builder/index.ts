
import fs from 'fs-extra';
import path from 'path';

const PARSED_DIR = path.resolve('data/parsed');
const DIST_DIR = path.resolve('dist');
const ITEMS_DIR = path.join(DIST_DIR, 'items');

const CATEGORY_MAP: Record<string, string> = {
  'operators': '干员',
  'weapons': '武器',
  'equipment': '装备',
  'monsters': '怪物',
  'materials': '材料'
};

const DEFAULT_TARGET_RATE_PRESETS = {
  halfPerMinute: 3,
  fullPerMinute: 6,
};

export async function buildPack() {
  console.log('Building pack...');
  await fs.emptyDir(DIST_DIR);
  await fs.ensureDir(ITEMS_DIR);

  const itemsIndex: string[] = [];
  const itemsLite: any[] = [];
  let itemCount = 0;

  const categories = Object.keys(CATEGORY_MAP);

  for (const category of categories) {
    const srcDir = path.join(PARSED_DIR, category);
    const destCategoryName = CATEGORY_MAP[category];
    const destDir = path.join(ITEMS_DIR, destCategoryName);

    if (!await fs.pathExists(srcDir)) continue;

    await fs.ensureDir(destDir);
    const files = await fs.readdir(srcDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const srcFile = path.join(srcDir, file);
      const content = await fs.readJson(srcFile);

      // Standardize ID
      const id = `gamekee_${content.id}`;
      const fileName = `id${content.id}.json`;
      const destFile = path.join(destDir, fileName);
      const relativePath = `items/${destCategoryName}/${fileName}`; // Forward slashes for JSON

      // Write Item File
      await fs.writeJson(destFile, {
        ...content,
        key: { id }
      }, { spaces: 2 });

      itemsIndex.push(relativePath);

      // Create Lite Item
      let icon = content.icon || content.avatar || content.image || '';
      if (icon.startsWith('//')) {
        icon = 'https:' + icon;
      }

      const liteItem = {
        key: { id },
        name: content.name,
        icon,
        description: content.description || content.summary || '',
        rarity: typeof content.rarity === 'number' ? { stars: content.rarity } : content.rarity,
        tags: [
          `source:gamekee`,
          `category:${destCategoryName}`,
          ...(content.tags || [])
        ]
      };
      itemsLite.push(liteItem);
      itemCount++;
    }
    console.log(`Processed ${category} -> ${destCategoryName}`);
  }

  // Sort itemsLite for consistency
  itemsLite.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  itemsIndex.sort();

  // 1. Write Items Metadata
  await fs.writeJson(path.join(DIST_DIR, 'itemsIndex.json'), itemsIndex, { spaces: 2 });
  await fs.writeJson(path.join(DIST_DIR, 'itemsLite.json'), itemsLite, { spaces: 2 });

  // 2. Write Empty Recipe Files (Required by Pack Structure)
  const recipeTypes: any[] = [];
  const recipes: any[] = [];
  await fs.writeJson(path.join(DIST_DIR, 'recipeTypes.json'), recipeTypes, { spaces: 2 });
  await fs.writeJson(path.join(DIST_DIR, 'recipes.json'), recipes, { spaces: 2 });

  // 3. Write Manifest
  const version = new Date().toISOString().split('T')[0];
  const manifest = {
    packId: "gamekee",
    gameId: "zmd",
    displayName: "GameKee Wiki Data",
    version,
    files: {
      items: "items/",
      itemsIndex: "itemsIndex.json",
      itemsLite: "itemsLite.json",
      recipeTypes: "recipeTypes.json",
      recipes: "recipes.json"
    },
    planner: {
      targetRatePresets: DEFAULT_TARGET_RATE_PRESETS,
    },
    startupDialog: {
      id: 'gamekee-data-notice-v1',
      title: '数据说明',
      message: '本数据包由 GameKee Wiki 抓取生成。数据仅供参考，请以游戏内为准。',
      confirmText: '我知道了'
    }
  };
  await fs.writeJson(path.join(DIST_DIR, 'manifest.json'), manifest, { spaces: 2 });

  // 4. Write Build Summary
  const buildSummary = {
    generatedAt: new Date().toISOString(),
    pack: {
      packId: "gamekee",
      gameId: "zmd",
      displayName: "GameKee Wiki Data",
      version
    },
    stats: {
      items: itemCount,
      categories: Object.values(CATEGORY_MAP),
      recipeTypes: 0,
      recipes: 0
    }
  };
  await fs.writeJson(path.join(DIST_DIR, 'build-summary.json'), buildSummary, { spaces: 2 });

  // 5. Static Hosting Configs (CORS, etc.)
  await fs.writeFile(path.join(DIST_DIR, '.nojekyll'), '');
  await fs.writeFile(path.join(DIST_DIR, '.gitignore'), 'node_modules\n.DS_Store\nThumbs.db\n');

  const headersContent = `/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, POST, OPTIONS
  Access-Control-Allow-Headers: *
`;
  await fs.writeFile(path.join(DIST_DIR, '_headers'), headersContent);

  const edgeoneConfig = {
    headers: [{
      source: "/*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Access-Control-Allow-Methods", value: "GET, HEAD, POST, OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "*" }
      ]
    }]
  };
  await fs.writeJson(path.join(DIST_DIR, 'edgeone.json'), edgeoneConfig, { spaces: 2 });

  const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GameKee Wiki Data</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    h1 { color: #333; }
    ul { list-style-type: none; padding: 0; }
    li { margin: 0.5rem 0; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta { color: #666; font-size: 0.9em; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <h1>GameKee Wiki Data</h1>
  <div class="meta">
    <p>Pack ID: gamekee</p>
    <p>Version: ${version}</p>
    <p>Generated: ${new Date().toISOString()}</p>
  </div>
  <h2>Files</h2>
  <ul>
    <li><a href="manifest.json">manifest.json</a></li>
    <li><a href="itemsIndex.json">itemsIndex.json</a></li>
    <li><a href="itemsLite.json">itemsLite.json</a></li>
    <li><a href="recipeTypes.json">recipeTypes.json</a></li>
    <li><a href="recipes.json">recipes.json</a></li>
    <li><a href="build-summary.json">build-summary.json</a></li>
  </ul>
</body>
</html>`;
  await fs.writeFile(path.join(DIST_DIR, 'index.html'), indexHtml);

  console.log(`Build complete. Generated ${itemCount} items.`);
}
