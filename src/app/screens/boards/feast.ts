/**
 * Sharing Feast (docs/design.md §5.6): share the bowl's fruit fairly between the baskets, then
 * write the division it shows, `12 : 3 = 4` or `13 : 3 = 4 r 1` ("4 in each, 1 left over").
 *
 * A tap on a basket gives it one fruit, its minus button takes one back, "One for each basket"
 * gives every basket one, and on a big feast a bag of ten goes in at once (bags of ten are drawn
 * as bags, so 48 fruit are 4 bags and 8 fruit). The rules check the answer: baskets that are not
 * fair yet, a bowl that could still go round, or numbers that do not match the baskets are said
 * kindly, and the fruit stays where the child put it.
 */
import { BLANK, num, op, REMAINDER_SYMBOLS } from '../../../rules/contract';
import type { Problem, SharingFeastBoard } from '../../../rules/contract';
import type { MessageKey } from '../../i18n/messages';
import { speakProblem } from '../../speech/verbalizer';
import { candyButton } from '../../ui/button';
import { h } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { createKeypad } from '../../ui/keypad';
import type { KeypadView } from '../../ui/keypad';
import { problemElement } from '../problem-view';
import type { BoardContext, BoardPainter } from './board';

/** From this many fruit on, a feast is drawn and shared in bags of ten. */
export const TENS_FROM = 20;

export interface FruitPile {
  readonly tens: number;
  readonly ones: number;
}

/** How `count` fruit of a feast of `total` are drawn: loose, or bags of ten and loose fruit. */
export function fruitPile(count: number, total: number): FruitPile {
  if (total < TENS_FROM) return { tens: 0, ones: count };
  return { tens: Math.floor(count / 10), ones: count % 10 };
}

/** The division a feast is about: `12 : 3 = ?`, or `13 : 3 = ? r ?` when leftovers are expected. */
export function feastProblem(
  board: Pick<SharingFeastBoard, 'total' | 'baskets' | 'remainder'>,
): Problem {
  return board.remainder
    ? { kind: 'divrem', dividend: board.total, divisor: board.baskets }
    : { kind: 'equation', left: op('div', num(board.total), num(board.baskets)), right: BLANK };
}

/** What the status line says about the last check (null: how to play). */
export function feastMessage(board: Pick<SharingFeastBoard, 'last' | 'remainder'>): MessageKey {
  switch (board.last) {
    case 'uneven':
      return 'feast.uneven';
    case 'more':
      return 'feast.more';
    case 'count':
      return board.remainder ? 'feast.countLeft' : 'feast.count';
    case null:
      return 'feast.how';
  }
}

function pile(target: HTMLElement, count: number, total: number): void {
  const { tens, ones } = fruitPile(count, total);
  const parts: HTMLElement[] = [];
  for (let bag = 0; bag < tens; bag++) {
    parts.push(h('span', { className: 'dv-feast__ten', text: '10' }));
  }
  for (let fruit = 0; fruit < ones; fruit++)
    parts.push(h('span', { className: 'dv-feast__fruit' }));
  target.replaceChildren(...parts);
}

interface Basket {
  readonly element: HTMLElement;
  readonly put: HTMLButtonElement;
  readonly pile: HTMLElement;
  readonly count: HTMLElement;
  readonly take: HTMLButtonElement;
  readonly ten: HTMLButtonElement | null;
}

