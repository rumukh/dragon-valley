// @ts-check
/**
 * Learner simulation:
 *
 *   node scripts/simulate.mjs [--days 84] [--learners perfect,average,struggling,slow]
 *                             [--seed simulation] [--out out/simulation] [--check]
 *                             [--balance partial-balance.json] [--answers] [--no-reading] [--reuse]
 *                             [--growth growth-variants.json]
 *
 * Deterministic synthetic learners (test/sim/learners.ts) play the real rules headlessly through
 * the runtime host, one simulated day after another (test/sim/driver.ts). Each learner runs in its
 * own process. The script writes `<out>/<learner>.json` (the full day-by-day report) and
 * `<out>/report.md` (summaries and the named balance checks of test/sim/report.ts), and prints the
 * markdown. With `--check` it exits 1 when a named check fails. `--balance` merges a partial
 * balance block into the content first; `--answers` also writes every answer (item, tier, box,
 * the learner's recall, right or wrong, the rules' bucket) to `<out>/<learner>.answers.json`;
 * the time a child takes to read a story is modelled unless `--no-reading` (which reproduces runs
 * from before 1.2.0); `--growth` follows other growth rules alongside the shipped ones (a JSON
 * array of test/sim/growth.ts variants; the report's `growthVariants` gives each dragon's stage
 * days under each); `--reuse` re-reads the reports of an earlier run instead of simulating.
 *
 * A simulated day costs about a hundred and fifty commits, so a long run takes minutes; the
 * Vitest gate runs only short simulations (test/sim/*.test.ts). docs/balance-report.md records the
 * long run.
 *
 * The TypeScript is bundled with esbuild into a temporary module, as scripts/validate-content.mjs
 * does, so this runs on plain Node.
 */
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMain, repositoryRoot } from './lib/tools.mjs';

export const LEARNER_NAMES = ['perfect', 'average', 'struggling', 'slow'];

