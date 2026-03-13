import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import { GameKeeInitialState, ContentDetailResponse } from './types.js';

const execAsync = promisify(exec);

export default class GameKeeFetcher {
  private baseUrl: string;
  private userAgent: string;

  constructor() {
    this.baseUrl = 'https://www.gamekee.com';
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  private async curl(url: string, headers: Record<string, string> = {}): Promise<string> {
    // Build curl command
    const headerArgs = Object.entries(headers)
      .map(([k, v]) => `-H "${k}: ${v}"`)
      .join(' ');

    // Windows curl might need different quoting, but node exec usually handles simple cases.
    // Ensure we use the actual curl executable, not PowerShell alias if running in PS.
    // In node exec, it spawns a shell.

    const cmd = `curl -s -L ${headerArgs} "${url}"`;
    // console.log('Executing:', cmd);

    try {
      const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
      if (stderr) {
        // curl -s silences progress, but errors might still appear.
        // console.warn('curl stderr:', stderr);
      }
      return stdout;
    } catch (error) {
      throw new Error(`curl failed: ${error}`);
    }
  }

  async fetchEntryList(): Promise<GameKeeInitialState> {
    try {
      const headers = {
        'Game-Alias': 'zmd',
        'Game-Id': '50248',
        'User-Agent': this.userAgent,
      };

      const html = await this.curl(`${this.baseUrl}/zmd/`, headers);

      // Strategy 1: Check inline script
      let match = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/s);
      if (match && match[1]) {
        return JSON.parse(match[1]);
      }

      // Strategy 2: Check external state file
      const scriptMatch = html.match(/<script\s+src="([^"]*ssr-vuex-store-state\.js[^"]*)"/);
      if (scriptMatch && scriptMatch[1]) {
        let scriptUrl = scriptMatch[1];
        if (scriptUrl.startsWith('//')) {
          scriptUrl = 'https:' + scriptUrl;
        }

        console.log(`Fetching state from external script: ${scriptUrl}`);
        const scriptContent = await this.curl(scriptUrl, {
          ...headers,
          'Referer': 'https://www.gamekee.com/zmd/'
        });

        const prefix = 'window.__INITIAL_STATE__ = ';
        if (scriptContent.trim().startsWith(prefix)) {
          try {
            let jsonStr = scriptContent.trim().substring(prefix.length);
            if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);
            return JSON.parse(jsonStr);
          } catch (e) {
            console.error('JSON parse error:', e);
          }
        }

        match = scriptContent.match(/window\.__INITIAL_STATE__\s*=\s*({.+});?/s);
        if (match && match[1]) {
          return JSON.parse(match[1]);
        }

        throw new Error('Could not parse __INITIAL_STATE__ from external script');
      }

      throw new Error('Could not find __INITIAL_STATE__ in page HTML or external script');
    } catch (error) {
      console.error('Failed to fetch entry list:', error);
      throw error;
    }
  }

  async fetchContentDetail(contentId: number): Promise<ContentDetailResponse> {
    try {
      const headers = {
        'Game-Alias': 'zmd',
        'Game-Id': '50248',
        'User-Agent': this.userAgent,
      };

      const jsonStr = await this.curl(`${this.baseUrl}/v1/content/detail/${contentId}`, headers);
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error(`Failed to fetch content detail for ${contentId}:`, error);
      throw error;
    }
  }
}