export function sharingFeast(context: BoardContext): BoardPainter {
  const { app } = context;
  const t = app.kit.t;
  const onError = app.kit.onError;

  const goal = h('p', { className: 'dv-nest__goal', testId: 'feast-goal' });
  const question = h('p', { className: 'dv-feast__question', testId: 'feast-question' });
  const sentence = h('div', { className: 'dv-feast__sentence' });
  const answer = h('div', { className: 'dv-feast__answer' });
  const bowlLabel = h('span', { className: 'dv-feast__bowl-label', testId: 'feast-bowl-count' });
  const bowlPile = h('span', {
    className: 'dv-feast__pile',
    attributes: { 'aria-hidden': 'true' },
  });
  const bowl = h('div', { className: 'dv-feast__bowl', testId: 'feast-bowl' }, bowlPile, bowlLabel);
  const list = h('ul', {
    className: 'dv-feast__baskets',
    testId: 'feast-baskets',
    attributes: { 'aria-label': t('feast.baskets') },
  });
  const deal = candyButton({
    label: t('feast.deal'),
    icon: 'forward',
    variant: 'sun',
    testId: 'feast-deal',
    onPress: async () => {
      await context.move({ type: 'deal' });
    },
    onError,
  });

  let shown = -1;
  let baskets: Basket[] = [];
  let keypad: KeypadView | null = null;

  const basket = (index: number, tens: boolean): Basket => {
    const pileElement = h('span', {
      className: 'dv-feast__pile',
      attributes: { 'aria-hidden': 'true' },
    });
    const count = h('span', {
      className: 'dv-feast__count',
      attributes: { 'aria-hidden': 'true' },
    });
    const put = h(
      'button',
      {
        className: 'dv-feast__basket',
        testId: `feast-basket-${index}`,
        attributes: { type: 'button' },
      },
      pileElement,
      count,
    );
    put.addEventListener('click', () => {
      app.kit.cue('ui.tap');
      void context.move({ type: 'put', basket: index }).catch(onError);
    });
    const tool = (testId: string, label: string, content: Node): HTMLButtonElement => {
      const button = h(
        'button',
        {
          className: 'dv-button dv-button--paper dv-button--small dv-feast__tool',
          testId,
          attributes: { type: 'button', 'aria-label': label },
        },
        content,
      );
      return button;
    };
    const take = tool(`feast-take-${index}`, t('feast.take', { number: index + 1 }), icon('minus'));
    take.addEventListener('click', () => {
      app.kit.cue('ui.tap');
      void context.move({ type: 'take', basket: index }).catch(onError);
    });
    let ten: HTMLButtonElement | null = null;
    if (tens) {
      ten = tool(
        `feast-ten-${index}`,
        t('feast.putTen', { number: index + 1 }),
        h('span', { text: t('feast.ten'), attributes: { 'aria-hidden': 'true' } }),
      );
      ten.addEventListener('click', () => {
        app.kit.cue('ui.tap');
        void context.move({ type: 'put', basket: index, count: 10 }).catch(onError);
      });
    }
    const element = h(
      'li',
      { className: 'dv-feast__slot' },
      put,
      h('div', { className: 'dv-feast__tools' }, take, ten),
    );
    return { element, put, pile: pileElement, count, take, ten };
  };

  /** A new board: its baskets, its division and a keypad for its kind of answer. */
  const build = (board: SharingFeastBoard): void => {
    const tens = board.total >= TENS_FROM;
    baskets = Array.from({ length: board.baskets }, (_, index) => basket(index, tens));
    list.replaceChildren(...baskets.map((b) => b.element));
    list.dataset['count'] = String(board.baskets);
    goal.textContent = t('feast.goal', { total: board.total, baskets: board.baskets });
    question.textContent = t(board.remainder ? 'feast.askLeft' : 'feast.ask');
    const problem = feastProblem(board);
    sentence.replaceChildren(problemElement(problem, context.notation(), speakProblem(problem)));
    keypad?.dispose();
    keypad = createKeypad(app.kit, {
      mode: board.remainder ? 'remainder' : 'number',
      maxDigits: String(board.total).length,
      remainderSymbol: REMAINDER_SYMBOLS[context.notation()],
      claimFocus: true,
      testIdPrefix: 'feast-keypad',
      onSubmit: async (typed) => {
        const each = typed.kind === 'remainder' ? typed.quotient : typed.value;
        const left = typed.kind === 'remainder' ? typed.remainder : 0;
        // More than the whole feast cannot be right: say so instead of sending it.
        if (each > board.total || left > board.total) {
          context.status(t('feast.tooMany', { total: board.total }));
          return;
        }
        await context.move({ type: 'submit', each, left });
      },
    });
    answer.replaceChildren(keypad.element);
  };

  const paint = (): void => {
    const board = context.board('sharing-feast');
    if (!board) return;
    if (context.index() !== shown || baskets.length !== board.baskets) {
      shown = context.index();
      build(board);
    }
    context.status(t(feastMessage(board)));
    bowlLabel.textContent = t('feast.bowl', { count: board.bowl });
    pile(bowlPile, board.bowl, board.total);
    baskets.forEach((item, index) => {
      const count = board.inBaskets[index] ?? 0;
      pile(item.pile, count, board.total);
      item.count.textContent = String(count);
      item.put.dataset['count'] = String(count);
      item.put.setAttribute('aria-label', t('feast.put', { number: index + 1, count }));
      item.put.disabled = board.bowl === 0;
      item.take.disabled = count === 0;
      if (item.ten) item.ten.disabled = board.bowl < 10;
      // A button that just became disabled cannot keep focus: the basket itself takes it.
      for (const tool of [item.take, item.ten]) {
        if (tool?.disabled && document.activeElement === tool) item.put.focus();
      }
    });
    deal.disabled = board.bowl < board.baskets;
  };

  return {
    element: h(
      'div',
      { className: 'dv-minigame__board dv-split-board dv-feast', testId: 'feast' },
      h('div', { className: 'dv-split-board__field dv-feast__field' }, bowl, list, deal),
      h(
        'div',
        { className: 'dv-split-board__panel dv-feast__panel' },
        goal,
        question,
        sentence,
        answer,
      ),
    ),
    paint,
    focus: () => baskets.find((b) => !b.put.disabled)?.put ?? deal,
    dispose() {
      keypad?.dispose();
      keypad = null;
    },
  };
}
