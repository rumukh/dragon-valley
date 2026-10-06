/**
 * Shared harness for command traces: a `Player` drives a runtime host one traced step at a time
 * (`runCommandTrace`), records every event and commit hash, answers problems with an oracle that
 * is independent of the rules (it computes products and quotients itself and never calls the
 * contract's `expectedAnswer`), and plays minigame boards from the typed board view only, the way
 * a child sees them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashString } from '@aegis/core';
import { createRuntimeHost, parseContentJson, requireValue, runCommandTrace } from '@aegis/runtime';
import type { ContentPack, RuntimeAdapter, RuntimeHost } from '@aegis/runtime';
import { dragonValleyAdapter } from '../../src/rules/adapter';
import { contentRegistration } from '../../src/rules/contract';
import type {
  AnswerValue,
  CardFace,
  ContentData,
  Expr,
  ExprPath,
  GameAction,
  GameView,
  MinigameMove,
  MinigameRoundView,
  Problem,
  ProblemRoundView,
  ProfileState,
} from '../../src/rules/contract';

export type Adapter = RuntimeAdapter<ProfileState, GameAction, GameView, ContentData>;
export type Host = RuntimeHost<ProfileState, GameAction, GameView, ContentData>;

export const root = join(import.meta.dirname, '..', '..');

export function loadPack(
  relative = 'content/dragon-valley.content.json',
): ContentPack<ContentData> {
  return requireValue(
    parseContentJson(readFileSync(join(root, relative), 'utf8'), contentRegistration, relative),
  );
}

/** The value of a blank-free expression, computed by the test itself. */
export function evaluate(expr: Expr): number {
  switch (expr.kind) {
    case 'num':
      return expr.value;
    case 'group':
      return evaluate(expr.inner);
    case 'op': {
      const [a, b] = [evaluate(expr.left), evaluate(expr.right)];
      if (expr.op === 'add') return a + b;
      if (expr.op === 'sub') return a - b;
      if (expr.op === 'mul') return a * b;
      return a / b;
    }
    case 'blank':
      throw new Error('a blank has no value');
  }
}

/** Solve `side = target` for the blank on one side (a · ? = p, ? : k = q, …). */
function solve(side: Expr, target: number): number {
  if (side.kind === 'blank') return target;
  if (side.kind === 'group') return solve(side.inner, target);
  if (side.kind !== 'op') throw new Error('no blank here');
  const leftBlank = JSON.stringify(side.left).includes('"blank"');
  const known = evaluate(leftBlank ? side.right : side.left);
  const unknown = leftBlank ? side.left : side.right;
  if (side.op === 'add') return solve(unknown, target - known);
  if (side.op === 'mul') return solve(unknown, target / known);
  if (side.op === 'sub') return solve(unknown, leftBlank ? target + known : known - target);
  return solve(unknown, leftBlank ? target * known : known / target);
}

/** The oracle: the right answer to a problem at its current step. */
export function oracle(problem: Problem, step: 'operation' | 'answer'): AnswerValue {
  if (problem.kind === 'word') {
    if (step === 'operation' && problem.operation) {
      return { kind: 'operation', operation: problem.operation };
    }
    return oracle(problem.model, 'answer');
  }
  if (problem.kind === 'equation') {
    const leftBlank = JSON.stringify(problem.left).includes('"blank"');
    const value = leftBlank
      ? solve(problem.left, evaluate(problem.right))
      : solve(problem.right, evaluate(problem.left));
    return { kind: 'number', value };
  }
  if (problem.kind === 'divrem') {
    const remainder = problem.dividend % problem.divisor;
    return {
      kind: 'remainder',
      quotient: (problem.dividend - remainder) / problem.divisor,
      remainder,
    };
  }
  if (problem.kind === 'compare') {
    const [a, b] = [evaluate(problem.left), evaluate(problem.right)];
    return { kind: 'relation', relation: a < b ? 'lt' : a > b ? 'gt' : 'eq' };
  }
  if (problem.kind === 'term') {
    const { sentence, highlight } = problem;
    const named =
      highlight === 'remainder'
        ? 'remainder'
        : sentence.op === 'mul'
          ? highlight === 'result'
            ? 'product'
            : 'factor'
          : ({ left: 'dividend', right: 'divisor', result: 'quotient' } as const)[highlight];
    return { kind: 'term', term: named };
  }
  throw new Error(`no oracle for ${(problem as Problem).kind}`);
}

