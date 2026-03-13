import { runCrawler } from './crawler/index.js';

console.log('Argv:', process.argv);
import { runParser } from './parser/index.js';

import { buildPack } from './builder/index.js';

const command = process.argv[2];

if (command === 'crawl') {
  console.log('Invoking runCrawler...');
  runCrawler().catch(err => {
    console.error('Crawler failed:', err);
  });
} else if (command === 'parse') {
  runParser().catch(console.error);
} else if (command === 'build') {
  buildPack().catch(console.error);
} else {
  console.log('Usage: pnpm start [crawl|parse|build]');
}
