import messages from './messages.json';

type TranslationKey = keyof typeof messages;
function catalog(language: 0 | 1): Record<TranslationKey, string> {
  return Object.fromEntries(
    Object.entries(messages).map(([key, translations]) => [key, translations[language]]),
  ) as Record<TranslationKey, string>;
}
export const english = catalog(0);
export const french = catalog(1);
