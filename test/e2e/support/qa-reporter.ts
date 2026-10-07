/**
 * A Playwright reporter that turns one run into evidence a person can read without opening the
 * HTML report: totals, the known defects that still reproduce (or no longer do), the tests that
 * used more than half their time budget, and the accessibility advice axe gave (moderate and
 * minor findings, by rule). It writes
 * `qa-summary.md` into the run's output folder (`test-results/` on the default port,
 * test/e2e/support/site.ts) and, on GitHub Actions, the job summary.
 *
 * With `DV_E2E_AUDIT=1` (CI) it also audits the run, as scripts/verify.mjs does for Vitest:
 * every spec file on disk (of the selected parts, test/e2e/support/parts.ts) must have run in
 * every project, and a skipped test must say why. Otherwise the run fails.
 */
import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { DEFECTS } from './known-issues';
import type { Defect } from './known-issues';
import { partOf, selectedParts } from './parts';
import { outputFolder } from './site';

interface Note {
  readonly type: string;
  readonly description?: string;
}

function notes(test: TestCase, run: TestResult): Note[] {
  const runtime = (run as { annotations?: Note[] }).annotations ?? [];
  const seen = new Set<string>();
  return [...test.annotations, ...runtime].filter((note) => {
    const key = `${note.type}\n${note.description ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function projectOf(test: TestCase): string {
  return test.parent.project()?.name ?? '?';
}

/** The engine a test ran on (the Edge and Chrome channels are Chromium). */
function engineOfProject(test: TestCase): string {
  const use = test.parent.project()?.use;
  return use?.browserName ?? use?.defaultBrowserType ?? 'chromium';
}

class QaSummary implements Reporter {
  private config: FullConfig | undefined;
  private readonly results: { test: TestCase; run: TestResult }[] = [];

  onBegin(config: FullConfig, _suite: Suite): void {
    this.config = config;
  }

  onTestEnd(test: TestCase, run: TestResult): void {
    this.results.push({ test, run });
  }

  /** Problems that make the run fail: specs that never ran, skips without a reason. */
  private audit(config: FullConfig, projects: readonly string[]): string[] {
    const problems: string[] = [];
    const testDir = config.projects[0]?.testDir ?? config.rootDir;
    const parts = selectedParts();
    const specs = readdirSync(testDir)
      .filter((name) => name.endsWith('.spec.ts'))
      .map((name) => join(testDir, name))
      .filter((spec) => parts === undefined || parts.includes(partOf(spec)));
    for (const project of projects) {
      for (const spec of specs) {
        const ran = this.results.some(
          ({ test }) => test.location.file === spec && projectOf(test) === project,
        );
        const name = relative(testDir, spec).split(sep).join('/');
        if (!ran) problems.push(`${name} never ran in ${project}`);
      }
    }
    for (const { test, run } of this.results) {
      if (run.status !== 'skipped') continue;
      const reason = notes(test, run).find((note) => note.type === 'skip' && note.description);
      if (!reason) problems.push(`skipped without a reason: ${test.titlePath().join(' › ')}`);
    }
    if (this.results.length === 0) problems.push('no test ran');
    return problems;
  }

  async onEnd(result: FullResult): Promise<{ status?: FullResult['status'] } | void> {
    const config = this.config;
    if (!config) return;
    const projects = [...new Set(this.results.map(({ test }) => projectOf(test)))];
    const count = (...statuses: TestResult['status'][]): number =>
      this.results.filter(({ run }) => statuses.includes(run.status)).length;
    const problems = process.env['DV_E2E_AUDIT'] === '1' ? this.audit(config, projects) : [];

    const defects = new Map<string, Set<string>>();
    const fixed = new Map<string, Set<string>>();
    const advice = new Map<string, number>();
    const evidence: string[] = [];
    const met = new Set<string>();
    for (const { test, run } of this.results) {
      const project = projectOf(test);
      for (const note of notes(test, run)) {
        const description = note.description ?? '';
        if (
          note.type === 'known defect' ||
          note.type === 'defect fixed?' ||
          note.type === 'defect not seen this time'
        ) {
          const id = /^DV-QA-\d+/.exec(description)?.[0];
          if (id) met.add(id);
        }
        if (note.type === 'known defect') {
          const id = /^DV-QA-\d+/.exec(description)?.[0];
          const defect = id ? (DEFECTS as Record<string, Defect>)[id] : undefined;
          const head = defect
            ? `${id} (${defect.severity}, ${defect.owner}): ${defect.title}`
            : description;
          defects.set(head, (defects.get(head) ?? new Set()).add(project));
        } else if (note.type === 'defect fixed?') {
          fixed.set(description, (fixed.get(description) ?? new Set()).add(project));
        } else if (/^DV-QA-\d+ evidence$/.test(note.type)) {
          evidence.push(`- ${note.type} _(${project})_: \`${description.replace(/`/g, "'")}\``);
        } else if (note.type === 'axe advisory') {
          const rule = / ([a-z0-9-]+ \((?:minor|moderate|serious|critical|unknown)\)) at /.exec(
            description,
          )?.[1];
          advice.set(rule ?? 'other', (advice.get(rule ?? 'other') ?? 0) + 1);
        }
      }
    }

    const where = (set: Set<string>): string => ` _(${[...set].sort().join(', ')})_`;
    const parts = selectedParts();
    const lines = [
      `## Dragon Valley end-to-end: ${projects.join(', ') || 'no project'}${parts ? ` (part: ${parts.join(', ')})` : ''}`,
      '',
      `**${result.status}**: ${count('passed')} passed, ${count('failed', 'timedOut', 'interrupted')} failed, ${count('skipped')} skipped in ${Math.round(result.duration / 1000)} s.`,
      '',
    ];
    if (problems.length) {
      lines.push('### Audit problems (the run fails)', '', ...problems.map((p) => `- ${p}`), '');
    }
    lines.push('### Known defects that still reproduce', '');
    if (defects.size === 0) lines.push('None.');
    for (const [head, set] of [...defects].sort()) lines.push(`- ${head}${where(set)}`);
    if (evidence.length) {
      lines.push('', '### Evidence the tests recorded for defects', '', ...evidence.sort());
    }
    lines.push('', '### Defect markers that did not reproduce (fixed?)', '');
    if (fixed.size === 0) lines.push('None.');
    for (const [description, set] of [...fixed].sort()) lines.push(`- ${description}${where(set)}`);
    if (!parts) {
      // A layout or axe allowance says nothing when its problem is gone: list what no test met.
      const engines = new Set(this.results.map(({ test }) => engineOfProject(test)));
      const unmet = Object.entries(DEFECTS as Record<string, Defect>).filter(
        ([id, defect]) =>
          !met.has(id) && (!defect.engines || defect.engines.some((engine) => engines.has(engine))),
      );
      lines.push('', '### Registered defects no test met in this run (fixed?)', '');
      if (unmet.length === 0) lines.push('None.');
      for (const [id, defect] of unmet) lines.push(`- ${id} (${defect.owner}): ${defect.title}`);
    }
    // A test that used more than half its time budget would time out on a runner half as fast:
    // raise its budget before it fails for no reason (docs/testing.md §5).
    const thin = this.results
      .filter(({ test, run }) => test.timeout > 0 && run.duration > test.timeout / 2)
      .sort((a, b) => b.run.duration / b.test.timeout - a.run.duration / a.test.timeout);
    lines.push('', '### Tests that used more than half their time budget', '');
    if (thin.length === 0) lines.push('None.');
    for (const { test, run } of thin) {
      const seconds = (ms: number): string => `${Math.round(ms / 1000)} s`;
      const used = Math.round((100 * run.duration) / test.timeout);
      lines.push(
        `- ${test.titlePath().slice(2).join(' › ')}: ${seconds(run.duration)} of ${seconds(test.timeout)} (${used} %) _(${projectOf(test)})_`,
      );
    }
    lines.push('', '### Accessibility advice (moderate and minor axe findings, by rule)', '');
    if (advice.size === 0) lines.push('None.');
    for (const [rule, total] of [...advice].sort()) lines.push(`- ${rule}: ${total}`);
    const markdown = lines.join('\n') + '\n';

    const root = config.configFile ? dirname(config.configFile) : process.cwd();
    const output = join(root, outputFolder(), 'qa-summary.md');
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, markdown);
    const summary = process.env['GITHUB_STEP_SUMMARY'];
    if (summary) appendFileSync(summary, markdown);
    if (problems.length) {
      process.stderr.write(`QA audit failed:\n${problems.map((p) => `  ${p}`).join('\n')}\n`);
      return { status: 'failed' };
    }
  }

  printsToStdio(): boolean {
    return false;
  }
}

export default QaSummary;
