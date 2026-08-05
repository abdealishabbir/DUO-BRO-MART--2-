import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const urls = [
  'http://127.0.0.1:8080/',
  'http://127.0.0.1:8080/shop',
  'http://127.0.0.1:8080/cart',
  'http://127.0.0.1:8080/checkout',
  'http://127.0.0.1:8080/vendor'
];

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = [];

  // locate axe bundle in node_modules
  const axePkgDir = path.dirname(require.resolve('axe-core/package.json'));
  const axePath = path.join(axePkgDir, 'axe.min.js');
  const axeSource = fs.readFileSync(axePath, 'utf8');

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: axeSource });
      const res = await page.evaluate(async () => await window.axe.run());
      results.push({ url, result: res });
    } catch (err) {
      results.push({ url, error: String(err) });
    }
  }

  await browser.close();

  const outPath = path.join(process.cwd(), 'a11y-report.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('Wrote', outPath);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
