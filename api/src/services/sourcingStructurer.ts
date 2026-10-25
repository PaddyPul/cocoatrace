const commodities = [
  ['yam', ['yams', 'yam']],
  ['cassava', ['cassava']],
  ['maize', ['maize', 'corn']],
  ['rice', ['rice']],
  ['plantain', ['plantains', 'plantain']],
  ['shea nuts', ['shea nut', 'shea nuts', 'shea kernel', 'shea kernels']],
  ['cocoa', ['cocoa bean', 'cocoa beans', 'cacao', 'cocoa']],
  ['coffee', ['coffee beans', 'coffee']],
  ['cashew', ['cashew nuts', 'cashews', 'cashew']],
  ['cotton', ['raw cotton', 'cotton']],
  ['rubber', ['natural rubber', 'rubber']],
  ['timber', ['lumber', 'timber']],
  ['gold', ['gold doré', 'gold dore', 'gold']],
  ['lithium', ['lithium ore', 'lithium']],
] as const;

const countries: Record<string, string> = {
  ghana: 'GH',
  "côte d'ivoire": 'CI',
  "cote d'ivoire": 'CI',
  ivory_coast: 'CI',
  nigeria: 'NG',
  kenya: 'KE',
  uganda: 'UG',
  tanzania: 'TZ',
  rwanda: 'RW',
  ethiopia: 'ET',
  cameroon: 'CM',
  indonesia: 'ID',
  brazil: 'BR',
  peru: 'PE',
  colombia: 'CO',
};

