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
  ghana: 'GH', "côte d'ivoire": 'CI', "cote d'ivoire": 'CI', ivory_coast: 'CI',
  nigeria: 'NG', kenya: 'KE', uganda: 'UG', tanzania: 'TZ', rwanda: 'RW',
  ethiopia: 'ET', cameroon: 'CM', indonesia: 'ID', brazil: 'BR', peru: 'PE', colombia: 'CO',
};

export type StructuredSourcingBrief = {
  title: string; commodity: string; quantityKg: number | null; originCountries: string[];
  qualityRequirements: Record<string, unknown>; assuranceRequirements: Record<string, unknown>;
  deliveryLocation: string; incoterm: string; requiredBy: string;
  extractedFacts: Array<{ field: string; value: string; confidence: 'high' | 'medium' }>;
  unresolved: string[];
};

function titleCase(value: string) { return value.replace(/\b\w/g, (letter) => letter.toUpperCase()); }

// Read the material phrase from ordinary procurement grammar, not a crop whitelist.
// Ambiguous prose remains a required manual-review field.
function materialPhrase(text: string): string {
  const quantity = /\b\d[\d,]*(?:\.\d+)?\s*(?:metric\s*(?:tonnes?|tons?)|tonnes?|tons?|mt|kilograms?|kgs?)\b\s*(?:of\s+)?(.+?)(?=\s+(?:from|delivered|delivery|with|for|to|by|required|moisture)\b|[,.!;\n]|$)/iu;
  const request = /\b(?:need|buy|source|looking for)\s+(?:some\s+)?(.+?)(?=\s+(?:from|delivered|delivery|with|for|to|by|required|moisture)\b|[,.!;\n]|$)/iu;
  const phrase = (text.match(quantity)?.[1] || text.match(request)?.[1] || '')
    .toLowerCase().replace(/^(?:(?:fully[ -]fermented|fully|organic|conventional|fresh|raw|dried|high[ -]quality|certified)\s+)+/u, '').trim();
  if (!phrase || phrase.length > 80 || phrase.split(/\s+/).length > 8 || !/^[\p{L}\p{N}][\p{L}\p{N}\s'’()/-]*$/u.test(phrase) || /\b(?:unfamiliar|unspecified|unknown|whatever|something|material|products?|goods|crops?)\b/u.test(phrase)) return '';
  return phrase;
}

export function structureSourcingBrief(brief: string): StructuredSourcingBrief {
  const text = brief.trim();
  const lower = text.toLowerCase();
  const facts: StructuredSourcingBrief['extractedFacts'] = [];
  const unresolved: string[] = [];
  const phrase = materialPhrase(text);
  const commodityEntry = commodities.find(([, aliases]) => aliases.some((alias) => phrase ? phrase === alias : new RegExp(`\\b${alias}\\b`).test(lower)));
  const commodity = commodityEntry?.[0] || phrase;
  if (commodity) facts.push({ field: 'commodity', value: commodity, confidence: commodityEntry ? 'high' : 'medium' }); else unresolved.push('Commodity');

  const quantityMatch = lower.match(/(\d[\d,]*(?:\.\d+)?)\s*(metric\s*(?:tonnes?|tons?)|tonnes?|tons?|mt|kilograms?|kgs?|kg)\b/);
  let quantityKg: number | null = null;
  if (quantityMatch) {
    const amount = Number(quantityMatch[1].replace(/,/g, ''));
    quantityKg = /kg|kilogram/.test(quantityMatch[2]) ? amount : amount * 1000;
    facts.push({ field: 'quantity', value: `${quantityKg.toLocaleString()} kg`, confidence: 'high' });
  } else unresolved.push('Quantity');

  const originCountries = Object.entries(countries).filter(([name]) => lower.includes(name.replace('_', ' '))).map(([, code]) => code);
  if (originCountries.length) facts.push({ field: 'origin', value: [...new Set(originCountries)].join(', '), confidence: 'high' });

  const qualityRequirements: Record<string, unknown> = {};
  const moisture = lower.match(/moisture(?:\s+(?:maximum|max|below|under|≤|of))?\s*(\d+(?:\.\d+)?)\s*%?/);
  if (moisture) qualityRequirements.moistureMax = Number(moisture[1]);
  if (/fully[ -]fermented/.test(lower)) qualityRequirements.fermentation = 'fully fermented';
  const grade = text.match(/\bgrade\s+([A-Za-z0-9+-]+)/i);
  if (grade) qualityRequirements.grade = grade[1];
  const cropYear = lower.match(/crop\s+year\s+(20\d{2})/);
  if (cropYear) qualityRequirements.cropYear = Number(cropYear[1]);
  if (Object.keys(qualityRequirements).length) facts.push({ field: 'quality', value: Object.entries(qualityRequirements).map(([key, value]) => `${key}: ${value}`).join(' · '), confidence: 'high' });

  const assuranceRequirements: Record<string, unknown> = {};
  if (/\borganic\b/.test(lower) && !/non[- ]organic|conventional/.test(lower)) assuranceRequirements.organic = true;
  if (/plot[- ]level|plot geolocation|gps polygon|geolocation/.test(lower)) assuranceRequirements.plotGeolocation = true;
  if (/\beudr\b/.test(lower)) assuranceRequirements.eudrDataPack = true;
  if (/traceab/.test(lower)) assuranceRequirements.traceability = true;
  if (Object.keys(assuranceRequirements).length) facts.push({ field: 'assurance', value: Object.keys(assuranceRequirements).join(', '), confidence: 'high' });

  const incoterm = (text.match(/\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/i)?.[1] || 'CIF').toUpperCase();
  const deliveryMatch = text.match(/(?:delivered\s+to|delivery\s+to|destination(?:\s+is)?|into)\s+([^,.]+?)(?:\s+by\b|[,.;]|$)/i);
  const deliveryLocation = deliveryMatch?.[1]?.trim() || '';
  const dateMatch = text.match(/\b(?:by|required\s+by)\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(20\d{2}))?/i);
  let requiredBy = '';
  if (dateMatch) {
    const year = Number(dateMatch[3] || new Date().getUTCFullYear());
    const month = new Date(`${dateMatch[2]} 1, 2000`).getMonth() + 1;
    requiredBy = `${year}-${String(month).padStart(2, '0')}-${String(Number(dateMatch[1])).padStart(2, '0')}`;
  }
  if (!deliveryLocation) unresolved.push('Delivery location');
  if (!requiredBy) unresolved.push('Required date');
  const title = [assuranceRequirements.organic ? 'Organic' : '', titleCase(commodity || 'Material'), deliveryLocation ? `for ${deliveryLocation}` : ''].filter(Boolean).join(' ');
  return { title, commodity, quantityKg, originCountries: [...new Set(originCountries)], qualityRequirements, assuranceRequirements, deliveryLocation, incoterm, requiredBy, extractedFacts: facts, unresolved };
}
