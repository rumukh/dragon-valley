/**
 * The first run of a new family (plan §2.8, the hook within five minutes): the title, one big
 * Play button, a keeper with a name and a picture, the prologue (skippable, read line by line)
 * and the choice of a first egg, then the keeper's own hub with the Daily Adventure ready. The
 * editor guides with kind, specific messages instead of failing.
 */
import { expect, test } from './support/fixtures';
import {
  boot,
  bootStatus,
  expectCoins,
  expectHub,
  expectSaved,
  expectScreen,
  keeperCard,
  leaveHub,
  meetFirstEgg,
  newFamily,
} from './support/app';

test('a new family goes from the title through the prologue to their first egg and hub', async ({
  page,
}) => {
  await boot(page);
  await expect(bootStatus(page)).toHaveAttribute('data-screen', 'title');
  await expect(page).toHaveTitle('Dragon Valley');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dragon Valley');
  await expect(page.getByText('A Times-Table Adventure')).toBeVisible();
  await expect(page.getByText('The dragon eggs are waiting for you!')).toBeVisible();
  await expect(page.getByTestId('splash'), 'the splash is gone once the title shows').toHaveCount(
    0,
  );

  await page.getByTestId('title-play').click();
  await expectScreen(page, 'editor');
  await expect(page).toHaveTitle('A new keeper! · Dragon Valley');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A new keeper!');
  await expect(page.getByTestId('keeper-name'), 'typing can start at once').toBeFocused();
  await expect(page.getByLabel('Your name')).toBeVisible();
  // Eight pictures and three classes.
  await expect(page.getByRole('radio')).toHaveCount(11);

  // Guided, never judged: first the picture, then the name.
  await page.getByTestId('keeper-save').click();
  await expect(page.getByTestId('keeper-problem')).toHaveText('Please pick a keeper picture.');
  await page.getByTestId('avatar-keeper-4').click();
  await page.getByTestId('keeper-save').click();
  await expect(page.getByTestId('keeper-problem')).toHaveText('Please type a name.');
  await expect(page.getByTestId('keeper-name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('keeper-name')).toBeFocused();

  // Czech names are welcome; spaces are tidied. Enter in the name field saves.
  await page.getByTestId('keeper-name').fill('  Šárka   Nováková ');
  await page.getByTestId('keeper-name').press('Enter');

  // The prologue, one line at a time; Skip goes to the egg choice, which cannot be skipped.
  await expectScreen(page, 'play');
  const line = page.getByTestId('story-line');
  await expect(line).toHaveText('Long ago, a dragon with seven heads caught a cold.');
  await page.getByTestId('story-next').click();
  await expect(line).toHaveText('A-choo! The Magic Window broke into shiny pieces.');
  await page.getByTestId('story-skip').click();
  await expect(line).toHaveText('Choose your first egg. Which one feels warm?');
  await expect(page.getByTestId('story-skip')).toHaveCount(0);
  for (const egg of ['bubbles', 'sunny', 'goldie']) {
    await expect(page.getByTestId(`story-choice-${egg}`)).toBeVisible();
  }
  await page.getByTestId('story-choice-sunny').click();
  await expect(line).toHaveText("Great choice! Let's warm it up with some practice.");
  await page.getByTestId('story-next').click();

  await expectHub(page, 'Šárka Nováková');
  await expect(page).toHaveTitle('Hello, Šárka Nováková! · Dragon Valley');
  await expect(page.getByTestId('hub-dragon'), 'the chosen egg is in the nest').toHaveAttribute(
    'data-dragon',
    'sunny',
  );
  await expect(page.getByTestId('hub-dragon')).toHaveAccessibleName("Sunny's egg");
  await expect(page.getByTestId('screen-hub')).toContainText("Sunny's egg");
  await expectCoins(page, 0);
  await expect(
    page.getByTestId('hub-adventure'),
    'the Daily Adventure starts with the check',
  ).toHaveText('Show the dragons what you know!');
  await expectSaved(page);

  await leaveHub(page);
  await expect(keeperCard(page, 1)).toHaveAccessibleName('Play as Šárka Nováková');
  await expect(page.getByTestId('keeper-add')).toBeVisible();
  // The prologue is told once: the keeper goes straight to the hub next time.
  await keeperCard(page, 1).click();
  await expectHub(page, 'Šárka Nováková');
});

test('names are checked kindly: too long, odd signs, and a name already taken', async ({
  page,
}) => {
  await newFamily(page, { name: 'Ema' });
  await leaveHub(page);
  await page.getByTestId('keeper-add').click();
  await expectScreen(page, 'editor');
  await page.getByTestId('avatar-keeper-2').click();
  const name = page.getByTestId('keeper-name');
  const problem = page.getByTestId('keeper-problem');
  const save = page.getByTestId('keeper-save');

  await name.fill('Bartoloměj Maxmilián');
  await save.click();
  await expect(problem).toHaveText('That name is too long.');
  await name.fill('Ema!');
  await save.click();
  await expect(problem).toHaveText(
    'Please use letters, numbers, spaces, apostrophes, full stops or hyphens.',
  );
  await name.fill('EMA');
  await save.click();
  await expect(problem, 'names are unique, ignoring case').toHaveText(
    'Another keeper has that name.',
  );
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await name.fill("Zoë O'Neil-Brown");
  await save.click();
  await meetFirstEgg(page, 'goldie');
  await expectHub(page, "Zoë O'Neil-Brown");
  await expect(page.getByTestId('hub-dragon')).toHaveAttribute('data-dragon', 'goldie');
  await expect(page.getByTestId('hub-dragon')).toHaveAccessibleName("Goldie's egg");
});

test("the nest says whose egg it is: a name ending in s takes only the apostrophe (Bubbles' egg)", async ({
  page,
}) => {
  await newFamily(page, { name: 'Ema' });
  const nest = page.getByTestId('hub-dragon');
  await expect(nest, 'Bubbles is the first egg').toHaveAttribute('data-dragon', 'bubbles');
  // The copy brief's own example (docs/qa/copy-review.md, "Possessives"); DV-QA-19, fixed.
  await expect(nest).toHaveAccessibleName("Bubbles' egg");
  await expect(page.getByTestId('screen-hub')).toContainText("Bubbles' egg");
});

test('Back on the editor returns to the title without making a keeper', async ({ page }) => {
  await boot(page);
  await page.getByTestId('title-play').click();
  await expectScreen(page, 'editor');
  await page.getByTestId('keeper-name').fill('Nobody');
  await page.getByTestId('back').click();
  await expectScreen(page, 'title');
  await page.getByTestId('title-play').click();
  await expectScreen(page, 'editor');
  await expect(page.getByTestId('keeper-name'), 'nothing was kept').toHaveValue('');
});
