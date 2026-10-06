/**
 * Scene pieces shared by the story, rounds and the map: S4's static SVG backgrounds (shown as
 * plain images, so they never run script or reach the network), the backdrop for a story scene,
 * and who appears in a story beat.
 */
import type { ContentData, DragonExpression, StoryBeat } from '../../rules/contract';
import type { BossState } from '../art/characters/bosses';
import { h } from '../ui/dom';

/** S4's background scenes (assets/backgrounds/<id>.svg, 1600 × 1000). */
export const BACKGROUND_IDS = [
  'valley-map',
  'castle-hall',
  'sunny-meadow',
  'whispering-woods',
  'fire-mountain',
  'crystal-caves',
  'sharing-lake',
  'leftover-lagoon',
  'giants-peaks',
  'riddle-ruins',
  'dragon-castle',
] as const;

/** Story scene names in the content pack that are not background ids themselves. */
const SCENE_BACKGROUNDS: Readonly<Record<string, string>> = {
  castle: 'castle-hall',
  valley: 'valley-map',
  meadow: 'sunny-meadow',
  bridge: 'sunny-meadow',
};

export function sceneBackground(scene: string): string {
  if ((BACKGROUND_IDS as readonly string[]).includes(scene)) return scene;
  return SCENE_BACKGROUNDS[scene] ?? 'valley-map';
}

export function backgroundUrl(id: string): string {
  return `assets/backgrounds/${id}.svg`;
}

/** A decorative full-bleed backdrop behind a screen's content. */
export function backdrop(id: string, className = 'dv-backdrop'): HTMLElement {
  const image = h('img', {
    className: `${className}__image`,
    attributes: { src: backgroundUrl(id), alt: '', decoding: 'async', draggable: 'false' },
  });
  return h(
    'div',
    { className, attributes: { 'aria-hidden': 'true' }, dataset: { background: id } },
    image,
  );
}

/** Who speaks in a beat: a boss for a boss level's story, otherwise old Glimmer. */
export function beatFigure(
  data: ContentData,
  beat: StoryBeat | undefined,
): { readonly kind: 'glimmer' } | { readonly kind: 'boss'; id: string; pose: BossState } {
  const trigger = beat?.trigger;
  if (trigger?.kind === 'boss-defeated') return { kind: 'boss', id: trigger.boss, pose: 'won' };
  if (trigger?.kind === 'level-start' || trigger?.kind === 'level-complete') {
    const boss = data.levels.find((level) => level.id === trigger.level)?.boss;
    if (boss)
      return { kind: 'boss', id: boss, pose: trigger.kind === 'level-start' ? 'start' : 'won' };
  }
  return { kind: 'glimmer' };
}

/**
 * Old Glimmer's face for a story line. The story data carries no mood per line yet, so the
 * shell keeps one for the version-1 lines (a sneeze is a surprise, cold eggs are a sad, sleepy
 * moment); any other line is calm, and a beat's last line is happy.
 */
const LINE_EXPRESSIONS: Readonly<Record<string, DragonExpression>> = {
  'story.prologue.1': 'curious',
  'story.prologue.2': 'curious',
  'story.prologue.3': 'sleepy',
  'story.prologue.4': 'happy',
  'story.first-egg.choose': 'curious',
  'story.first-egg.chosen': 'proud',
  'story.meadow-welcome.1': 'happy',
  'story.meadow-welcome.2': 'proud',
};

export function lineExpression(textKey: string, last: boolean): DragonExpression {
  return LINE_EXPRESSIONS[textKey] ?? (last ? 'happy' : 'idle');
}

/** The text key of a beat's node (the last line of a beat is shown from its event). */
export function nodeText(data: ContentData, beatId: string, nodeId: string): string | null {
  const beat = data.story.beats.find((candidate) => candidate.id === beatId);
  const node = beat?.graph.nodes.find((candidate) => candidate.id === nodeId);
  return node?.text ?? null;
}
