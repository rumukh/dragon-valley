# Dragon Valley art

Art direction, the master palette, and the API of the art modules (`src/app/art/**`). Every
renderer is a **pure, deterministic function that returns an SVG string**: no DOM, no clock, no
`Math.random`, no platform trigonometry. The same options always give byte-identical markup on every
OS (pinned by golden digests in `test/unit/art/dragon.test.ts`).

**Imports for the shell.** Prefer the sub-modules you need (`src/app/art/dragon`, `…/icons`,
`…/characters/avatars`, `…/characters/bosses`, `…/window`, `…/stickers`, `…/cosmetics`,
`…/palette`) so the bundle stays small; the umbrella `src/app/art` re-exports everything.
`src/app/art/backgrounds` and `src/app/art/catalog` are build-time generators: at runtime load the
static files in `assets/backgrounds/` and `assets/art/catalog.json` instead (only
`MAP_SHEETS`, `mapNodePositions`, `lowerValleyNodePositions`, `MAP_HOTSPOTS` and
`LOWER_VALLEY_HOTSPOTS` are handy at runtime).

**Grades 1-2 (Lower Valley).** The art-side region list `ART_REGION_IDS` is the five Lower Valley
regions (`LOWER_VALLEY_REGION_IDS`: `pebble-brook`, `mushroom-hollow`, `rainbow-ford`,
`hundred-hills`, `market-square`) followed by the nine canonical regions. Pebble Brook is fully
drawn (scene, map area, boss `will-o-wisps`, first-egg dragons `dot`, `hop`, `nibble`, emblem,
icons) for grade 1, and so are the grade 2 regions Hundred Hills (scene, map area, boss
`long-broad-sharp-eyes`, first-egg dragon `bead`) and Market Square (scene, map area, boss `otesanek`,
first-egg dragons `tumble` and `penny`). Mushroom Hollow and Rainbow Ford have emblems, palette
entries and roughed-in map areas; their scenes and bosses follow in later phases.

The grade 2 first-egg dragons are special dragons (table `null`) with their own mnemonics:
**Bead** (pink) carries an abacus on her belly (3 golden tens and 4 teal ones = 34) and stands by
bead rods, for place value; **Tumble** (orange) shows ten cubes → an arrow → one ten-rod on the
belly and sits by a bundle of ten sticks plus loose ones, for carrying and borrowing; **Penny**
(blue) wears a big gold coin with a heart and keeps a coin purse with a stack of coins, for money
at the market. Their eggs are dotted with beads, looping arrows and cubes, and gold coins.

## 1. Art direction

- **Bright storybook, "toy vinyl" finish.** Rounded shapes, soft radial shading (light top-left,
  shade bottom-right), a glossy highlight, and a **deep hue-tinted outline instead of black**.
  Shadows lean toward deep plum (`#2a1b45`), highlights toward warm cream (`#fff8e6`), so every
  color family stays harmonious.
- **Cute, not babyish.** Big glossy eyes with two highlights, small snouts, blush, one tiny fang.
  Hatchlings follow the baby schema (huge head, stubby wings); adults are taller with longer tails
  and bigger wings. Nothing is scary: no claws pointing at the viewer, no sharp teeth rows.