/** @param {string} root */
async function loadSimulation(root) {
  const directory = mkdtempSync(join(tmpdir(), 'dv-simulate-'));
  try {
    const file = join(directory, 'simulate.mjs');
    await build({
      absWorkingDir: root,
      stdin: {
        contents: `export { simulate } from './test/sim/driver.ts';
export { summarise, runChecks, markdown } from './test/sim/report.ts';
export { contentRegistration } from './src/rules/contract/index.ts';
export { parseContentJson, requireValue } from '@aegis/runtime';`,
        resolveDir: root,
        loader: 'ts',
      },
      outfile: file,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'es2022',
      logLevel: 'warning',
    });
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** @param {string[]} args @param {string} name @param {string} fallback */
function option(args, name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined
    ? /** @type {string} */ (args[index + 1])
    : fallback;
}

/**
 * `patch` merged into `base`: objects key by key, anything else (numbers, arrays) replaced.
 * @param {any} base @param {any} patch @returns {any}
 */
export function merge(base, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  /** @type {Record<string, unknown>} */
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) out[key] = merge(base?.[key], value);
  return out;
}

/**
 * Simulate one learner in this process and write its report. `balance` is a JSON file with a
 * partial balance block merged into the content's (an experiment; the pack is validated after).
 * With `answers`, every answer is also written to `<learner>.answers.json` for analysis. `growth`
 * is a JSON file of growth variants to follow alongside the shipped rules.
 * @param {string} learner @param {number} days @param {string} seed @param {string} out
 * @param {string} balance @param {boolean} answers @param {boolean} reading @param {string} growth
 */
async function runWorker(learner, days, seed, out, balance, answers, reading, growth) {
  const sim = await loadSimulation(repositoryRoot);
  const started = process.hrtime.bigint();
  const file = join(repositoryRoot, 'content', 'dragon-valley.content.json');
  const json = JSON.parse(readFileSync(file, 'utf8'));
  if (balance)
    json.data.balance = merge(json.data.balance, JSON.parse(readFileSync(balance, 'utf8')));
  const pack = sim.requireValue(
    sim.parseContentJson(
      JSON.stringify(json),
      sim.contentRegistration,
      'dragon-valley.content.json',
    ),
  );
  /** @type {unknown[]} */
  const records = [];
  const catalog = reading
    ? JSON.parse(
        readFileSync(join(repositoryRoot, 'content', 'catalogs', 'en.content.json'), 'utf8'),
      )
    : undefined;
  const report = await sim.simulate(learner, days, {
    seed,
    pack,
    ...(reading ? { reading: true, catalog } : {}),
    ...(growth ? { growthVariants: JSON.parse(readFileSync(growth, 'utf8')) } : {}),
    onDay: (
      /** @type {{ index: number; played: boolean; answers: number; commits: number }} */ day,
    ) => {
      const seconds = Number((process.hrtime.bigint() - started) / 1_000_000_000n);
      process.stderr.write(
        `${learner} day ${day.index + 1}/${days}${day.played ? `: ${day.answers} answers, ${day.commits} commits` : ' (off)'} [${seconds}s]\n`,
      );
    },
    ...(answers ? { onAnswer: (/** @type {unknown} */ record) => records.push(record) } : {}),
  });
  writeFileSync(join(out, `${learner}.json`), JSON.stringify(report, null, 2) + '\n');
  if (answers) {
    const lines = records.map((record) => JSON.stringify(record)).join(',\n');
    writeFileSync(join(out, `${learner}.answers.json`), `[\n${lines}\n]\n`);
  }
}

/** @param {string[]} args */
function spawnWorker(args) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...args], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', fail);
    child.on('exit', (code) =>
      code === 0 ? done(undefined) : fail(new Error(`worker exited ${code}`)),
    );
  });
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const days = Number(option(args, 'days', '84'));
  const seed = option(args, 'seed', 'simulation');
  const out = resolve(repositoryRoot, option(args, 'out', join('out', 'simulation')));
  mkdirSync(out, { recursive: true });
  const balance = option(args, 'balance', '');
  const balancePath = balance ? resolve(balance) : '';
  const growth = option(args, 'growth', '');
  const growthPath = growth ? resolve(growth) : '';
  const worker = option(args, 'worker', '');
  const answers = args.includes('--answers');
  // Reading a story is modelled by default since 1.2.0; --no-reading reproduces earlier runs.
  const reading = !args.includes('--no-reading');
  if (worker) {
    await runWorker(worker, days, seed, out, balancePath, answers, reading, growthPath);
    process.exit(0);
  }
  const learners = option(args, 'learners', LEARNER_NAMES.join(',')).split(',');
  for (const learner of learners) {
    if (!LEARNER_NAMES.includes(learner)) throw new Error(`Unknown learner ${learner}.`);
  }
  if (!args.includes('--reuse')) {
    const runs = await Promise.allSettled(
      learners.map((learner) =>
        spawnWorker([
          ...['--worker', learner, '--days', String(days), '--seed', seed, '--out', out],
          ...(balancePath ? ['--balance', balancePath] : []),
          ...(growthPath ? ['--growth', growthPath] : []),
          ...(answers ? ['--answers'] : []),
          ...(reading ? [] : ['--no-reading']),
        ]),
      ),
    );
    const crashed = runs.filter((run) => run.status === 'rejected');
    if (crashed.length > 0) throw new Error(`${crashed.length} simulation worker(s) failed.`);
  }
  const sim = await loadSimulation(repositoryRoot);
  const reports = learners.map((learner) =>
    JSON.parse(readFileSync(join(out, `${learner}.json`), 'utf8')),
  );
  const checks = sim.runChecks(reports);
  const text = sim.markdown(reports.map(sim.summarise), checks, {
    days,
    seed,
    reading,
    ...(balance ? { balance: relative(repositoryRoot, balancePath).split(sep).join('/') } : {}),
  });
  writeFileSync(join(out, 'report.md'), text);
  process.stdout.write(text);
  const failed = checks.filter((/** @type {{ ok: boolean }} */ c) => !c.ok);
  if (args.includes('--check') && failed.length > 0) {
    process.stderr.write(`${failed.length} balance check(s) failed.\n`);
    process.exit(1);
  }
}
