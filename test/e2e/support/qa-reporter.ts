/**
 * A Playwright reporter that turns one run into evidence a person can read without opening the
 * HTML report: totals, the known defects that still reproduce (or no longer do), and the
 * accessibility advice axe gave (moderate and minor findings, by rule). It writes
 * `test-results/qa-summary.md` and, on GitHub Actions, the job summary.
 *
 * With `DV_E2E_AUDIT=1` (CI) it also audits the run, as scripts/verify.mjs does for Vitest:
 * every spec file on disk (of the selected part, test/e2e/support/parts.ts) must have run in
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
import { partOf, selectedPart } from './parts';

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
    const part = selectedPart();
    const specs = readdirSync(testDir)
      .filter((name) => name.endsWith('.spec.ts'))
      .map((name) => join(testDir, name))
      .filter((spec) => part === undefined || partOf(spec) === part);
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
    for (const { test, run } of this.results) {
      const project = projectOf(test);
      for (const note of notes(test, run)) {
        const description = note.description ?? '';
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
    const part = selectedPart();
    const lines = [
      `## Dragon Valley end-to-end: ${projects.join(', ') || 'no project'}${part ? ` (part: ${part})` : ''}`,
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
    lines.push('', '### Accessibility advice (moderate and minor axe findings, by rule)', '');
    if (advice.size === 0) lines.push('None.');
    for (const [rule, total] of [...advice].sort()) lines.push(`- ${rule}: ${total}`);
    const markdown = lines.join('\n') + '\n';

    const root = config.configFile ? dirname(config.configFile) : process.cwd();
    const output = join(root, 'test-results', 'qa-summary.md');
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