- **Every dragon is its own mnemonic**, readable at 64 px and charming at 512 px:

  | Table | Dragon    | What the child can see and count                                                   |
  | ----- | --------- | ---------------------------------------------------------------------------------- |
  | ×0    | Puff      | Cloud-puff body, blows a smoke ring shaped like **0** ("poof!")                    |
  | ×1    | Mirror    | Silver mirror belly and a **reflection** under its feet: stays the same            |
  | ×2    | Bubbles   | **Two tails**, bubbles in pairs, spots in pairs: doubles                           |
  | ×3    | Clover    | **3 sapling horns**, 3 leaf spikes, a three-leaf clover on the belly and the tail  |
  | ×4    | Petal     | **4 petal wings** (two pairs: double the double), four-petal flower crest          |
  | ×5    | Sunny     | **5-ray sun crest**, a clock face belly and a **clock-hand tail** (5-minute steps) |
  | ×6    | Ember     | **5 golden flames** on its head **+ 1 blue flame** on the tail tip                 |
  | ×7    | Rainbow   | **7 rainbow stripes** on the belly                                                 |
  | ×8    | Crystal   | **8-point snowflake** on the belly (double, double, double)                        |
  | ×9    | Starry    | A ten-frame of stars with **9 stars and 1 empty place** (10 − 1)                   |
  | ×10   | Goldie    | A crown with **10 points** and a gold **0** medal (add a zero)                     |
  | r     | Pearl     | Shares pearls fairly: a neat pile plus **one leftover pearl**                      |
  | 100s  | Boulder   | Stone dragon with a hundred-square, a ten-rod and a one-cube carved on its belly   |
  | ( )   | Clockwork | Three gears that **turn one after another**, in order                              |

  Eggs hint at their hatchling (Puff's egg has clouds and a 0, Ember's has 5 orange flames and 1 blue
  one, Starry's has 9 stars and one empty star, and so on).

  Mnemonics are sized to be **countable at gameplay size (120-200 px)**: belly emblems are large and
  the paws rest at the sides so nothing covers them (
  pm run art:gallery writes a 160 px
  mnemonics.png sheet to check this). Silhouettes vary too: Puff is a puffy cloud, Boulder a
  chiselled stone dragon with rock horns, Petal has notched blossom wings under a leafy flower.

- **Region accents** give each place one signature color (palette `regions`); dragons are drawn in
  their own colors so they stay recognisable everywhere.

## 2. Master palette (`assets/art/palette.json`)

The UI design system adopts these tokens. Groups:

| Group                                 | Tokens                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ink`                                 | `ink` (body text), `inkSoft`, `inkMuted` (captions), `inkInverse` (text on night)                          |
| `surface`                             | `paper` (app background), `paperDeep`, `card`, `line`, `lineStrong`, `night`, `nightSoft`, `shadow`        |
| `brand`                               | `primary` (buttons, white label), `primaryDeep`, `primarySoft`, `sun`, `sunDeep`, `coral`, `sky`, `meadow` |
| `feedback`                            | `success*` (correct: green + check), `miss*` (almost: orange + ?), `info*`                                 |
| `mastery`                             | Magic Window glass: `dim`, `bronze`, `silver`, `gold`, plus `polish` and `lead`                            |
| `regions.<id>`                        | `accent` (decoration), `deep` (text/icons on paper), `soft` (tinted surfaces), `onAccent`                  |
| `rainbow`, `fruit`, `dragonSignature` | Shared art colors; `dragonSignature.<id>` tints dragon cards                                               |

`accessiblePairs` lists every text/background pair the UI may use with its minimum WCAG ratio;
`test/unit/art/palette.test.ts` recomputes them. Rules of thumb:

- Body text: `ink` on `paper`/`card`/`paperDeep` (≥ 12:1). Captions: `inkMuted` (≥ 4.5:1).
- Buttons: `brand.primary` with a white label (5.6:1); `brand.sun` with an `ink` label.
- Region accent fills take **large text only** (≥ 24 px or bold ≥ 19 px) in the `onAccent` color
  (≥ 3:1); for normal text use `deep` on `paper` or `soft` (≥ 4.5:1).
- Feedback never relies on color alone: pair `success` with the check glyph and `miss` with the
  `?` (icons `badge-correct`, `badge-almost`).

## 3. Dragon rig API (`src/app/art/dragon`, re-exported from `src/app/art`)

```ts
import { renderDragon, getDragonAnchors, renderHatch, ANIMATIONS_CSS } from '../art';

const svg: string = renderDragon({
  dragon: 'ember', // catalog id, or a DragonRecipe object
  stage: 'youngling', // 'egg' | 'hatchling' | 'youngling' | 'adult' | 'crowned'
  expression: 'happy', // 'idle' | 'happy' | 'curious' | 'eating' | 'sleepy' | 'proud'
  outfit: {
    head: 'hat-wizard',
    neck: 'scarf-striped',
    eyes: 'glasses-star',
    wings: 'paint-stars',
    nest: 'nest-pillow',
  },
  idPrefix: 'dragon-ember-1', // REQUIRED to be unique per instance on a page
  framing: 'stage', // 'stage' (default) | 'fit'
  animated: true, // adds class dv-animated (default true)
  warmth: 0.7, // eggs only: <0.3 frosty, >=0.5 glowing, >=0.85 cracking
  condition: 'sneezy', // seven-headed only: 'sneezy' | 'cured' (default 'cured')
  title: 'Ember the fire dragon', // accessible name; omit for decorative (aria-hidden)
  size: 256, // optional width/height attributes
  embedStyles: false, // true embeds ANIMATIONS_CSS (standalone files)
});
container.innerHTML = svg; // our own generated markup: no user input is interpolated
```

- **Framing.** `stage` uses a shared `0 0 512 512` canvas with the feet on y = 470, scaled per
  stage (`STAGE_SCALE`: egg 0.56, hatchling 0.62, youngling 0.78, adult/crowned 0.9), so a dragon
  visibly grows in the nest or hub. `fit` crops a square around the drawing for cards and
  64 px thumbnails.
- **ids.** Every internal id is `<idPrefix>-<name>`. Two SVGs with the same prefix on one page
  will collide; use e.g. `dragon-${profileSlot}-${dragonId}`. The prefix must match
  `/^[A-Za-z][A-Za-z0-9_-]{0,63}$/`.
- **Root attributes.** `<svg class="dv-dragon dv-animated" data-dragon data-stage data-expression>`.
  Switching expression means re-rendering (cheap: 18 KB on average, up to about 60 KB for the
  Seven-Headed Dragon, about 0.5 ms per render in Node).
- **Expressions** change the face, arm pose (cheer, paw on chin, holding food, hands on hips),
  head pose and props (`zZ` when sleepy, sparkles when happy, a glow when proud). Poses are
  static transforms, so reduced motion still shows them.
- **Crowned** adds a royal crown, golden aura and twinkles. An equipped **head cosmetic wins over
  the crown** (the aura stays); hats also hide head-top crests (Goldie's crown, Petal's flower).
- **Seven-Headed Dragon**: seven personalities (sleepy, giggly, grumpy, brave, shy, curious,
  dreamy). `condition: 'sneezy'` gives red noses, watery eyes, a scarf and sneeze puffs.
- **Glimmer** (the guide) renders with `renderDragon({ dragon: 'glimmer', stage: 'adult', ... })`:
  spectacles, beard, bushy brows and a shawl.

### Anchors

`getDragonAnchors({ dragon, stage, framing, outfit? })` returns points in the **SVG viewBox
coordinates** (rest pose) for overlays: `head` (hat line, width = head width), `eyes`, `neck`,
`mouth` (target for Feeding Time fruit arcs), `belly`, `nest` (ground centre), `wingL`, `wingR`,
`top` (speech bubbles, hearts, coins). Convert to page pixels with the element's bounding box
(the SVG uses `xMidYMid meet`, like `@aegis/browser/ui` `logicalPoint`).

### Hatch sequence

`renderHatch({ dragon, idPrefix })` returns one SVG that plays **wobble → cracks → pop →
hatchling reveal** once when inserted (3.6 s, `HATCH_DURATION_MS`). Re-insert the markup to
replay. Without CSS or with reduced motion it shows the hatchling immediately.

### Animation classes (`ANIMATIONS_CSS` / `src/app/art/dragon/animations.css`)

Include the stylesheet once per page (import the `.css` in the bundle, or inject
`ANIMATIONS_CSS`). Transform and opacity only. Everything is scoped to `.dv-animated` and stops
under `prefers-reduced-motion: reduce` or `[data-reduced-motion="true"]` on any ancestor (the
shell already sets it on `<html>`).

| Class                           | Motion                                          | When                |
| ------------------------------- | ----------------------------------------------- | ------------------- |
| `dv-breathe`                    | breathing (scale from the feet)                 | always              |
| `dv-lid`                        | blink                                           | open eyes           |
| `dv-wing-l`, `dv-wing-r` (`…2`) | wing flap (faster when happy, slow when sleepy) | always              |
| `dv-tail`, `dv-tail-l`          | tail sway                                       | always              |
| `dv-bounce` + `dv-shadow`       | happy hop with squash and a shrinking shadow    | `happy`             |
| `dv-head`                       | curious tilt / eating nod                       | `curious`, `eating` |
| `dv-jaw`                        | chewing                                         | `eating`            |
| `dv-z`                          | floating zZ                                     | `sleepy`            |
| `dv-glow`                       | warm pulsing glow                               | `proud`             |
| `dv-aura`, `dv-sparkle`         | aura pulse and twinkles                         | `crowned`           |
| `dv-gear-1..3`                  | gears turn one after another                    | Clockwork           |
| `dv-egg`, `dv-egg-glow`         | occasional wiggle, warm glow                    | eggs                |
| `dv-hatch-*`                    | the hatch sequence                              | `renderHatch`       |

Every animated element's resting state is correct without CSS, so static thumbnails and
reduced motion never show a half-blink or a hidden part.

## 4. Cosmetics (`src/app/art/cosmetics`)

42 cosmetics keyed by asset id in five slots, listed in `COSMETICS` and the catalog:
**head** (10 hats), **neck** (8), **eyes** (8 glasses and masks), **wings** (8 wing paints) and
**nest** (8 decorations). They sit on rig anchors, so every cosmetic fits every dragon at every
stage (eggs show only the nest). Ownership, prices and unlocks are content (S2), not art.

`renderCosmeticIcon(id, { size, idPrefix, title })` draws any cosmetic on its own, centred in a
square view box, for Glimmer's Market tiles and stickers.

## 5. Icons and avatars

`renderIcon(id, { size, idPrefix, title, accent })` renders any id in `ICON_IDS` on a 64 × 64 grid:

- **Items** (full color): `coin`, `star-filled`, `star-empty`, `chest-closed`, `chest-open`, `egg`,
  `badge-correct`, `badge-almost`.
- **Fruit** for Feeding Time: `apple`, `plum`, `pear`, `cherries`, `berries`.
- **Map nodes**: `node-locked`, `node-open`, `node-current`, `node-stars-1..3` (`accent` tints
  open/current nodes with the region color).
- **UI glyphs** drawn only in `currentColor` (theme them with CSS `color`; details such as the
  printer's light are cut-outs, never a fixed color): `lock`, `check`, `question`, `speaker`,
  `settings`, `parent`, `home`, `back`, `next`, `close`, `print`, `hint`, `music`, `sound-off`,
  `pause`, `play`, `plus`, `pencil`, `download`, `upload`, `trash`, `warning`, `retry`,
  `backspace`, `shield`.
- **Region emblems**: `emblem-<region-id>` for all fourteen regions (`ART_REGION_IDS`).
- **Lower Valley items** (`LOWER_VALLEY_ICON_IDS`, full color, for grade 1-2 stickers and
  rewards): `pebbles`, `wisp`, `ten-frame` (seven counters), `stepping-stones`, `sticks-bundle`
  (a tied ten plus one loose stick), `hill`, `market-stall`. Coins use the existing `coin` item.

`renderAvatar('keeper-1' … 'keeper-8', { size, idPrefix, title, frame })` renders eight diverse,
gender-neutral keepers as round badges (120 × 120 grid).

## 6. Bosses (`src/app/art/characters/bosses.ts`)

`renderBoss(id, state, { size, idPrefix, title, animated })` draws the friendly folklore
bosses (`BOSS_IDS`: the Lower Valley's `LOWER_VALLEY_BOSS_IDS`, then the nine canonical ones) on the 512 × 512 character canvas (feet at y = 470, like the dragons) in three states:
`start` (the challenge pose), `warming` (about half way along the boss meter) and `won`. Nobody
gets hurt. `BOSS_OUTCOME` says how each one is won, and `BOSS_MOOD` gives the same ending in the
content contract's `BossMood` vocabulary. The `won` pose shows that mood, so a content pack's
`bosses[].mood` must match it (tested):

| Boss                    | Region           | Start → warming → won                                                                    | Outcome | Mood       |
| ----------------------- | ---------------- | ---------------------------------------------------------------------------------------- | ------- | ---------- |
| `will-o-wisps`          | pebble-brook     | three cheeky dim wisps over the brook → six, glowing → a ring of ten dancing             | dance   | `happy`    |
| `long-broad-sharp-eyes` | hundred-hills    | Long, Broad and Sharp-Eyes waiting arms crossed → waving and pointing → dancing together | dance   | `happy`    |
| `otesanek`              | market-square    | a hungry log-baby with an empty bowl → eating porridge → fast asleep, tummy full (zZ)    | sleep   | `sleepy`   |
| `bridge-troll`          | sunny-meadow     | arms crossed on his bridge → scratching his head → belly laugh with tears                | laugh   | `laughing` |
| `forest-witch`          | whispering-woods | a kind Ježibaba squinting on her broom → waving → sharing a gingerbread heart            | agree   | `happy`    |
| `krakonos`              | fire-mountain    | stern under a rain cloud → the sun peeks out → laughing in the sunshine                  | laugh   | `laughing` |
| `gnome-king`            | crystal-caves    | arms crossed by his lantern → lantern raised → dancing with a crystal                    | agree   | `happy`    |
| `water-goblin`          | sharing-lake     | hugging lidded teacups → peeking at a plum → giving the lost fruit back                  | agree   | `happy`    |
| `lake-nymphs`           | leftover-lagoon  | giggling behind their hands → waving → dancing hand in hand                              | laugh   | `laughing` |
| `friendly-giant`        | giants-peaks     | puzzled (?) → yawning → fast asleep (zZ)                                                 | sleep   | `sleepy`   |
| `golem`                 | riddle-ruins     | confused, lamps dark → lamps 1 and 2 lit → all three lit, cheering (in order!)           | agree   | `happy`    |
| `seven-headed`          | dragon-castle    | all seven heads sneezy → four cured → all cured and happy                                | agree   | `happy`    |

The root carries `data-boss`, `data-state` and `data-expression` (`happy` when won), so the
shared animation classes (`dv-zzz`, twinkles, sneezes, the lantern glow) work for bosses too.

## 7. Magic Window (`src/app/art/window`)

```ts
renderMagicWindow({
  multiplication, // 11 rows (first factor 0-10) x 11 panes (second factor 0-10)
  division, // 10 rows (divisor 1-10) x 11 panes (quotient 0-10)
  idPrefix,
  size,
  title,
  animated,
});
// a pane is 'dim' | 'bronze' | 'silver' | 'gold' or { level, needsPolish: true }; missing panes are dim
renderMasteryGrid({ op: 'mul' | 'div', cells, idPrefix, size }); // plain grid for the parent area
magicWindowLayout(); // pane rectangles in the 600 x 872 window viewBox, for hit targets
```

The hall window is an arched stained-glass window: multiplication panes in the body, the 110
division facts as a sunburst fan in the arch (rings = divisors 1-10 from the centre out, sectors
= quotients 0-10 left to right) and a central star that glows brighter as more panes light up.
Glass colors come from `palette.mastery`; gold panes twinkle and panes that need polishing get
dusty smudges (never a broken look). Every pane carries `data-op` plus `data-a`/`data-b`
(multiplication) or `data-divisor`/`data-quotient`/`data-dividend` (division); the root carries
`data-lit` and `data-total`. In the castle hall, place the window at `HALL_WINDOW`
(`{ x: 532, y: 84, width: 536, height: 779 }` in the hall's 1600 × 1000 space).

## 8. Stickers (`src/app/art/stickers`)

`renderSticker({ frame, color, icon | dragon, stage?, idPrefix, size, title })` composes a
die-cut sticker (120 × 120) so content can add stickers without new art:

- `frame`: `frame-round`, `frame-scallop`, `frame-shield`, `frame-star`, `frame-hexagon`,
  `frame-heart`, `frame-ribbon`, `frame-cloud` (published in the catalog as `stickers.frames[].id`).
- `color`: any region id, `primary`, `sun`, `coral`, `sky`, `meadow`, `gold`, `silver`,
  `bronze`, or a `#rrggbb` color.
- `icon`: any `renderIcon` id (UI glyphs take a darker tint of the frame color) or any cosmetic id
  (shown as the item, e.g. `hat-party`); or
- `dragon`: any dragon id, shown as a happy portrait (`stage` defaults to `youngling`).

## 9. Backgrounds and the map sheets (`assets/backgrounds`)

Layered SVG scenes at 1600 × 1000 (16:10), generated by `npm run art:build` from
`src/app/art/backgrounds` (each ≤ 150 KB, tested): the two map sheets `lower-valley-map` and
`valley-map`, one scene per drawn region (`pebble-brook`, `hundred-hills`, `market-square` and the nine
canonical regions) and
`castle-hall`. They are child-safe static images (`<img>` or CSS backgrounds); painted versions
can replace them later from `assets/backgrounds/prompts/<id>.prompt.txt`, and
`assets/backgrounds/provenance.json` records the source of each (SVG original, painted pending).

**Region scene layout** (`SCENE_LAYOUT`, also in the catalog): the player's dragon stands at
`(430, 850)`, the boss at `(1170, 850)`, and the calm centre-top area `{ x: 400, y: 70, width:
800, height: 470 }` is kept free for the problem card.

**Map hotspots** (`assets/backgrounds/map-hotspots.json`, also `MAP_HOTSPOTS`):

```jsonc
{
  "schemaVersion": 1,
  "background": "valley-map",
  "logical": { "width": 1600, "height": 1000 },
  "hotspots": [{ "id": "sunny-meadow", "x": 40, "y": 730, "width": 420, "height": 260,
                 "labelKey": "region.sunny-meadow.name" }],          // @aegis/browser/ui Hotspot
  "path": [[96, 942], ...],                                          // the whole road, in order
  "regions": { "sunny-meadow": { "center": {...}, "nodes": [6 x {x, y}], "boss": {x, y},
                                 "path": [[x, y], ...] } }
}
```

Hotspots pass `validateHotspots` and every level node and boss node hits its own region with
`hitHotspot` (tested against the real SDK). The map's `<svg>` uses the default `xMidYMid meet`,
matching `logicalPoint`. Node counts follow the plan (6, 6, 6, 6, 6, 5, 6, 6 and 3 levels plus one
boss each); if content changes a count, `mapNodePositions(regionId, count)` spaces any number of
nodes evenly along the region's own stretch of road. `labelKey`s are suggestions for the content
string catalog.

**Map sheets.** The valley is drawn on two sheets travelled in order, listed in `MAP_SHEETS`
(`{ id, hotspotsFile, hotspots }[]`):

| Sheet (`id`)       | Hotspots file                                   | Export                  | Regions                                    |
| ------------------ | ----------------------------------------------- | ----------------------- | ------------------------------------------ |
| `lower-valley-map` | `assets/backgrounds/lower-valley-hotspots.json` | `LOWER_VALLEY_HOTSPOTS` | the five Lower Valley regions (grades 1-2) |
| `valley-map`       | `assets/backgrounds/map-hotspots.json`          | `MAP_HOTSPOTS`          | the nine canonical regions (grade 3)       |

Both files have the same shape as above. The Lower Valley's road enters at the bottom left, runs
Pebble Brook → Mushroom Hollow → Rainbow Ford along the bottom and Hundred Hills → Market Square
back along the top, and leaves at the top left; it adds `"next": "valley-map"` and `"exit": {x, y}`
(where the road leaves the sheet). The valley map adds `"previous": "lower-valley-map"` and
`"entry": {x, y}` (its road's first point, where a short stub arrives from the bottom-left edge).
Lower Valley node counts are 6, 6, 6, 5 and 5 levels plus one boss each (`LOWER_VALLEY_LEVELS`);
`lowerValleyNodePositions(regionId, count)` respaces them like `mapNodePositions`. Both sheets
are catalogued with `kind: "map"` and their `hotspots` file.

## 10. The catalog (`assets/art/catalog.json`)

Generated from `src/app/art/catalog.ts` by `npm run art:build`; a test fails if it is stale.
Content references art **only by these ids**:

```jsonc
{
  "schemaVersion": 1,
  "dragonStages": [...], "dragonExpressions": [...], "cosmeticSlots": [...],
  "dragons": [{ "id": "ember", "name": "Ember", "kind": "table", "table": 6,
                "homeRegion": "fire-mountain", "signature": "#ff5f3d",
                "mnemonic": "...", "recipe": "assets/art/dragons/ember.json" }],
  "characters": [{ "id": "glimmer", "kind": "guide", "render": "renderDragon", ... }],
  "cosmetics": [{ "id": "hat-wizard", "slot": "head", "name": "Wizard Hat" }],
  "avatars": [{ "id": "keeper-1" }],
  "icons": { "items": [...], "fruits": [...], "mapNodes": [...], "glyphs": [...], "emblems": [...] },
  "bosses": [{ "id": "golem", "region": "riddle-ruins", "states": ["start", "warming", "won"],
               "outcome": "agree", "mood": "happy" }],
  "stickers": { "frames": [...], "colors": [...],
                "content": "icon: any icon id (icons.*) or cosmetic id; or dragon: any dragon id" },
  "magicWindow": { "levels": ["dim", "bronze", "silver", "gold"], "flags": ["needs-polish"], ... },
  "backgrounds": [{ "id": "sunny-meadow", "file": "assets/backgrounds/sunny-meadow.svg", "kind": "region",
                    "region": "sunny-meadow", "layout": { "dragon": ..., "boss": ..., "ui": ... } }],
  "regions": [{ "id": "sunny-meadow", "accent": "#ffc53d", "deep": "...", "soft": "...",
                "onAccent": "ink", "emblem": "emblem-sunny-meadow" }]
}
```

Names in the catalog are English defaults for tooling; player-facing strings belong in the
content catalogs. Boss and dragon ids are separate namespaces (`seven-headed` is both).

**Content cross-check.** `npm run validate:content -- --strict-art` checks that every art id in
the content pack exists in this catalog. `test/unit/art/content-art.test.ts` goes further and
renders each reference in the role the pack gives it:

- a region's `background` must be a region scene;
- a dragon's `rig` must have the same `kind` and `table`, so its mnemonic teaches that table;
- a boss's `mood` must equal `BOSS_MOOD`;
- a cosmetic's `assetId` must be drawn for its `slot` and fit every content dragon;
- every sticker must compose.

## 11. Recipes (`assets/art/dragons/<id>.json`)

A recipe is data: colors (`body`, `belly`, `wing`, `horn`, `accent`, `iris`, `cheek`, optional
`shade`, `accent2`), `build` proportions, `horns`, `ears`, `wings` (style and 2 or 4 wings),
`tail` (1 or 2 tails and a tip), `spikes`, `crest`, `markings`, `features` and the `egg` design.
`parseRecipe` validates strictly (unknown fields fail). To add a dragon: add a recipe, import it
in `src/app/art/dragon/recipes.ts`, add its signature color to the palette, run
`npm run art:build` and `npm run art:gallery`, and review the sheets.

## 12. Pipeline

| Command                                      | What it does                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run art:build`                          | Regenerates `catalog.json`, `animations.css` (and the background SVGs)                                                            |
| `npm run art:check`                          | Fails if a generated artifact is stale                                                                                            |
| `npm run art:gallery`                        | Writes `out/art-gallery/index.html` and PNG contact sheets via headless Edge (`DV_EDGE` overrides the browser path)               |
| `npm run art:goldens`                        | Re-pins the golden digests after an intentional, reviewed art change                                                              |
| `node scripts/art/zoom.mjs <name> <spec>...` | True-pixel review sheet: `ember:adult:happy`, `boss:golem:won`, `icon:coin`, `sticker:3`, `window:2`, `bg:sunny-meadow`, `hall:2` |

**Child safety** (tested for every render): no `<script>`, no `foreignObject`, no event
handlers, no external `href`/`url()`, no fonts or `@import`, no images; only local `#id`
references, all of which resolve.