/** A wrong answer a child could give: another offered choice, or one more. */
export function wrongAnswer(view: ProblemRoundView): AnswerValue {
  const problem = view.problem!;
  const right = oracle(problem.problem, problem.step);
  // The operation step always offers the four operations, whatever the input mode.
  if (right.kind === 'operation') {
    return { kind: 'operation', operation: right.operation === 'add' ? 'sub' : 'add' };
  }
  const other = problem.choices?.find((choice) => JSON.stringify(choice) !== JSON.stringify(right));
  if (other) return other;
  if (right.kind === 'number') return { kind: 'number', value: right.value + 1 };
  throw new Error('no wrong answer');
}

/**
 * What makes two Memory Match cards a pair, worked out from their faces: a value (`7 · 8` and
 * `56`; `23 : 5` and `4 r 3`), a fact family (`6 · 7 = 42` and `42 : 7 = 6`) or a term (`product`
 * and a sentence with its product highlighted).
 */
export function pairKey(face: CardFace): string {
  if (face.kind === 'answer') {
    const answer = face.answer;
    if (answer.kind === 'number') return `${answer.value}`;
    if (answer.kind === 'remainder') return `${answer.quotient}r${answer.remainder}`;
    if (answer.kind === 'term') return `term:${answer.term}`;
    throw new Error(`no pair for an answer of kind ${answer.kind}`);
  }
  if (face.kind === 'expr') {
    const expr = face.expr;
    if (expr.kind === 'op' && expr.op === 'div') {
      const [a, b] = [evaluate(expr.left), evaluate(expr.right)];
      const left = a % b;
      return left === 0 ? `${a / b}` : `${(a - left) / b}r${left}`;
    }
    return `${evaluate(expr)}`;
  }
  const { sentence, highlight } = face;
  if (highlight === null)
    return `family:${sentence.op === 'mul' ? sentence.result : sentence.left}`;
  if (highlight === 'remainder') return 'term:remainder';
  if (sentence.op === 'mul') return highlight === 'result' ? 'term:product' : 'term:factor';
  return `term:${{ left: 'dividend', right: 'divisor', result: 'quotient' }[highlight]}`;
}

/** The operation a child does first: inside brackets, then · and :, then + and −, leftmost. */
export function firstOperation(expr: Expr): ExprPath {
  const plain = (node: Expr): boolean =>
    node.kind === 'num' || (node.kind === 'group' && plain(node.inner));
  const found: { path: ExprPath; rank: number }[] = [];
  const visit = (node: Expr, path: ExprPath, inside: boolean): void => {
    if (node.kind === 'group') return visit(node.inner, [...path, 'inner'], true);
    if (node.kind !== 'op') return;
    visit(node.left, [...path, 'left'], inside);
    if (plain(node.left) && plain(node.right)) {
      found.push({
        path,
        rank: (inside ? 0 : 2) + (node.op === 'mul' || node.op === 'div' ? 0 : 1),
      });
    }
    visit(node.right, [...path, 'right'], inside);
  };
  visit(expr, [], false);
  const best = Math.min(...found.map((f) => f.rank));
  return found.find((f) => f.rank === best)!.path;
}

function at(expr: Expr, path: ExprPath): Expr {
  return path.reduce<Expr>((node, step) => {
    if (step === 'inner' && node.kind === 'group') return node.inner;
    if (step !== 'inner' && node.kind === 'op') return node[step];
    throw new Error('no such node');
  }, expr);
}

export interface Recorded {
  turn: number;
  revision: number;
  type: string;
  data: unknown;
}

/** How a scripted child plays: which answers are wrong, how fast, how boards are played. */
export interface Style {
  /** Whether the answer to the n-th problem (1-based, over the whole trace) is right. */
  right(n: number, view: ProblemRoundView): boolean;
  elapsedMs(n: number, view: ProblemRoundView): number;
  /** Make one avoidable mistake on each board before solving it. */
  clumsy: boolean;
}

export const PERFECT: Style = { right: () => true, elapsedMs: () => 1500, clumsy: false };

export class Player {
  readonly host: Host;
  readonly events: Recorded[] = [];
  readonly hashes: string[] = [];
  readonly failures: string[] = [];
  /** Problems answered so far (the n of `Style.right`). */
  answered = 0;
  turn = 0;
  private current: GameView;

