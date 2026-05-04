/**
 * Validate Bedrock pricing & bucket coverage for a list of model IDs.
 *
 * Usage:
 *   node config/validate-bedrock-pricing.js                                      # reads BEDROCK_AWS_MODELS from env
 *   node config/validate-bedrock-pricing.js anthropic.claude-opus-4-7,...        # explicit comma list
 *   node config/validate-bedrock-pricing.js --file path/to/models.txt            # one model per line
 *
 * Reports per model:
 *   • Pricing entry resolved from tokenValues (prompt/completion USD per 1M tokens),
 *     plus the matched key. If unresolved, the cost will silently be 0 and the
 *     bucket will not be debited — flagged as ERROR.
 *   • Premium tier (if any).
 *   • Bucket from librechat.yaml that the model would map to (or NONE).
 *
 * Exit code 0 when every model has both pricing and a bucket; 1 otherwise.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dotenv = require('dotenv');

require('./helpers');
const { tokenValues, premiumTokenValues } = require('@librechat/data-schemas');
const { findMatchingPattern } = require('@librechat/api');

const ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '--file' && args[1]) {
    return fs
      .readFileSync(args[1], 'utf8')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (args.length === 1 && args[0].includes(',')) {
    return args[0]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (args.length > 0) {
    return args;
  }
  const env = process.env.BEDROCK_AWS_MODELS;
  if (!env) {
    return [];
  }
  return env
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function loadBuckets() {
  const ymlPath = path.join(ROOT, 'librechat.yaml');
  if (!fs.existsSync(ymlPath)) {
    return { rejectUnmatched: false, buckets: [] };
  }
  const cfg = yaml.load(fs.readFileSync(ymlPath, 'utf8'));
  const mb = cfg?.modelBudgets ?? {};
  return {
    rejectUnmatched: mb.rejectUnmatchedModel === true,
    buckets: Array.isArray(mb.buckets) ? mb.buckets : [],
  };
}

function bucketFor(model, buckets) {
  const lower = model.toLowerCase();
  for (const b of buckets) {
    for (const p of b.match ?? []) {
      if (p && lower.includes(String(p).toLowerCase())) {
        return b;
      }
    }
  }
  return null;
}

function pricingFor(model) {
  const key = findMatchingPattern(model, tokenValues);
  if (!key) {
    return null;
  }
  return { key, ...tokenValues[key] };
}

function premiumFor(key) {
  if (!key) return null;
  return premiumTokenValues[key] ?? null;
}

function pad(s, n) {
  s = String(s ?? '');
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

(function main() {
  const models = parseArgs(process.argv);
  if (models.length === 0) {
    console.red('No models provided. Set BEDROCK_AWS_MODELS or pass a comma list.');
    process.exit(2);
  }

  const { rejectUnmatched, buckets } = loadBuckets();
  console.purple('-'.repeat(110));
  console.purple(
    `Validating ${models.length} model(s) — buckets: ${buckets.length}, rejectUnmatchedModel=${rejectUnmatched}`,
  );
  console.purple('-'.repeat(110));

  const header = `${pad('MODEL', 50)}${pad('PRICING KEY', 26)}${pad('PROMPT', 9)}${pad('COMPL', 9)}${pad('PREMIUM', 9)}${pad('BUCKET', 18)}`;
  console.cyan(header);
  console.gray('-'.repeat(110));

  let problems = 0;
  for (const m of models) {
    const p = pricingFor(m);
    const prem = premiumFor(p?.key);
    const b = bucketFor(m, buckets);

    let status = '';
    if (!p) {
      status = '  ❌ NO PRICING (cobro = 0)';
      problems++;
    } else if (!b && rejectUnmatched) {
      status = '  ⚠️  SIN BUCKET → 402 al usuario';
      problems++;
    } else if (!b) {
      status = '  ⚠️  sin bucket (no enforcement)';
    }

    const line =
      pad(m, 50) +
      pad(p?.key ?? '-', 26) +
      pad(p ? `$${p.prompt}` : '-', 9) +
      pad(p ? `$${p.completion}` : '-', 9) +
      pad(prem ? `>${prem.threshold}` : '-', 9) +
      pad(b?.key ?? '-', 18);

    if (!p) console.red(line + status);
    else if (!b && rejectUnmatched) console.yellow(line + status);
    else if (!b) console.yellow(line + status);
    else console.green(line + status);
  }

  console.gray('-'.repeat(110));
  if (problems === 0) {
    console.green(`OK — ${models.length} modelo(s) cubiertos por pricing + bucket.`);
    process.exit(0);
  }
  console.red(`Problemas: ${problems}/${models.length}. Resolvé antes de habilitar en .env.`);
  process.exit(1);
})();
