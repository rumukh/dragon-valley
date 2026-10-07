/**
 * Golem Orders (docs/design.md §5.9): the Golem only moves when told what to do first. The
 * expression stands as a row of numbers and gears; the child taps the gear (the sign) of the
 * operation that goes first - brackets, then · and :, then + and −, left to right - types its
 * result, and the expression shrinks until one number is left. The steps so far are written out
 * the way school writes them, `8 + 2 · 3 = 8 + 6 = 14`. A sign that is not first yet or a wrong
 * result is said kindly, and nothing is lost.
 */
import { formatExpr, OPERATOR_SYMBOLS } from '../../../rules/contract';
import type { ExprPath, GolemOrdersBoard } from '../../../rules/contract';
import type { BossState } from '../../art/characters/bosses';
import type { MessageKey } from '../../i18n/messages';
import { exprAt, isWithin, pathTokens, samePath } from '../../math/notation';
import { speakExpr } from '../../speech/verbalizer';
import { bossArt } from '../../ui/art';
import { h } from '../../ui/dom';
import { createKeypad } from '../../ui/keypad';
import type { BoardContext, BoardPainter } from './board';

/** The Golem of Riddle Ruins, who waits for his orders beside the board. */
export const GOLEM_BOSS = 'golem';

/** What the status line says: how to play, a kind correction, or what to work out next. */
export function golemMessage(board: Pick<GolemOrdersBoard, 'last' | 'picked'>): MessageKey {
  switch (board.last) {
    case 'not-first':
      return 'golem.notFirst';
    case 'wrong-value':
      return 'golem.wrong';
    case 'right':
      return board.picked === null ? 'golem.right' : 'golem.value';
    case null:
      return board.picked === null ? 'golem.how' : 'golem.value';
  }
}

/** A stable test id for the gear of the operation at `path`. */
export function gearId(path: ExprPath): string {
  return `golem-sign-${path.length === 0 ? 'root' : path.join('-')}`;
}

/** A chain of equal expressions, `8 + 2 · 3 = 8 + 6 = 14`, wrapping only at its equals signs. */
export function chainText(steps: readonly string[]): string {
  return steps.map((step) => step.replace(/ /g, '\u00a0')).join(' = ');
}

export function golemOrders(context: BoardContext): BoardPainter {
  const { app } = context;
  const t = app.kit.t;
  const onError = app.kit.onError;

  const goal = h('p', { className: 'dv-nest__goal', testId: 'golem-goal', text: t('golem.goal') });
  const figure = h('div', { className: 'dv-golem__figure', attributes: { 'aria-hidden': 'true' } });
  const orders = h('div', {
    className: 'dv-golem__orders',
    testId: 'golem-orders',
    attributes: { role: 'group' },
  });
  const trail = h('p', { className: 'dv-golem__trail', testId: 'golem-trail' });
  const solved = h('p', { className: 'dv-golem__solved', testId: 'golem-solved' });
  const ask = h('p', { className: 'dv-golem__ask', testId: 'golem-ask' });

  let shown = -1;
  let steps: string[] = [];
  let pose: BossState | null = null;
  /** The value last sent: the last step of a board the next board replaced. */
  let sent: number | null = null;

  const keypad = createKeypad(app.kit, {
    mode: 'number',
    maxDigits: 5,
    claimFocus: true,
    layout: 'wide',
    testIdPrefix: 'golem-keypad',
    onSubmit: async (typed) => {
      if (typed.kind !== 'number') return;
      sent = typed.value;
      keypad.reset();
      await context.move({ type: 'answer', value: typed.value });
    },
  });

  const paint = (): void => {
    const board = context.board('golem-orders');
    if (!board) return;
    const notation = context.notation();
    const current = formatExpr(board.expr, notation);
    if (context.index() !== shown) {
      // A new board. The one before it ended with the value just sent: show its whole chain.
      if (shown !== -1 && sent !== null && steps.length > 0) {
        solved.textContent = t('golem.solved', { chain: chainText([...steps, String(sent)]) });
      }
      shown = context.index();
      steps = [formatExpr(board.start, notation)];
      keypad.reset();
    }
    if (steps[steps.length - 1] !== current) steps.push(current);
    trail.textContent = steps.length > 1 ? chainText(steps) : '';
    trail.hidden = steps.length < 2;
    solved.hidden = solved.textContent === '';

    const nextPose: BossState = board.steps === 0 ? 'start' : 'warming';
    if (nextPose !== pose) {
      pose = nextPose;
      figure.replaceChildren(bossArt(GOLEM_BOSS, pose, 'dv-golem__art', false));
    }

    const picked = board.picked;
    const node = picked === null ? null : exprAt(board.expr, picked);
    const symbols = OPERATOR_SYMBOLS[notation];
    context.status(
      t(golemMessage(board), {
        expr: node ? formatExpr(node, notation) : '',
        mul: symbols.mul,
        div: symbols.div,
        plus: symbols.add,
        minus: symbols.sub,
      }),
    );
    ask.textContent = node ? `${formatExpr(node, notation)} = ?` : t('golem.pickFirst');
    ask.dataset['picked'] = String(node !== null);
    keypad.setDisabled(node === null);

    // Redraw the gears, keeping focus on the same gear (or the first one) for the keyboard.
    const focused = document.activeElement;
    const focusedId =
      focused instanceof HTMLElement && orders.contains(focused) ? focused.dataset['testid'] : null;
    orders.setAttribute('aria-label', t('golem.orders', { expr: speakExpr(board.expr) }));
    orders.replaceChildren(
      ...pathTokens(board.expr, notation).map((token) => {
        const inPick = picked !== null && isWithin(token.path, picked);
        if (token.kind !== 'sign') {
          return h('span', {
            className: `dv-golem__${token.kind}`,
            dataset: { picked: String(inPick) },
            text: token.text,
            attributes: { 'aria-hidden': 'true' },
          });
        }
        const operation = exprAt(board.expr, token.path);
        const chosen = picked !== null && samePath(token.path, picked);
        const gear = h(
          'button',
          {
            className: 'dv-gear',
            testId: gearId(token.path),
            dataset: { picked: String(chosen) },
            attributes: {
              type: 'button',
              'aria-pressed': String(chosen),
              'aria-label': t('golem.sign', {
                expr: operation ? speakExpr(operation) : token.text,
              }),
            },
          },
          h('span', { className: 'dv-gear__sign', text: token.text }),
        );
        gear.addEventListener('click', () => {
          app.kit.cue('ui.tap');
          void context.move({ type: 'pick', path: token.path }).catch(onError);
        });
        return gear;
      }),
    );
    if (focusedId !== null) {
      const again =
        orders.querySelector<HTMLElement>(`[data-testid="${focusedId}"]`) ??
        orders.querySelector<HTMLElement>('button');
      again?.focus();
    }
  };

  return {
    element: h(
      'div',
      { className: 'dv-minigame__board dv-split-board dv-golem', testId: 'golem' },
      h(
        'div',
        { className: 'dv-split-board__field dv-golem__field' },
        figure,
        orders,
        trail,
        solved,
      ),
      h('div', { className: 'dv-split-board__panel dv-golem__panel' }, goal, ask, keypad.element),
    ),
    paint,
    focus: () => orders.querySelector<HTMLElement>('button'),
    dispose() {
      keypad.dispose();
    },
  };
}