  constructor(
    readonly style: Style = PERFECT,
    seed = 'trace',
    adapter: Adapter = dragonValleyAdapter,
    pack: ContentPack<ContentData> = loadPack(),
  ) {
    this.host = createRuntimeHost({ adapter, content: pack, seed });
    this.current = this.host.getView();
    this.host.subscribeCommits((commit) => {
      this.hashes.push(commit.hash);
      this.current = commit.view;
      for (const event of commit.events) {
        this.events.push({
          turn: commit.turn,
          revision: commit.revision,
          type: event.type,
          data: event.data,
        });
      }
    });
    this.host.subscribe((view, reason) => {
      if (reason === 'restore') this.current = view;
    });
  }

  /** The latest committed view (read-only by convention: do not mutate it). */
  view(): GameView {
    return this.current;
  }

  state(): ProfileState {
    return this.host.inspect().state as ProfileState;
  }

  /** One traced step; a rejection is recorded as a failure (and returns false). */
  async act(action: GameAction): Promise<boolean> {
    await this.breathe();
    const turns = action.type === 'answer' || action.type === 'placementAnswer' ? 1 : 0;
    const trace = await runCommandTrace(this.host, [
      { action, ruleIds: [action.type], expectedTurn: this.turn + turns },
    ]);
    if (trace.failure) {
      this.failures.push(`${action.type}: ${trace.failure.error.code}`);
      return false;
    }
    this.turn += turns;
    return true;
  }

  private steps = 0;

  /**
   * Every few steps, let the test runner's own messages through: a long trace otherwise keeps the
   * worker busy in microtasks for minutes (each commit takes tens of milliseconds with the whole
   * v1 pack), and the runner's RPC to the worker times out. Scheduling only; no game effect.
   */
  private async breathe(): Promise<void> {
    if (++this.steps % 10 === 0) await new Promise((resolve) => setImmediate(resolve));
  }

  /** A step that must be rejected with `code` (and change nothing). */
  async reject(action: GameAction, code: string): Promise<boolean> {
    const trace = await runCommandTrace(this.host, [
      { action, ruleIds: [action.type], expectError: code, expectedTurn: this.turn },
    ]);
    if (trace.failure) this.failures.push(`${action.type} (expected ${code})`);
    return trace.failure === null;
  }

  async choose(choice: string | null): Promise<boolean> {
    const story = this.view().story;
    if (story === null) return false;
    return this.act({
      type: 'storyChoice',
      beat: story.beat,
      node: story.node,
      revision: story.revision,
      choice,
    });
  }

  /** Skip or click through every pending skippable beat. */
  async settleStory(): Promise<void> {
    for (let guard = 0; guard < 20 && this.view().story !== null; guard++) {
      const story = this.view().story!;
      if (story.skippable) await this.choose(null);
      else break;
    }
  }

