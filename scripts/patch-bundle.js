const fs = require('node:fs');
const path = require('node:path');

const bundlePath = 'dist/index.cjs';
const playwrightVersion = require('playwright-core/package.json').version;
const playwrightRoot = path.dirname(require.resolve('playwright-core/package.json'));
const playwrightBrowsers = JSON.parse(fs.readFileSync(path.join(playwrightRoot, 'browsers.json'), 'utf8'));
let source = fs.readFileSync(bundlePath, 'utf8');

const dynamicPackageLoad = `packageRoot = import_path8.default.join(__dirname, "..");
        packageJSON = require(import_path8.default.join(packageRoot, "package.json"));
        binPath = import_path8.default.join(packageRoot, "bin");`;

const staticPackageLoad = `packageRoot = __dirname;
        packageJSON = { version: ${JSON.stringify(playwrightVersion)} };
        binPath = import_path8.default.join(packageRoot, "bin");`;

if (!source.includes(dynamicPackageLoad)) {
  throw new Error('Could not find Playwright package loader block in bundle.');
}

source = source.replace(dynamicPackageLoad, staticPackageLoad);
source = source.replace(
  'registry = new Registry(require(import_path19.default.join(packageRoot, "browsers.json")));',
  `registry = new Registry(${JSON.stringify(playwrightBrowsers)});`
);
fs.writeFileSync(bundlePath, source);
console.log(`Patched Playwright package metadata: ${playwrightVersion}`);
