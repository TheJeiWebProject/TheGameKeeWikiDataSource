import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GAMEKEE_CDN_PATTERN = /(?:https?:)?\/\/cdnimg-v2\.gamekee\.com\/wiki2\.0\/images\/[^\s"'\\]+/g;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REFERER = 'https://www.gamekee.com/';

/**
 * 从 GameKee CDN URL 提取本地存储的相对路径（wiki2.0/images/ 之后的部分，去掉 query string）
 */
function urlToLocalRelPath(url: string): string {
  // 规范化为 https: 开头
  const normalized = url.startsWith('//') ? 'https:' + url : url;
  try {
    const u = new URL(normalized);
    // 取 /wiki2.0/images/ 之后的路径部分
    const match = u.pathname.match(/\/wiki2\.0\/images\/(.+)/);
    if (match) return match[1]!;
    // fallback: 取路径去掉开头斜杠
    return u.pathname.replace(/^\//, '');
  } catch {
    // URL 解析失败时直接字符串截取
    const withoutQuery = url.split('?')[0]!;
    const idx = withoutQuery.indexOf('/wiki2.0/images/');
    if (idx !== -1) return withoutQuery.slice(idx + '/wiki2.0/images/'.length);
    return path.basename(withoutQuery);
  }
}

/**
 * 使用 curl 下载单张图片，带防盗链所需的 Referer 和 User-Agent
 */
async function downloadImage(imageUrl: string, destPath: string): Promise<boolean> {
  const httpsUrl = imageUrl.startsWith('//') ? 'https:' + imageUrl : imageUrl;
  // 去掉 query string 只保留原始图片
  const cleanUrl = httpsUrl.split('?')[0]!;

  await fs.ensureDir(path.dirname(destPath));

  const cmd = [
    'curl',
    '-s', '-L', '--fail',
    '--max-time', '30',
    '-H', `"Referer: ${REFERER}"`,
    '-H', `"User-Agent: ${USER_AGENT}"`,
    '--create-dirs',
    '-o', `"${destPath}"`,
    `"${cleanUrl}"`
  ].join(' ');

  try {
    await execAsync(cmd, { maxBuffer: 20 * 1024 * 1024 });
    return true;
  } catch (err) {
    // 下载失败则删除可能创建的空文件
    try { await fs.remove(destPath); } catch {}
    return false;
  }
}

/**
 * 并发控制：最多同时运行 concurrency 个任务
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onProgress?: (done: number, total: number) => void
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;
  let done = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]!();
      done++;
      onProgress?.(done, tasks.length);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * 主入口：扫描 distDir 下所有 JSON，下载 GameKee 图片并替换 URL
 */
export async function downloadAndReplaceImages(distDir: string): Promise<void> {
  console.log('\n[Images] 扫描 dist 目录中的 GameKee 图片 URL...');

  const imagesBaseDir = path.join(distDir, 'images');

  // 1. 收集所有 JSON 文件
  const jsonFiles: string[] = [];
  async function collectJson(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectJson(full);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        jsonFiles.push(full);
      }
    }
  }
  await collectJson(distDir);

  // 2. 扫描所有图片 URL => 记录哪些文件引用了哪些 URL
  // urlToFiles: url -> Set<filePath>
  const urlToFiles = new Map<string, Set<string>>();

  for (const filePath of jsonFiles) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const matches = raw.match(GAMEKEE_CDN_PATTERN);
    if (!matches) continue;
    for (const url of matches) {
      if (!urlToFiles.has(url)) urlToFiles.set(url, new Set());
      urlToFiles.get(url)!.add(filePath);
    }
  }

  if (urlToFiles.size === 0) {
    console.log('[Images] 未发现需要下载的图片 URL，跳过。');
    return;
  }

  console.log(`[Images] 发现 ${urlToFiles.size} 个唯一图片 URL`);

  // 3. 下载图片
  const urlList = Array.from(urlToFiles.keys());
  // url -> local relative path (relative to distDir), e.g. "images/w_120/h_120/.../xxx.png"
  const urlToLocalPath = new Map<string, string>();

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  const tasks = urlList.map(url => async () => {
    const relPath = urlToLocalRelPath(url);
    const localPath = path.join(imagesBaseDir, relPath);
    const localRelForJson = 'images/' + relPath.replace(/\\/g, '/');
    urlToLocalPath.set(url, localRelForJson);

    // 已下载则跳过
    if (await fs.pathExists(localPath)) {
      skipCount++;
      return;
    }

    const ok = await downloadImage(url, localPath);
    if (ok) {
      successCount++;
    } else {
      failCount++;
      console.warn(`[Images] 下载失败: ${url}`);
      // 失败时保留原始 URL（不替换）
      urlToLocalPath.delete(url);
    }
  });

  await runWithConcurrency(tasks, 5, (done, total) => {
    if (done % 20 === 0 || done === total) {
      process.stdout.write(`\r[Images] 进度: ${done}/${total}  `);
    }
  });
  console.log(`\n[Images] 下载完成: 成功 ${successCount}, 跳过(已存在) ${skipCount}, 失败 ${failCount}`);

  if (urlToLocalPath.size === 0) {
    console.log('[Images] 无成功下载，不替换 URL。');
    return;
  }

  // 4. 替换 JSON 文件中的 URL
  console.log('[Images] 替换 JSON 文件中的图片 URL...');
  let replacedFiles = 0;

  for (const filePath of jsonFiles) {
    let raw = await fs.readFile(filePath, 'utf-8');
    let modified = false;

    for (const [origUrl, localPath] of urlToLocalPath) {
      if (raw.includes(origUrl)) {
        // 在 JSON 字符串中，URL 可能出现转义斜杠，先用原始形式替换
        raw = raw.split(origUrl).join(localPath);
        modified = true;
      }
    }

    if (modified) {
      await fs.writeFile(filePath, raw, 'utf-8');
      replacedFiles++;
    }
  }

  console.log(`[Images] 已更新 ${replacedFiles} 个 JSON 文件的图片 URL`);
}