  /** Answer the problem on screen per the style. */
  async answer(): Promise<boolean> {
    const round = this.view().round;
    if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) return false;
    this.answered += 1;
    const right = this.style.right(this.answered, round);
    const value = right ? oracle(round.problem.problem, round.problem.step) : wrongAnswer(round);
    const type = round.activity === 'placement' ? 'placementAnswer' : 'answer';
    return this.act({ type, value, elapsedMs: this.style.elapsedMs(this.answered, round) });
  }

  async move(move: MinigameMove): Promise<boolean> {
    const round = this.view().round as MinigameRoundView;
    return this.act({ type: 'minigameMove', revision: round.minigame.revision, move });
  }

  /** Play the current board to completion from the typed view. */
  async playBoard(): Promise<void> {
    const round = this.view().round;
    if (round?.type !== 'minigame' || round.status !== 'active') return;
    const board = round.current;
    const start = round.board;
    const still = () => {
      const now = this.view().round;
      return now?.type === 'minigame' && now.status === 'active' && now.board === start;
    };
    if (board.kind === 'egg-grid') {
      if (this.style.clumsy) {
        await this.move({ type: 'set', rows: 1, columns: 1 });
        await this.move({ type: 'submit' });
      }
      for (let rows = 1; rows <= board.maxSide && still(); rows++) {
        if (board.product % rows !== 0 || board.product / rows > board.maxSide) continue;
        await this.move({ type: 'set', rows, columns: board.product / rows });
        await this.move({ type: 'submit' });
      }
    } else if (board.kind === 'fact-family') {
      const [x, y, product] = board.numbers as [number, number, number];
      const sentences = [
        [x, y, product],
        [y, x, product],
        [product, x, y],
        [product, y, x],
      ];
      if (this.style.clumsy) {
        await this.move({ type: 'fill', equation: 0, slot: 0, value: product });
        await this.move({ type: 'submit' });
      }
      for (const [equation, slots] of sentences.entries()) {
        for (const [slot, value] of slots.entries()) {
          await this.move({ type: 'fill', equation, slot, value: value! });
        }
      }
      await this.move({ type: 'submit' });
    } else if (board.kind === 'number-trail') {
      if (this.style.clumsy) await this.move({ type: 'submit' });
      const sorted = [...board.stones].sort((a, b) => a.value - b.value);
      for (const [index, stone] of sorted.entries()) {
        await this.move({ type: 'place', item: stone.id, index });
      }
      await this.move({ type: 'submit' });
    } else if (board.kind === 'memory-match') {
      const seen = new Map<string, string>();
      const keyOf = (id: string) => {
        const view = this.view().round as MinigameRoundView;
        if (view.current.kind !== 'memory-match') return '';
        const face = view.current.cards.find((c) => c.id === id)?.face;
        return face ? pairKey(face) : '';
      };
      for (let guard = 0; guard < 200 && still(); guard++) {
        const view = (this.view().round as MinigameRoundView).current;
        if (view.kind !== 'memory-match') break;
        if (view.clearAvailable) {
          await this.move({ type: 'clear' });
          continue;
        }
        const hidden = view.cards.filter((c) => !c.matched && !c.faceUp).map((c) => c.id);
        const first = hidden[0]!;
        await this.move({ type: 'select', card: first });
        seen.set(first, keyOf(first));
        const want = seen.get(first)!;
        const partner = [...seen.entries()].find(
          ([id, key]) => id !== first && hidden.includes(id) && key === want,
        )?.[0];
        const clumsy = this.style.clumsy && guard === 0;
        const second =
          partner !== undefined && !clumsy
            ? partner
            : hidden.find((id) => id !== first && !seen.has(id))!;
        await this.move({ type: 'select', card: second });
        seen.set(second, keyOf(second));
      }
    } else if (board.kind === 'sharing-feast') {
      const left = board.total % board.baskets;
      const each = (board.total - left) / board.baskets;
      if (this.style.clumsy) await this.move({ type: 'submit', each: each + 1, left });
      for (let basket = 0; basket < board.baskets && each > 0; basket++) {
        await this.move({ type: 'put', basket, count: each });
      }
      await this.move({ type: 'submit', each, left });
    } else if (board.kind === 'golem-orders') {
      for (let guard = 0; guard < 32 && still(); guard++) {
        const now = (this.view().round as MinigameRoundView).current;
        if (now.kind !== 'golem-orders') break;
        const path = firstOperation(now.expr);
        const value = evaluate(at(now.expr, path));
        await this.move({ type: 'pick', path });
        if (this.style.clumsy && guard === 0) await this.move({ type: 'answer', value: value + 1 });
        await this.move({ type: 'answer', value });
      }
    }
  }

  /** Play the active round (problems or boards) to its end. */
  async playRound(limit = 200): Promise<void> {
    for (let guard = 0; guard < limit; guard++) {
      const round = this.view().round;
      if (round === null || round.status !== 'active') return;
      if (round.type === 'problems') {
        if (!(await this.answer())) return;
      } else {
        const before = this.hashes.length;
        await this.playBoard();
        if (this.hashes.length === before) return;
      }
    }
  }

  /** Play every activity of a level from its start, closing each finished round. */
  async playLevel(level: string): Promise<void> {
    if (!(await this.act({ type: 'startLevel', level }))) return;
    await this.settleStory();
    for (let guard = 0; guard < 10; guard++) {
      await this.playRound();
      const round = this.view().round;
      if (round === null) return;
      await this.act({ type: 'endRound', reason: 'done' });
      const run = this.view().run;
      if (run === null || run.result !== null) {
        await this.settleStory();
        return;
      }
      await this.act({ type: 'startActivity', activity: { kind: 'level', index: run.next } });
    }
  }

  count(type: string): number {
    return this.events.filter((event) => event.type === type).length;
  }

  data(type: string): unknown[] {
    return this.events.filter((event) => event.type === type).map((event) => event.data);
  }

  async dispose(): Promise<void> {
    await this.host.dispose();
  }
}

export function trajectoryDigest(hashes: readonly string[]): string {
  return hashString(hashes.join('|'));
}
