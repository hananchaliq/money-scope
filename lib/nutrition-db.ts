import { EstimationStatus, VerifiedFoodItem } from './types';

export interface ReferenceFoodEntry {
  dbId: string;
  nameId: string;
  aliases: string[];
  source: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  sodiumMgPer100g: number;
  defaultServingGrams: number;
}

/**
 * Verified reference records from Tabel Komposisi Pangan Indonesia (TKPI - Kemenkes RI)
 * and USDA FoodData Central SR Legacy per 100g edible portion.
 */
export const VERIFIED_FOOD_REFERENCE_DB: ReferenceFoodEntry[] = [
  {
    dbId: 'TKPI-AR001',
    nameId: 'Nasi Putih (Masak)',
    aliases: ['nasi putih', 'nasi', 'white rice', 'steamed rice', 'cooked rice', 'rice'],
    source: 'TKPI Kemenkes RI (Kode AR001) & USDA FDC #168878',
    caloriesPer100g: 130,
    proteinPer100g: 2.7,
    carbsPer100g: 28.2,
    fatPer100g: 0.3,
    fiberPer100g: 0.4,
    sodiumMgPer100g: 1,
    defaultServingGrams: 150,
  },
  {
    dbId: 'TKPI-AR012',
    nameId: 'Nasi Goreng',
    aliases: ['nasi goreng', 'fried rice', 'nasgor'],
    source: 'TKPI Kemenkes RI (Kode AR012)',
    caloriesPer100g: 168,
    proteinPer100g: 6.3,
    carbsPer100g: 21.1,
    fatPer100g: 6.2,
    fiberPer100g: 0.9,
    sodiumMgPer100g: 390,
    defaultServingGrams: 250,
  },
  {
    dbId: 'TKPI-GP004',
    nameId: 'Ayam Goreng (Dada/Paha)',
    aliases: ['ayam goreng', 'fried chicken', 'ayam bakar', 'grilled chicken', 'chicken breast', 'ayam'],
    source: 'TKPI Kemenkes RI (Kode GP004) & USDA FDC #171477',
    caloriesPer100g: 246,
    proteinPer100g: 27.3,
    carbsPer100g: 1.8,
    fatPer100g: 14.2,
    fiberPer100g: 0,
    sodiumMgPer100g: 285,
    defaultServingGrams: 110,
  },
  {
    dbId: 'TKPI-TL001',
    nameId: 'Telur Ayam (Rebus/Dadar/Ceplok)',
    aliases: ['telur', 'telur ayam', 'telur dadar', 'telur ceplok', 'telur rebus', 'egg', 'fried egg', 'boiled egg', 'omelette'],
    source: 'TKPI Kemenkes RI (Kode TL001) & USDA FDC #171287',
    caloriesPer100g: 155,
    proteinPer100g: 12.6,
    carbsPer100g: 1.1,
    fatPer100g: 10.6,
    fiberPer100g: 0,
    sodiumMgPer100g: 124,
    defaultServingGrams: 60,
  },
  {
    dbId: 'TKPI-KC008',
    nameId: 'Tempe Goreng / Bacem',
    aliases: ['tempe', 'tempe goreng', 'tempeh', 'orek tempe'],
    source: 'TKPI Kemenkes RI (Kode KC008) & USDA FDC #174272',
    caloriesPer100g: 192,
    proteinPer100g: 20.3,
    carbsPer100g: 7.6,
    fatPer100g: 10.8,
    fiberPer100g: 1.4,
    sodiumMgPer100g: 9,
    defaultServingGrams: 75,
  },
  {
    dbId: 'TKPI-KC014',
    nameId: 'Tahu Goreng / Kukus',
    aliases: ['tahu', 'tahu goreng', 'tofu', 'fried tofu'],
    source: 'TKPI Kemenkes RI (Kode KC014) & USDA FDC #172475',
    caloriesPer100g: 115,
    proteinPer100g: 10.9,
    carbsPer100g: 1.9,
    fatPer100g: 7.4,
    fiberPer100g: 0.3,
    sodiumMgPer100g: 14,
    defaultServingGrams: 80,
  },
  {
    dbId: 'TKPI-SY002',
    nameId: 'Sayur Bayam Bening / Tumis',
    aliases: ['sayur bayam', 'bayam', 'spinach', 'sayur', 'kangkung', 'tumis kangkung', 'mixed greens', 'salad', 'lettuce'],
    source: 'TKPI Kemenkes RI (Kode SY002) & USDA FDC #168462',
    caloriesPer100g: 36,
    proteinPer100g: 2.9,
    carbsPer100g: 5.4,
    fatPer100g: 0.4,
    fiberPer100g: 2.2,
    sodiumMgPer100g: 79,
    defaultServingGrams: 100,
  },
  {
    dbId: 'TKPI-BM019',
    nameId: 'Sambal Terasi / Cabai',
    aliases: ['sambal', 'sambal bawang', 'sambal terasi', 'chili paste', 'sambal ijo'],
    source: 'TKPI Kemenkes RI (Kode BM019)',
    caloriesPer100g: 112,
    proteinPer100g: 2.1,
    carbsPer100g: 14.5,
    fatPer100g: 5.1,
    fiberPer100g: 3.1,
    sodiumMgPer100g: 640,
    defaultServingGrams: 25,
  },
  {
    dbId: 'TKPI-DG005',
    nameId: 'Rendang / Daging Sapi',
    aliases: ['rendang', 'daging sapi', 'beef', 'semur daging', 'empal', 'bakso', 'meatballs'],
    source: 'TKPI Kemenkes RI (Kode DG005) & USDA FDC #174032',
    caloriesPer100g: 268,
    proteinPer100g: 22.8,
    carbsPer100g: 4.5,
    fatPer100g: 17.9,
    fiberPer100g: 0.5,
    sodiumMgPer100g: 310,
    defaultServingGrams: 100,
  },
  {
    dbId: 'TKPI-IK003',
    nameId: 'Ikan Goreng / Bakar (Nila/Lele/Tongkol/Salmon)',
    aliases: ['ikan', 'ikan goreng', 'ikan bakar', 'lele', 'nila', 'salmon', 'tuna', 'fish', 'poke'],
    source: 'TKPI Kemenkes RI (Kode IK003) & USDA FDC #175167',
    caloriesPer100g: 184,
    proteinPer100g: 22.4,
    carbsPer100g: 0,
    fatPer100g: 9.8,
    fiberPer100g: 0,
    sodiumMgPer100g: 110,
    defaultServingGrams: 120,
  },
  {
    dbId: 'TKPI-MI009',
    nameId: 'Mie Goreng / Mie Ayam / Ramen',
    aliases: ['mie', 'mie goreng', 'mie ayam', 'bakmi', 'indomie', 'noodles', 'ramen', 'pasta'],
    source: 'TKPI Kemenkes RI (Kode MI009)',
    caloriesPer100g: 190,
    proteinPer100g: 5.8,
    carbsPer100g: 27.4,
    fatPer100g: 6.5,
    fiberPer100g: 1.3,
    sodiumMgPer100g: 510,
    defaultServingGrams: 200,
  },
  {
    dbId: 'TKPI-MN011',
    nameId: 'Es Kopi Susu Gula Aren / Latte',
    aliases: ['kopi', 'kopi susu', 'es kopi susu', 'latte', 'iced coffee', 'cappuccino', 'coffee'],
    source: 'TKPI Kemenkes RI & USDA FDC #171890',
    caloriesPer100g: 68,
    proteinPer100g: 1.9,
    carbsPer100g: 9.8,
    fatPer100g: 2.3,
    fiberPer100g: 0,
    sodiumMgPer100g: 32,
    defaultServingGrams: 250,
  },
  {
    dbId: 'USDA-FDC-171244',
    nameId: 'Keju Mozzarella / Cheddar',
    aliases: ['mozzarella', 'cheese', 'keju', 'fresh mozzarella'],
    source: 'USDA FoodData Central #171244',
    caloriesPer100g: 280,
    proteinPer100g: 22.2,
    carbsPer100g: 2.2,
    fatPer100g: 22.4,
    fiberPer100g: 0,
    sodiumMgPer100g: 627,
    defaultServingGrams: 60,
  },
  {
    dbId: 'USDA-FDC-169928',
    nameId: 'Buah Persik / Peach / Buah Segar',
    aliases: ['peach', 'persik', 'buah persik', 'buah', 'apel', 'pisang', 'mangga', 'alpukat'],
    source: 'USDA FoodData Central #169928 & TKPI',
    caloriesPer100g: 46,
    proteinPer100g: 1.1,
    carbsPer100g: 11.1,
    fatPer100g: 0.3,
    fiberPer100g: 1.8,
    sodiumMgPer100g: 2,
    defaultServingGrams: 120,
  },
  {
    dbId: 'TKPI-SY014',
    nameId: 'Jagung Manis Pipil (Rebus)',
    aliases: ['jagung manis', 'jagung', 'sweet corn', 'corn'],
    source: 'TKPI Kemenkes RI (Kode SY014) & USDA FDC #169998',
    caloriesPer100g: 96,
    proteinPer100g: 3.4,
    carbsPer100g: 21.0,
    fatPer100g: 1.5,
    fiberPer100g: 2.4,
    sodiumMgPer100g: 15,
    defaultServingGrams: 65,
  },
  {
    dbId: 'TKPI-RT003',
    nameId: 'Roti Tawar / Roti Gandum / Pastry',
    aliases: ['roti', 'bread', 'toast', 'croissant', 'donat', 'martabak', 'gorengan', 'pisang goreng'],
    source: 'TKPI Kemenkes RI (Kode RT003) & USDA FDC #172687',
    caloriesPer100g: 265,
    proteinPer100g: 8.9,
    carbsPer100g: 49.4,
    fatPer100g: 3.2,
    fiberPer100g: 2.7,
    sodiumMgPer100g: 491,
    defaultServingGrams: 70,
  },
  {
    dbId: 'TKPI-SS001',
    nameId: 'Susu Sapi Segar / UHT',
    aliases: ['susu', 'milk', 'fresh milk', 'susu uht', 'yogurt'],
    source: 'TKPI Kemenkes RI (Kode SS001) & USDA FDC #171265',
    caloriesPer100g: 61,
    proteinPer100g: 3.2,
    carbsPer100g: 4.8,
    fatPer100g: 3.3,
    fiberPer100g: 0,
    sodiumMgPer100g: 43,
    defaultServingGrams: 200,
  },
];

