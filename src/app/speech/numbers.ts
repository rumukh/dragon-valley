/**
 * English number words for read-aloud, in British style ("three hundred and five"), as taught
 * in Czech schools' English lessons. Covers 0 to 999 999, beyond any 3rd-grade number.
 */
const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export const MAX_SPOKEN_NUMBER = 999_999;

function below1000(value: number): string {
  if (value < 20) return ONES[value]!;
  if (value < 100) {
    const unit = value % 10;
    return TENS[Math.floor(value / 10)]! + (unit ? '-' + ONES[unit]! : '');
  }
  const rest = value % 100;
  return ONES[Math.floor(value / 100)]! + ' hundred' + (rest ? ' and ' + below1000(rest) : '');
}

export function numberToWords(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_SPOKEN_NUMBER) {
    throw new RangeError(`Cannot speak ${value}: whole numbers from 0 to ${MAX_SPOKEN_NUMBER}.`);
  }
  if (value === 0) return 'zero';
  const thousands = Math.floor(value / 1000);
  const rest = value % 1000;
  const parts: string[] = [];
  if (thousands) parts.push(below1000(thousands) + ' thousand');
  if (rest) parts.push((thousands && rest < 100 ? 'and ' : '') + below1000(rest));
  return parts.join(' ');
}