export type StructuredSourcingBrief = {
  title: string;
  commodity: string;
  quantityKg: number | null;
  originCountries: string[];
  qualityRequirements: Record<string, unknown>;
  assuranceRequirements: Record<string, unknown>;
  deliveryLocation: string;
  incoterm: string;
  requiredBy: string;
  extractedFacts: Array<{ field: string; value: string; confidence: 'high' | 'medium' }>;
  unresolved: string[];
};

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type BriefToken = { word: string; start: number; end: number };
function tokensOf(text: string): BriefToken[] {
  return Array.from(
    text.matchAll(/\d[\d,]*(?:\.\d+)?|[\p{L}]+(?:['’/-][\p{L}]+)*|[^\s]/gu),
    (match) => ({
      word: match[0].toLowerCase(),
      start: match.index!,
      end: match.index! + match[0].length,
    }),
  );
}
function readQuantity(tokens: BriefToken[]) {
  const units = new Set([
    'tonne',
    'tonnes',
    'ton',
    'tons',
    'mt',
    'kilogram',
    'kilograms',
    'kg',
    'kgs',
  ]);
  for (let index = 0; index < tokens.length - 1; index++) {
    if (!/^\d[\d,]*(?:\.\d+)?$/.test(tokens[index].word)) continue;
    let unitIndex = index + 1;
    if (tokens[unitIndex].word === 'metric') unitIndex++;
    const unit = tokens[unitIndex];
    if (!unit || !units.has(unit.word)) continue;
    const amount = Number(tokens[index].word.replaceAll(',', ''));
    const kg = ['kg', 'kgs', 'kilogram', 'kilograms'].includes(unit.word) ? amount : amount * 1000;
    return { kg: Number.isFinite(kg) ? kg : null, next: unitIndex + 1 };
  }
  return null;
}
// Walk tokens once instead of backtracking across arbitrary procurement prose.
function materialPhrase(
  text: string,
  tokens: BriefToken[],
  quantity: ReturnType<typeof readQuantity>,
): string {
  const stops = new Set([
    'from',
    'delivered',
    'delivery',
    'with',
    'for',
    'to',
    'by',
    'required',
    'moisture',
  ]);
  let start = quantity?.next ?? -1;
  if (start >= 0 && tokens[start]?.word === 'of') start++;
  if (
    tokens[start] &&
    (stops.has(tokens[start].word) || [',', '.', '!', ';'].includes(tokens[start].word))
  )
    start = -1;
  if (start < 0 || !tokens[start]) {
    for (let index = 0; index < tokens.length; index++) {
      const word = tokens[index].word;
      if (
        ['need', 'buy', 'source'].includes(word) ||
        (word === 'looking' && tokens[index + 1]?.word === 'for')
      ) {
        start = index + (word === 'looking' ? 2 : 1);
        if (tokens[start]?.word === 'some') start++;
        break;
      }
    }
  }
  if (start < 0 || !tokens[start]) return '';
  const qualifiers = new Set([
    'fully',
    'organic',
    'conventional',
    'fresh',
    'raw',
    'dried',
    'certified',
    'fully-fermented',
    'high-quality',
  ]);
  while (
    tokens[start] &&
    (qualifiers.has(tokens[start].word) ||
      (tokens[start].word === 'high' && tokens[start + 1]?.word === 'quality'))
  ) {
    if (tokens[start].word === 'fully' && tokens[start + 1]?.word === 'fermented') start++;
    if (tokens[start].word === 'high' && tokens[start + 1]?.word === 'quality') start++;
    start++;
  }
  if (!tokens[start]) return '';
  let end = text.length;
  for (let index = start; index < tokens.length; index++) {
    const token = tokens[index];
    if (stops.has(token.word) || [',', '.', '!', ';'].includes(token.word)) {
      end = token.start;
      break;
    }
    if (index > start && text.slice(tokens[index - 1].end, token.start).includes('\n')) {
      end = tokens[index - 1].end;
      break;
    }
  }
  const phrase = text.slice(tokens[start].start, end).toLowerCase().trim();
  if (
    !phrase ||
    phrase.length > 80 ||
    phrase.split(/\s+/).length > 8 ||
    !/^[\p{L}\p{N}][\p{L}\p{N}\s'’()/-]*$/u.test(phrase) ||
    /\b(?:unfamiliar|unspecified|unknown|whatever|something|material|products?|goods|crops?)\b/u.test(
      phrase,
    )
  )
    return '';
  return phrase;
}
function deliveryPhrase(text: string, tokens: BriefToken[]): string {
  for (let index = 0; index < tokens.length; index++) {
    const word = tokens[index].word;
    let start = -1;
    if (['delivered', 'delivery'].includes(word) && tokens[index + 1]?.word === 'to')
      start = index + 2;
    if (word === 'destination') start = index + (tokens[index + 1]?.word === 'is' ? 2 : 1);
    if (word === 'into') start = index + 1;
    if (start < 0 || !tokens[start]) continue;
    let end = text.length;
    for (let cursor = start; cursor < tokens.length; cursor++) {
      if ([',', '.', ';', 'by'].includes(tokens[cursor].word)) {
        end = tokens[cursor].start;
        break;
      }
    }
    return text.slice(tokens[start].start, end).trim();
  }
  return '';
}

export function structureSourcingBrief(brief: string): StructuredSourcingBrief {
  const text = brief.trim();
  const lower = text.toLowerCase();
  const facts: StructuredSourcingBrief['extractedFacts'] = [];
  const unresolved: string[] = [];
  const tokens = tokensOf(text);
  const quantity = readQuantity(tokens);
  const phrase = materialPhrase(text, tokens, quantity);
  const commodityEntry = commodities.find(([, aliases]) =>
    aliases.some((alias) => (phrase ? phrase === alias : new RegExp(`\\b${alias}\\b`).test(lower))),
  );
  const commodity = commodityEntry?.[0] || phrase;
  if (commodity)
    facts.push({
      field: 'commodity',
      value: commodity,
      confidence: commodityEntry ? 'high' : 'medium',
    });
  else unresolved.push('Commodity');

  const quantityKg = quantity?.kg ?? null;
  if (quantityKg !== null)
    facts.push({
      field: 'quantity',
      value: `${quantityKg.toLocaleString()} kg`,
      confidence: 'high',
    });
  else unresolved.push('Quantity');

  const originCountries = Object.entries(countries)
    .filter(([name]) => lower.includes(name.replace('_', ' ')))
    .map(([, code]) => code);
  if (originCountries.length)
    facts.push({
      field: 'origin',
      value: [...new Set(originCountries)].join(', '),
      confidence: 'high',
    });

  const qualityRequirements: Record<string, unknown> = {};
  const moisture = lower.match(
    /moisture(?:\s+(?:maximum|max|below|under|≤|of))?\s*(\d+(?:\.\d+)?)\s*%?/,
  );
  if (moisture) qualityRequirements.moistureMax = Number(moisture[1]);
  if (/fully[ -]fermented/.test(lower)) qualityRequirements.fermentation = 'fully fermented';
  const grade = text.match(/\bgrade\s+([A-Za-z0-9+-]+)/i);
  if (grade) qualityRequirements.grade = grade[1];
  const cropYear = lower.match(/crop\s+year\s+(20\d{2})/);
  if (cropYear) qualityRequirements.cropYear = Number(cropYear[1]);
  if (Object.keys(qualityRequirements).length)
    facts.push({
      field: 'quality',
      value: Object.entries(qualityRequirements)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' · '),
      confidence: 'high',
    });

  const assuranceRequirements: Record<string, unknown> = {};
  if (/\borganic\b/.test(lower) && !/non[- ]organic|conventional/.test(lower))
    assuranceRequirements.organic = true;
  if (/plot[- ]level|plot geolocation|gps polygon|geolocation/.test(lower))
    assuranceRequirements.plotGeolocation = true;
  if (/\beudr\b/.test(lower)) assuranceRequirements.eudrDataPack = true;
  if (/traceab/.test(lower)) assuranceRequirements.traceability = true;
  if (Object.keys(assuranceRequirements).length)
    facts.push({
      field: 'assurance',
      value: Object.keys(assuranceRequirements).join(', '),
      confidence: 'high',
    });

  const incoterm = (
    text.match(/\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/i)?.[1] || 'CIF'
  ).toUpperCase();
  const deliveryLocation = deliveryPhrase(text, tokens);
  const dateMatch = text.match(
    /\b(?:by|required\s+by)\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(20\d{2}))?/i,
  );
  let requiredBy = '';
  if (dateMatch) {
    const year = Number(dateMatch[3] || new Date().getUTCFullYear());
    const month = new Date(`${dateMatch[2]} 1, 2000`).getMonth() + 1;
    requiredBy = `${year}-${String(month).padStart(2, '0')}-${String(Number(dateMatch[1])).padStart(2, '0')}`;
  }
  if (!deliveryLocation) unresolved.push('Delivery location');
  if (!requiredBy) unresolved.push('Required date');
  const title = [
    assuranceRequirements.organic ? 'Organic' : '',
    titleCase(commodity || 'Material'),
    deliveryLocation ? `for ${deliveryLocation}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return {
    title,
    commodity,
    quantityKg,
    originCountries: [...new Set(originCountries)],
    qualityRequirements,
    assuranceRequirements,
    deliveryLocation,
    incoterm,
    requiredBy,
    extractedFacts: facts,
    unresolved,
  };
}
