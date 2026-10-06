/**
 * The read-aloud button: shown only when this keeper has read-aloud on and the device has a
 * local English voice (the grown-ups' area explains when it has none). It reads whatever the
 * screen shows at the moment it is pressed.
 */
import { candyButton } from '../ui/button';
import type { ActiveKeeper, App } from '../shell/app';

export function speakerButton(
  app: App,
  active: ActiveKeeper,
  text: () => string,
  testId = 'read-aloud',
): HTMLButtonElement[] {
  if (!active.preferences.current().readAloud || !app.speech.available()) return [];
  return [
    candyButton({
      label: app.kit.t('speech.read'),
      icon: 'speaker',
      iconOnly: true,
      variant: 'paper',
      keepsFocus: true,
      testId,
      onPress: () => {
        app.speak(text());
      },
      onError: app.kit.onError,
    }),
  ];
}