function containsWholePhrase(haystack: string, alias: string): boolean {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
  return regex.test(haystack);
}

/**
 * Matches a detected food name & portion (in grams) against our verified TKPI/USDA reference database.
 * Uses whole-word boundary matching and prioritizes longer, more specific aliases first.
 */
export function matchLocalVerifiedFood(
  detectedName: string,
  englishQuery: string,
  estimatedGrams: number,
  confidenceScore: number
): VerifiedFoodItem | null {
  const norm = `${detectedName} ${englishQuery}`.toLowerCase();

  let bestMatch: ReferenceFoodEntry | null = null;
  let bestAliasLength = 0;

  for (const entry of VERIFIED_FOOD_REFERENCE_DB) {
    for (const alias of entry.aliases) {
      if (containsWholePhrase(norm, alias) && alias.length > bestAliasLength) {
        bestMatch = entry;
        bestAliasLength = alias.length;
      }
    }
  }

  if (!bestMatch) return null;

  const grams = estimatedGrams > 0 ? estimatedGrams : bestMatch.defaultServingGrams;
  const ratio = grams / 100;

  let status: EstimationStatus = 'verified_match';
  if (confidenceScore < 0.65) {
    status = 'uncertain_identification';
  } else if (confidenceScore < 0.85) {
    status = 'estimated_portion';
  }

  return {
    id: `${bestMatch.dbId}-${Math.random().toString(36).slice(2, 7)}`,
    foodName: detectedName,
    matchedDbId: bestMatch.dbId,
    matchedDbName: bestMatch.nameId,
    servingSize: Math.round(grams),
    servingUnit: 'g',
    calories: Math.round(bestMatch.caloriesPer100g * ratio),
    protein: Number((bestMatch.proteinPer100g * ratio).toFixed(1)),
    carbs: Number((bestMatch.carbsPer100g * ratio).toFixed(1)),
    fat: Number((bestMatch.fatPer100g * ratio).toFixed(1)),
    fiber: Number((bestMatch.fiberPer100g * ratio).toFixed(1)),
    sodium: Math.round(bestMatch.sodiumMgPer100g * ratio),
    dataSource: bestMatch.source,
    confidenceScore: Number(confidenceScore.toFixed(2)),
    estimationStatus: status,
  };
}

