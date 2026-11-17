'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Plus,
  Trash2,
  Link2,
  Utensils,
  Database,
  Scale,
} from 'lucide-react';
import {
  ConsumptionKind,
  FoodLogRecord,
  MealType,
  TransactionRecord,
  VerifiedFoodItem,
} from '@/lib/types';
import { VERIFIED_FOOD_REFERENCE_DB, matchLocalVerifiedFood } from '@/lib/nutrition-db';
import {
  computeNutritionFinanceCorrelation,
  formatDateID,
  formatIDR,
} from '@/lib/analytics-engine';

interface NutritionIntelligenceViewProps {
  foodLogs: FoodLogRecord[];
  transactions: TransactionRecord[];
  dailyCalorieTarget: number;
  dailyProteinTarget: number;
  referenceDate: string;
  onSaveFoodLog: (
    log: Omit<FoodLogRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    autoCreateExpense?: {
      create: boolean;
      accountId: string;
      paymentMethod: string;
    }
  ) => Promise<void>;
  onDeleteFoodLog: (id: string) => Promise<void>;
  defaultAccountId: string;
}

export function NutritionIntelligenceView({
  foodLogs,
  transactions,
  dailyCalorieTarget,
  dailyProteinTarget,
  referenceDate,
  onSaveFoodLog,
  onDeleteFoodLog,
  defaultAccountId,
}: NutritionIntelligenceViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string>('image/jpeg');
  const [portionNote, setPortionNote] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [disclaimerText, setDisclaimerText] = useState<string>('');

  // Editable draft before saving
  const [mealName, setMealName] = useState<string>('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [consumptionKind, setConsumptionKind] = useState<ConsumptionKind>('makan_utama');
  const [logDate, setLogDate] = useState<string>(referenceDate);
  const [logTime, setLogTime] = useState<string>('12:30');
  const [costAmount, setCostAmount] = useState<string>('18000');
  const [linkedTransactionId, setLinkedTransactionId] = useState<string>('');
  const [autoRecordTransaction, setAutoRecordTransaction] = useState<boolean>(true);
  const [draftItems, setDraftItems] = useState<VerifiedFoodItem[]>([]);
  const [manualDbId, setManualDbId] = useState<string>(VERIFIED_FOOD_REFERENCE_DB[0].dbId);
  const [manualGrams, setManualGrams] = useState<string>('150');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalysisError(null);
    if (file.size > 8 * 1024 * 1024) {
      setAnalysisError('Ukuran gambar melebihi batas 8 MB. Pilih foto dengan resolusi lebih kecil.');
      return;
    }
    setSelectedMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSampleReferencePhoto = async () => {
    setAnalysisError(null);
    try {
      const resp = await fetch('/assets/aistudio/image_2f5618d3.png');
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSelectedImagePreview(reader.result);
          setSelectedMimeType('image/png');
          setPortionNote('Satu porsi salad buah persik (peach), jagung manis, keju mozzarella, dan daun bayam/selada.');
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      setAnalysisError('Gagal memuat foto sampel lokal.');
    }
  };

  const handleRunAIAnalysis = async () => {
    if (!selectedImagePreview) {
      setAnalysisError('Silakan ambil foto atau unggah gambar makanan terlebih dahulu.');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError(null);
    setSaveSuccessMsg(null);

    try {
      const res = await fetch('/api/nutrition/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImagePreview,
          mimeType: selectedMimeType,
          portionNote,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAnalysisError(
          data.error ||
            'Analisis AI gagal dijalankan. Anda tetap dapat memilih komponen makanan terverifikasi dari database TKPI/USDA di bawah.'
        );
        return;
      }

      setMealName(data.mealName || 'Hidangan Teranalisis');
      if (['breakfast', 'lunch', 'dinner', 'snack', 'drinks'].includes(data.suggestedMealType)) {
        setMealType(data.suggestedMealType as MealType);
      }
      if (['makan_utama', 'jajan'].includes(data.suggestedConsumptionKind)) {
        setConsumptionKind(data.suggestedConsumptionKind as ConsumptionKind);
      }
      setDraftItems(Array.isArray(data.items) ? data.items : []);
      setDisclaimerText(data.disclaimer || '');
    } catch (err: unknown) {
      setAnalysisError(
        err instanceof Error
          ? err.message
          : 'Gagal terhubung ke endpoint analisis nutrisi AI.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddVerifiedComponentManually = () => {
    const entry = VERIFIED_FOOD_REFERENCE_DB.find((e) => e.dbId === manualDbId);
    if (!entry) return;
    const grams = Math.max(5, Number(manualGrams) || entry.defaultServingGrams);
    const matched = matchLocalVerifiedFood(entry.nameId, entry.aliases[0], grams, 0.98);
    if (matched) {
      setDraftItems((prev) => [...prev, matched]);
      if (!mealName) {
        setMealName(entry.nameId);
      }
    }
  };

  const handleUpdateServingGrams = (itemId: string, newGrams: number) => {
    const safeGrams = Math.max(1, Math.min(2500, newGrams));
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const oldGrams = Math.max(1, item.servingSize);
        const factor = safeGrams / oldGrams;
        return {
          ...item,
          servingSize: Math.round(safeGrams),
          calories: Math.round(item.calories * factor),
          protein: Number((item.protein * factor).toFixed(1)),
          carbs: Number((item.carbs * factor).toFixed(1)),
          fat: Number((item.fat * factor).toFixed(1)),
          fiber: Number((item.fiber * factor).toFixed(1)),
          sodium: Math.round(item.sodium * factor),
        };
      })
    );
  };

  const handleRemoveDraftItem = (itemId: string) => {
    setDraftItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const draftTotals = draftItems.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: Number((acc.protein + item.protein).toFixed(1)),
      carbs: Number((acc.carbs + item.carbs).toFixed(1)),
      fat: Number((acc.fat + item.fat).toFixed(1)),
      fiber: Number((acc.fiber + item.fiber).toFixed(1)),
      sodium: acc.sodium + item.sodium,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }
  );

  const handleConfirmSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalysisError(null);
    if (draftItems.length === 0) {
      setAnalysisError('Tambahkan minimal 1 komponen makanan terverifikasi sebelum menyimpan ke jurnal.');
      return;
    }
    const cleanMealName = mealName.trim() || draftItems.map((i) => i.foodName).join(', ');
    const parsedCost = Math.max(0, Math.round(Number(costAmount) || 0));

    const itemsSummary = draftItems
      .map((i) => `${i.foodName} (${i.servingSize}${i.servingUnit}: ${i.calories} kkal, ${i.protein}g P)`)
      .join('; ')
      .slice(0, 1450);

    const uniqueSources = Array.from(new Set(draftItems.map((i) => i.dataSource))).join(' | ');

    await onSaveFoodLog(
      {
        mealType,
        consumptionKind,
        mealName: cleanMealName.slice(0, 150),
        logDate,
        logTime,
        totalCalories: draftTotals.calories,
        totalProtein: draftTotals.protein,
        totalCarbs: draftTotals.carbs,
        totalFat: draftTotals.fat,
        totalFiber: draftTotals.fiber,
        totalSodium: draftTotals.sodium,
        costAmount: parsedCost,
        linkedTransactionId: linkedTransactionId || undefined,
        items: draftItems,
        itemsSummary,
        dataSourceSummary: uniqueSources.slice(0, 230) || 'TKPI Kemenkes RI & USDA FDC',
      },
      {
        create: autoRecordTransaction && !linkedTransactionId && parsedCost > 0,
        accountId: defaultAccountId,
        paymentMethod: 'QRIS / Dompet Utama',
      }
    );

    setDraftItems([]);
    setMealName('');
    setSaveSuccessMsg('Jurnal makanan & korelasi biaya berhasil disimpan ke database.');
  };

  // Daily Nutrition Dashboard Metrics for referenceDate
  const todayLogs = foodLogs.filter((l) => l.logDate === referenceDate);
  const dailyTotals = todayLogs.reduce(
    (acc, l) => ({
      calories: acc.calories + l.totalCalories,
      protein: Number((acc.protein + l.totalProtein).toFixed(1)),
      carbs: Number((acc.carbs + l.totalCarbs).toFixed(1)),
      fat: Number((acc.fat + l.totalFat).toFixed(1)),
      fiber: Number((acc.fiber + l.totalFiber).toFixed(1)),
      sodium: acc.sodium + l.totalSodium,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }
  );

  const correlation = computeNutritionFinanceCorrelation(transactions, foodLogs, referenceDate);

  return (
    <div className="space-y-8">
      {/* Top Daily Nutrition Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Kalori Harian ({formatDateID(referenceDate)})</div>
          <div className="text-xl font-bold font-mono tabular-nums text-neutral-900 dark:text-white mt-1">
            {dailyTotals.calories} <span className="text-xs font-normal text-neutral-400">/ {dailyCalorieTarget} kkal</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Protein Harian</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {dailyTotals.protein}g <span className="text-xs font-normal text-neutral-400">/ {dailyProteinTarget}g</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Karbohidrat</div>
          <div className="text-xl font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400 mt-1">
            {dailyTotals.carbs}g
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Lemak</div>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {dailyTotals.fat}g
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Serat &amp; Sodium</div>
          <div className="text-sm font-bold font-mono tabular-nums text-neutral-900 dark:text-white mt-1.5">
            {dailyTotals.fiber}g serat · {dailyTotals.sodium}mg Na
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Biaya / Gram Protein</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {correlation.costPerGramProtein !== null
              ? `${formatIDR(correlation.costPerGramProtein)}/g`
              : 'Belum ada data'}
          </div>
        </div>
      </div>

      {/* Main Split: Left AI Recognition & Verification Builder | Right Correlation & Meal History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: AI Food Photo Scanner & Nutrition Verification Table */}
        <div className="lg:col-span-7 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                AI Food Photo Recognition &amp; Verifikasi TKPI/USDA
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Gemini 4 Vision mendeteksi komponen makanan &amp; porsi; angka nutrisi dihitung dari database terverifikasi TKPI Kemenkes RI &amp; USDA FoodData Central.
              </p>
            </div>
          </div>

          {/* Camera / Gallery Upload Zone */}
          <div className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950/60 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Camera className="w-4 h-4" />
                Ambil Foto / Unggah Makanan
              </button>
              <button
                type="button"
                onClick={handleLoadSampleReferencePhoto}
                className="px-3.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                Gunakan Foto Referensi Makanan
              </button>
              {selectedImagePreview && (
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={handleRunAIAnalysis}
                  className="px-4 py-2 rounded-lg bg-neutral-900 dark:bg-emerald-500 text-white dark:text-neutral-950 text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAnalyzing ? 'Menganalisis via Gemini 4 & USDA...' : 'Analisis Foto dengan AI'}
                </button>
              )}
            </div>

            <div>
              <label htmlFor="portion-note-input" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Catatan Porsi Opsional (membantu akurasi estimasi berat visual):
              </label>
              <input
                id="portion-note-input"
                type="text"
                value={portionNote}
                onChange={(e) => setPortionNote(e.target.value)}
                placeholder="Contoh: Nasi setengah porsi (100g), ayam goreng bagian dada, tanpa kulit..."
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
              />
            </div>

            {selectedImagePreview && (
              <div className="relative w-full h-48 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-900">
                <Image
                  src={selectedImagePreview}
                  alt="Preview makanan yang akan dianalisis"
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>

          {analysisError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Pemberitahuan Analisis Jujur (Zero Fake Data Policy)</div>
                <div className="mt-0.5">{analysisError}</div>
              </div>
            </div>
          )}

          {saveSuccessMsg && (
            <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Direct Verified TKPI / USDA Component Selector (Always works & lets user add/edit components) */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span>Tambah / Koreksi Komponen dari Database Terverifikasi (TKPI Kemenkes RI &amp; USDA)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-7">
                <label htmlFor="tkpi-select" className="block text-[11px] text-neutral-500 mb-1">
                  Pilih Pangan Terverifikasi
                </label>
                <select
                  id="tkpi-select"
                  value={manualDbId}
                  onChange={(e) => setManualDbId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
                >
                  {VERIFIED_FOOD_REFERENCE_DB.map((entry) => (
                    <option key={entry.dbId} value={entry.dbId}>
                      [{entry.dbId}] {entry.nameId} — {entry.caloriesPer100g} kkal / {entry.proteinPer100g}g P per 100g
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="tkpi-grams" className="block text-[11px] text-neutral-500 mb-1">
                  Berat Porsi (gram)
                </label>
                <input
                  id="tkpi-grams"
                  type="number"
                  min={5}
                  max={2000}
                  value={manualGrams}
                  onChange={(e) => setManualGrams(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono tabular-nums text-neutral-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddVerifiedComponentManually}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah
                </button>
              </div>
            </div>
          </div>

          {/* Verified Component Table & Editable Form */}
          <form onSubmit={handleConfirmSaveLog} className="space-y-4">
            {draftItems.length > 0 && (
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-500">
                      <th className="py-2.5 px-3 font-medium">Komponen &amp; Sumber DB</th>
                      <th className="py-2.5 px-2 font-medium">Status</th>
                      <th className="py-2.5 px-2 font-medium text-right">Porsi (g)</th>
                      <th className="py-2.5 px-2 font-medium text-right">Kalori</th>
                      <th className="py-2.5 px-2 font-medium text-right">P / K / L</th>
                      <th className="py-2.5 px-2 font-medium text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {draftItems.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-neutral-900 dark:text-white">{item.foodName}</div>
                          <div className="text-[11px] text-neutral-500">
                            ID: {item.matchedDbId} · {item.dataSource}
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="text-[11px] text-neutral-600 dark:text-neutral-300">
                            {item.estimationStatus === 'verified_match'
                              ? 'Terverifikasi DB'
                              : item.estimationStatus === 'estimated_portion'
                              ? 'Estimasi Porsi'
                              : item.estimationStatus === 'uncertain_identification'
                              ? 'Perlu Konfirmasi'
                              : 'Data Belum Tersedia'}
                            {' · '}
                            {Math.round(item.confidenceScore * 100)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            aria-label={`Porsi gram untuk ${item.foodName}`}
                            value={item.servingSize}
                            onChange={(e) => handleUpdateServingGrams(item.id, Number(e.target.value))}
                            className="w-16 px-1.5 py-1 text-right rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono tabular-nums text-xs"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold">
                          {item.calories} kkal
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[11px]">
                          {item.protein}g / {item.carbs}g / {item.fat}g
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftItem(item.id)}
                            aria-label={`Hapus komponen ${item.foodName}`}
                            className="p-1 text-neutral-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-neutral-100/70 dark:bg-neutral-950 font-semibold text-neutral-900 dark:text-white">
                      <td colSpan={3} className="py-2.5 px-3">
                        Total Kandungan Nutrisi Hidangan
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {draftTotals.calories} kkal
                      </td>
                      <td colSpan={2} className="py-2.5 px-2 text-right font-mono tabular-nums">
                        {draftTotals.protein}g P · {draftTotals.carbs}g K · {draftTotals.fat}g L
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {disclaimerText && (
              <p className="text-[11px] text-neutral-500 italic">{disclaimerText}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label htmlFor="meal-name-input" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Nama Makanan / Hidangan
                </label>
                <input
                  id="meal-name-input"
                  type="text"
                  required
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  placeholder="Contoh: Nasi Putih, Ayam Goreng & Sayur Bayam"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="meal-cost-input" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Biaya Makanan (Rp) — Korelasi Finansial
                </label>
                <input
                  id="meal-cost-input"
                  type="number"
                  min={0}
                  value={costAmount}
                  onChange={(e) => setCostAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono tabular-nums text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="meal-type-select" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Waktu Makan
                </label>
                <select
                  id="meal-type-select"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
                >
                  <option value="breakfast">Breakfast (Sarapan)</option>
                  <option value="lunch">Lunch (Makan Siang)</option>
                  <option value="dinner">Dinner (Makan Malam)</option>
                  <option value="snack">Snack (Camilan / Jajan)</option>
                  <option value="drinks">Drinks (Minuman / Kopi)</option>
                </select>
              </div>

              <div>
                <label htmlFor="consumption-kind-select" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Identitas Konsumsi (Pisahkan Makan Utama vs Jajan)
                </label>
                <select
                  id="consumption-kind-select"
                  value={consumptionKind}
                  onChange={(e) => setConsumptionKind(e.target.value as ConsumptionKind)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
                >
                  <option value="makan_utama">Makan Utama (Kategori: Makanan)</option>
                  <option value="jajan">Jajan / Kopi / Camilan (Kategori: Jajan)</option>
                </select>
              </div>

              <div>
                <label htmlFor="meal-date-input" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Tanggal &amp; Waktu Konsumsi
                </label>
                <div className="flex gap-2">
                  <input
                    id="meal-date-input"
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
                  />
                  <input
                    type="time"
                    aria-label="Waktu konsumsi"
                    value={logTime}
                    onChange={(e) => setLogTime(e.target.value)}
                    className="w-28 px-2.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="link-tx-select" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Hubungkan Transaksi Keuangan
                </label>
                <select
                  id="link-tx-select"
                  value={linkedTransactionId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLinkedTransactionId(val);
                    const found = transactions.find((t) => t.id === val);
                    if (found) setCostAmount(String(found.amount));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
                >
                  <option value="">Buat transaksi pengeluaran otomatis saat disimpan</option>
                  {transactions
                    .filter((t) => t.type === 'expense')
                    .slice(0, 15)
                    .map((tx) => (
                      <option key={tx.id} value={tx.id}>
                        {tx.transactionDate} · {tx.description} ({formatIDR(tx.amount)})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {!linkedTransactionId && (
              <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRecordTransaction}
                  onChange={(e) => setAutoRecordTransaction(e.target.checked)}
                  className="rounded accent-emerald-600"
                />
                <span>
                  Otomatis catat biaya makanan ini ({formatIDR(Number(costAmount) || 0)}) ke Transaksi Keuangan ({consumptionKind === 'makan_utama' ? 'Kategori: Makanan' : 'Kategori: Jajan'})
                </span>
              </label>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Utensils className="w-4 h-4" />
              Simpan ke Food Journal &amp; Hubungkan Transaksi
            </button>
          </form>
        </div>

        {/* Right Column: Financial & Nutrition Correlation + Meal Journal */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-500" />
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Financial &amp; Nutrition Correlation
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800">
                <div className="text-neutral-500">Rata-rata Biaya Makan/Hari</div>
                <div className="text-base font-bold font-mono tabular-nums text-neutral-900 dark:text-white mt-0.5">
                  {formatIDR(correlation.averageDailyFoodCost)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800">
                <div className="text-neutral-500">Jajan Bulan Ini vs Makan</div>
                <div className="text-base font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                  {formatIDR(correlation.monthlyJajanSpend)}
                </div>
                <div className="text-[11px] text-neutral-400 font-mono tabular-nums">
                  Makan Utama: {formatIDR(correlation.monthlyMakananSpend)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Perbandingan Biaya &amp; Nutrisi per Waktu Makan
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden text-xs">
                {correlation.mealTypeCostComparison.map((row) => (
                  <div key={row.mealType} className="px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-white">{row.label}</div>
                      <div className="text-[11px] text-neutral-500">
                        {row.count}x tercatat · Rata-rata {row.avgCalories} kkal ({row.avgProtein}g P)
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {formatIDR(row.totalCost)}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        Avg {formatIDR(row.avgCost)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 leading-relaxed">
              {correlation.calculationMethodNote}
            </p>
          </div>

          {/* Food Journal History */}
          <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Riwayat Food Journal ({foodLogs.length})
            </h3>
            {foodLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500">
                Belum ada catatan makanan di database. Unggah foto makanan atau pilih komponen TKPI di samping untuk mencatat hidangan pertama Anda.
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {foodLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {log.mealName}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {formatDateID(log.logDate)} · {log.logTime} ·{' '}
                        {log.consumptionKind === 'makan_utama' ? 'Makan Utama' : 'Jajan / Camilan'} ·{' '}
                        <span className="font-mono tabular-nums font-medium text-neutral-800 dark:text-neutral-200">
                          {formatIDR(log.costAmount)}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {log.totalCalories} kkal · {log.totalProtein}g Protein · {log.totalCarbs}g Karbo · {log.totalFat}g Lemak
                      </div>
                      <div className="text-[11px] text-neutral-500">{log.itemsSummary}</div>
                      <div className="text-[10px] text-neutral-400 flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        Sumber: {log.dataSourceSummary}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteFoodLog(log.id)}
                      aria-label={`Hapus catatan makanan ${log.mealName}`}
                      className="p-1.5 text-neutral-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
