import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { matchLocalVerifiedFood } from '@/lib/nutrition-db';
import { EstimationStatus, VerifiedFoodItem } from '@/lib/types';

interface USDAFoodNutrient {
  nutrientId?: number;
  nutrientName?: string;
  value?: number;
}

interface USDASearchFood {
  fdcId: number;
  description: string;
  foodNutrients?: USDAFoodNutrient[];
}

async function queryUSDAFoodDataCentral(
  englishQuery: string,
  detectedName: string,
  estimatedGrams: number,
  confidenceScore: number
): Promise<VerifiedFoodItem | null> {
  const apiKey = process.env.USDA_API_KEY || 'DEMO_KEY';
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
    apiKey
  )}&query=${encodeURIComponent(englishQuery)}&pageSize=1&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const firstFood: USDASearchFood | undefined = data?.foods?.[0];
    if (!firstFood || !Array.isArray(firstFood.foodNutrients)) return null;

    const findNutrient = (ids: number[], nameSubstr: string): number => {
      const found = firstFood.foodNutrients?.find(
        (n) =>
          (n.nutrientId && ids.includes(n.nutrientId)) ||
          (n.nutrientName && n.nutrientName.toLowerCase().includes(nameSubstr))
      );
      return Number(found?.value || 0);
    };

    const cal100 = findNutrient([1008, 2047], 'energy');
    const prot100 = findNutrient([1003], 'protein');
    const carb100 = findNutrient([1005], 'carbohydrate');
    const fat100 = findNutrient([1004], 'total lipid');
    const fiber100 = findNutrient([1079], 'fiber');
    const sodium100 = findNutrient([1093], 'sodium');

    const grams = estimatedGrams > 0 ? estimatedGrams : 100;
    const ratio = grams / 100;

    let status: EstimationStatus = 'verified_match';
    if (confidenceScore < 0.65) status = 'uncertain_identification';
    else if (confidenceScore < 0.85) status = 'estimated_portion';

    return {
      id: `USDA-${firstFood.fdcId}-${Math.random().toString(36).slice(2, 6)}`,
      foodName: detectedName,
      matchedDbId: `USDA-FDC-${firstFood.fdcId}`,
      matchedDbName: firstFood.description,
      servingSize: Math.round(grams),
      servingUnit: 'g',
      calories: Math.round(cal100 * ratio),
      protein: Number((prot100 * ratio).toFixed(1)),
      carbs: Number((carb100 * ratio).toFixed(1)),
      fat: Number((fat100 * ratio).toFixed(1)),
      fiber: Number((fiber100 * ratio).toFixed(1)),
      sodium: Math.round(sodium100 * ratio),
      dataSource: `USDA FoodData Central (FDC #${firstFood.fdcId})`,
      confidenceScore: Number(confidenceScore.toFixed(2)),
      estimationStatus: status,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY belum dikonfigurasi pada server. Silakan atur GEMINI_API_KEY di panel Settings > Secrets untuk mengaktifkan analisis visual AI.',
          code: 'MISSING_API_KEY',
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { imageBase64, mimeType, portionNote } = body as {
      imageBase64?: string;
      mimeType?: string;
      portionNote?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Gambar makanan (base64) wajib disertakan untuk dianalisis.' },
        { status: 400 }
      );
    }

    // Validate base64 size (~8MB limit)
    if (imageBase64.length > 11_000_000) {
      return NextResponse.json(
        { error: 'Ukuran gambar terlalu besar. Maksimal ukuran foto adalah 8 MB.' },
        { status: 413 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const promptText = `Anda adalah sistem pengenalan komponen makanan visual untuk platform MoneyScope Indonesia.
Tugas Anda HANYA mengidentifikasi nama hidangan utama dan setiap komponen makanan yang terlihat pada foto beserta estimasi berat porsi dalam satuan gram (g) dan tingkat keyakinan visual (confidenceScore 0.0 - 1.0).
JANGAN mengarang angka nutrisi (kalori/protein/lemak) karena nilai nutrisi akan dihitung dari database terverifikasi TKPI Kemenkes RI & USDA FoodData Central.
Catatan tambahan dari pengguna: ${portionNote ? portionNote : 'Tidak ada catatan khusus.'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mealName: {
              type: Type.STRING,
              description: 'Nama hidangan keseluruhan dalam Bahasa Indonesia, contoh: Nasi Ayam Goreng & Sayur Bayam',
            },
            suggestedMealType: {
              type: Type.STRING,
              description: 'Salah satu dari: breakfast, lunch, dinner, snack, drinks',
            },
            suggestedConsumptionKind: {
              type: Type.STRING,
              description: 'Salah satu dari: makan_utama, jajan',
            },
            components: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  foodNameId: {
                    type: Type.STRING,
                    description: 'Nama komponen makanan dalam Bahasa Indonesia (contoh: Nasi Putih, Ayam Goreng, Sayur Bayam)',
                  },
                  usdaSearchQuery: {
                    type: Type.STRING,
                    description: 'Kata kunci pencarian bahasa Inggris untuk USDA FoodData Central (contoh: cooked white rice, fried chicken breast, boiled spinach)',
                  },
                  estimatedServingGrams: {
                    type: Type.NUMBER,
                    description: 'Estimasi berat porsi komponen dalam gram (g) berdasarkan visual',
                  },
                  confidenceScore: {
                    type: Type.NUMBER,
                    description: 'Skor keyakinan identifikasi visual antara 0.0 hingga 1.0',
                  },
                },
                required: ['foodNameId', 'usdaSearchQuery', 'estimatedServingGrams', 'confidenceScore'],
              },
            },
          },
          required: ['mealName', 'suggestedMealType', 'suggestedConsumptionKind', 'components'],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText) as {
      mealName?: string;
      suggestedMealType?: string;
      suggestedConsumptionKind?: string;
      components?: {
        foodNameId: string;
        usdaSearchQuery: string;
        estimatedServingGrams: number;
        confidenceScore: number;
      }[];
    };

    const detectedComponents = Array.isArray(parsed.components) ? parsed.components : [];
    if (detectedComponents.length === 0) {
      return NextResponse.json(
        {
          error:
            'Tidak ditemukan komponen makanan yang dapat dikenali secara meyakinkan pada foto. Pastikan foto menampilkan makanan dengan pencahayaan cukup.',
        },
        { status: 422 }
      );
    }

    const verifiedItems: VerifiedFoodItem[] = [];

    for (const comp of detectedComponents) {
      // 1. Check verified Indonesian TKPI & USDA reference database first for exact Indonesian dishes
      let matchedItem = matchLocalVerifiedFood(
        comp.foodNameId,
        comp.usdaSearchQuery,
        comp.estimatedServingGrams,
        comp.confidenceScore
      );

      // 2. If not in local TKPI reference, query live USDA FoodData Central API
      if (!matchedItem) {
        matchedItem = await queryUSDAFoodDataCentral(
          comp.usdaSearchQuery,
          comp.foodNameId,
          comp.estimatedServingGrams,
          comp.confidenceScore
        );
      }

      // 3. If neither database has a match, mark explicitly as unavailable_data (NEVER invent nutrition values!)
      if (!matchedItem) {
        verifiedItems.push({
          id: `UNMATCHED-${Math.random().toString(36).slice(2, 7)}`,
          foodName: comp.foodNameId,
          matchedDbId: 'UNVERIFIED',
          matchedDbName: 'Data nutrisi belum terverifikasi di database TKPI/USDA',
          servingSize: Math.round(comp.estimatedServingGrams || 100),
          servingUnit: 'g',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sodium: 0,
          dataSource: 'Tidak tersedia di TKPI / USDA (Silakan pilih komponen manual)',
          confidenceScore: Number((comp.confidenceScore || 0.5).toFixed(2)),
          estimationStatus: 'unavailable_data',
        });
      } else {
        verifiedItems.push(matchedItem);
      }
    }

    return NextResponse.json({
      mealName: parsed.mealName || 'Hidangan Terdeteksi',
      suggestedMealType: parsed.suggestedMealType || 'lunch',
      suggestedConsumptionKind: parsed.suggestedConsumptionKind || 'makan_utama',
      items: verifiedItems,
      disclaimer:
        'Estimasi porsi dihitung secara visual menggunakan Gemini 4 Vision dan dicocokkan terhadap database nutrisi terverifikasi (TKPI Kemenkes RI & USDA FoodData Central). Bukan hasil pengukuran laboratorium.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menganalisis foto makanan.';
    return NextResponse.json(
      {
        error: `Gagal memproses analisis foto makanan: ${message}`,
      },
      { status: 500 }
    );
  }
}
