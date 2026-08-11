const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

const base = String(pkg.version || '1.0.0').split('-')[0];
const sha = (process.env.GITHUB_SHA || 'local').slice(0, 7);
const run = process.env.GITHUB_RUN_NUMBER || '0';
const version = `${base}-build.${run}.${sha}`;

pkg.version = version;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const out = process.env.GITHUB_OUTPUT;
if (out) {
  fs.appendFileSync(out, `version=${version}\n`);
  fs.appendFileSync(out, `tag=v${version}\n`);
}

process.stdout.write(version);
