'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
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
  const [costAmount, setCostAmount] = useState<string>('28000');
  const [linkedTransactionId, setLinkedTransactionId] = useState<string>('');
  const [autoRecordTransaction, setAutoRecordTransaction] = useState<boolean>(true);
  const [draftItems, setDraftItems] = useState<VerifiedFoodItem[]>([]);
  const [manualDbId, setManualDbId] = useState<string>(VERIFIED_FOOD_REFERENCE_DB[0].dbId);
  const [manualGrams, setManualGrams] = useState<string>('150');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const executePhotoAnalysis = async (
    imageDataUrl: string,
    mime: string,
    noteText: string
  ) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setSaveSuccessMsg(null);

    try {
      const res = await fetch('/api/nutrition/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageDataUrl,
          mimeType: mime,
          portionNote: noteText,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAnalysisError(
          data.error ||
            'Tidak dapat memproses gambar saat ini. Silakan pilih atau tambah komponen makanan dari katalog TKPI/USDA di bawah.'
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
    } catch {
      setAnalysisError(
        'Terjadi kendala jaringan saat menganalisis foto. Anda tetap dapat memilih komponen makanan dari database TKPI/USDA di bawah.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalysisError(null);
    if (file.size > 8 * 1024 * 1024) {
      setAnalysisError('Ukuran gambar melebihi batas 8 MB. Pilih foto dengan resolusi lebih kecil.');
      return;
    }
    const mime = file.type || 'image/jpeg';
    setSelectedMimeType(mime);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedImagePreview(reader.result);
        void executePhotoAnalysis(reader.result, mime, portionNote);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSampleReferencePhoto = async () => {
    setAnalysisError(null);
    const sampleNote =
      'Satu porsi salad buah persik (peach), jagung manis, keju mozzarella, dan daun bayam/selada.';
    setPortionNote(sampleNote);
    try {
      const resp = await fetch('/assets/aistudio/image_2f5618d3.png');
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSelectedImagePreview(reader.result);
          setSelectedMimeType('image/png');
          void executePhotoAnalysis(reader.result, 'image/png', sampleNote);
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
    await executePhotoAnalysis(selectedImagePreview, selectedMimeType, portionNote);
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
      setAnalysisError('Tambahkan minimal 1 komponen makanan sebelum menyimpan ke jurnal.');
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
    setSaveSuccessMsg('Jurnal makanan & biaya berhasil disimpan.');
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
    <div className="space-y-6">
      {/* Top Daily Nutrition Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <div className="p-3.5 sm:p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121716]">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
            Kalori Harian ({formatDateID(referenceDate)})
          </div>
          <div className="text-base sm:text-xl font-bold font-mono tabular-nums text-neutral-900 dark:text-white mt-1 whitespace-nowrap">
            {dailyTotals.calories}{' '}
            <span className="text-[11px] font-normal text-neutral-400">/ {dailyCalorieTarget} kkal</span>
          </div>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121716]">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
            Protein Harian
          </div>
          <div className="text-base sm:text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1 whitespace-nowrap">
            {dailyTotals.protein}g{' '}
            <span className="text-[11px] font-normal text-neutral-400">/ {dailyProteinTarget}g</span>
          </div>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121716]">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
            Karbohidrat
          </div>
          <div className="text-base sm:text-xl font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400 mt-1 whitespace-nowrap">
            {dailyTotals.carbs}g
          </div>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121716]">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">Lemak</div>
          <div className="text-base sm:text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1 whitespace-nowrap">
            {dailyTotals.fat}g
          </div>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121716]">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
            Serat &amp; Natrium
          </div>
          <div className="text-xs sm:text-sm font-bold font-mono tabular-nums text-neutral-900 dark:text-white mt-1.5 whitespace-nowrap">
            {dailyTotals.fiber}g · {dailyTotals.sodium}mg
          </div>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121716]">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
            Biaya / Gram Protein
          </div>
          <div className="text-sm sm:text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1 whitespace-nowrap">
            {correlation.costPerGramProtein !== null
              ? `${formatIDR(correlation.costPerGramProtein)}/g`
              : 'Belum ada data'}
          </div>
        </div>
      </div>

      {/* Main Split: Left AI Recognition & Verification Builder | Right Correlation & Meal History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: AI Food Photo Scanner & Nutrition Verification Table */}
        <div className="lg:col-span-7 p-4 sm:p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121716] space-y-5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
              Pemindai Nutrisi Makanan &amp; Kalkulator Makro
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
              Unggah foto hidangan untuk mendeteksi porsi makanan secara otomatis dan mencocokkan kandungan gizi dari Tabel Komposisi Pangan Indonesia (TKPI Kemenkes RI) &amp; USDA.
            </p>
          </div>

          {/* Camera / Gallery Upload Zone */}
          <div className="p-3.5 sm:p-4 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950/60 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Camera className="w-4 h-4" />
                Ambil / Unggah Foto
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleLoadSampleReferencePhoto}
                className="px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                Gunakan Foto Referensi Makanan
              </motion.button>
              {selectedImagePreview && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={isAnalyzing}
                  onClick={handleRunAIAnalysis}
                  className="px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-emerald-500/20 dark:border dark:border-emerald-500/40 text-white dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAnalyzing ? 'Menganalisis Nutrisi...' : 'Analisis Foto dengan AI'}
                </motion.button>
              )}
            </div>

            <div>
              <label
                htmlFor="portion-note-input"
                className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1"
              >
                Catatan Komponen / Porsi (opsional):
              </label>
              <input
                id="portion-note-input"
                type="text"
                value={portionNote}
                onChange={(e) => setPortionNote(e.target.value)}
                placeholder="Contoh: Nasi putih 150g, ayam bakar dada, sayur bayam..."
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
              />
            </div>

            {selectedImagePreview && (
              <div className="relative w-full h-52 sm:h-60 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-900">
                <Image
                  src={selectedImagePreview}
                  alt="Pratinjau makanan yang dianalisis"
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
                {/* Nutrinova-style Floating Macro Badges when items are analyzed */}
                {draftItems.length > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent flex flex-col justify-between p-3.5 pointer-events-none">
                    <div className="flex flex-wrap gap-1.5">
                      <motion.span
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="px-2.5 py-1 rounded-full bg-white/95 text-neutral-950 text-[11px] font-bold shadow-md backdrop-blur-md"
                      >
                        Protein · {draftTotals.protein}g
                      </motion.span>
                      <motion.span
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="px-2.5 py-1 rounded-full bg-white/95 text-neutral-950 text-[11px] font-bold shadow-md backdrop-blur-md"
                      >
                        Carbs · {draftTotals.carbs}g
                      </motion.span>
                      <motion.span
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="px-2.5 py-1 rounded-full bg-white/95 text-neutral-950 text-[11px] font-bold shadow-md backdrop-blur-md"
                      >
                        Fats · {draftTotals.fat}g
                      </motion.span>
                    </div>
                    <div className="flex items-end justify-between text-white">
                      <div>
                        <div className="text-[11px] text-emerald-300 font-semibold">
                          Terverifikasi TKPI &amp; USDA
                        </div>
                        <div className="text-sm font-bold truncate max-w-[240px] sm:max-w-xs">
                          {mealName || 'Hidangan Terdeteksi'}
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-emerald-500 text-neutral-950 font-mono font-bold text-xs shadow">
                        {draftTotals.calories} kkal
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <AnimatePresence>
            {analysisError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                role="alert"
                className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Informasi Analisis Nutrisi</div>
                  <div className="mt-0.5">{analysisError}</div>
                </div>
              </motion.div>
            )}

            {saveSuccessMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Direct Verified TKPI / USDA Component Selector */}
          <div className="p-3.5 sm:p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              <Database className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Tambah Komponen dari Katalog Gizi (TKPI Kemenkes RI &amp; USDA)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-7">
                <label htmlFor="tkpi-select" className="block text-[11px] text-neutral-500 mb-1">
                  Pilih Komponen Makanan
                </label>
                <select
                  id="tkpi-select"
                  value={manualDbId}
                  onChange={(e) => setManualDbId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
                >
                  {VERIFIED_FOOD_REFERENCE_DB.map((entry) => (
                    <option key={entry.dbId} value={entry.dbId}>
                      {entry.nameId} ({entry.caloriesPer100g} kkal / {entry.proteinPer100g}g P per 100g)
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
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono tabular-nums text-neutral-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddVerifiedComponentManually}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
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
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-500">
                      <th className="py-2.5 px-3 font-medium">Komponen Makanan</th>
                      <th className="py-2.5 px-2 font-medium text-right">Porsi (g)</th>
                      <th className="py-2.5 px-2 font-medium text-right">Kalori</th>
                      <th className="py-2.5 px-2 font-medium text-right">P / K / L</th>
                      <th className="py-2.5 px-2 font-medium text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {draftItems.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-neutral-900 dark:text-white">
                            {item.foodName}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {item.matchedDbId} · {item.dataSource} ({Math.round(item.confidenceScore * 100)}%)
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            aria-label={`Porsi gram untuk ${item.foodName}`}
                            value={item.servingSize}
                            onChange={(e) => handleUpdateServingGrams(item.id, Number(e.target.value))}
                            className="w-16 px-1.5 py-1 text-right rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono tabular-nums text-xs"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap">
                          {item.calories} kkal
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[11px] whitespace-nowrap">
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
                      <td colSpan={2} className="py-2.5 px-3">
                        Total Gizi Hidangan
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {draftTotals.calories} kkal
                      </td>
                      <td colSpan={2} className="py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                        {draftTotals.protein}g P · {draftTotals.carbs}g K · {draftTotals.fat}g L
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {disclaimerText && (
              <p className="text-[11px] text-neutral-500 leading-relaxed">{disclaimerText}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
                  placeholder="Contoh: Nasi Putih, Ayam Bakar & Sayur"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="meal-cost-input" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Biaya Makanan (Rp)
                </label>
                <input
                  id="meal-cost-input"
                  type="number"
                  min={0}
                  value={costAmount}
                  onChange={(e) => setCostAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono tabular-nums text-neutral-900 dark:text-white"
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
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
                >
                  <option value="breakfast">Sarapan (Breakfast)</option>
                  <option value="lunch">Makan Siang (Lunch)</option>
                  <option value="dinner">Makan Malam (Dinner)</option>
                  <option value="snack">Camilan / Jajan (Snack)</option>
                  <option value="drinks">Minuman / Kopi (Drinks)</option>
                </select>
              </div>

              <div>
                <label htmlFor="consumption-kind-select" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Kelompok Pengeluaran
                </label>
                <select
                  id="consumption-kind-select"
                  value={consumptionKind}
                  onChange={(e) => setConsumptionKind(e.target.value as ConsumptionKind)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
                >
                  <option value="makan_utama">Makan Utama (Kategori: Makanan)</option>
                  <option value="jajan">Jajan / Kopi / Camilan (Kategori: Jajan)</option>
                </select>
              </div>

              <div>
                <label htmlFor="meal-date-input" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Tanggal &amp; Jam
                </label>
                <div className="flex gap-2">
                  <input
                    id="meal-date-input"
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
                  />
                  <input
                    type="time"
                    aria-label="Waktu konsumsi"
                    value={logTime}
                    onChange={(e) => setLogTime(e.target.value)}
                    className="w-28 px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="link-tx-select" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Tautkan ke Transaksi
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
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white"
                >
                  <option value="">Catat transaksi pengeluaran otomatis</option>
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
                  Otomatis catat pengeluaran ({formatIDR(Number(costAmount) || 0)}) ke daftar transaksi ({consumptionKind === 'makan_utama' ? 'Makanan' : 'Jajan'})
                </span>
              </label>
            )}

            <motion.button
              type="submit"
              whileTap={{ scale: 0.98 }}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Utensils className="w-4 h-4" />
              Simpan Jurnal Makanan &amp; Biaya
            </motion.button>
          </form>
        </div>

        {/* Right Column: Financial & Nutrition Correlation + Meal Journal */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-4 sm:p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121716] space-y-4">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                Efisiensi Biaya &amp; Gizi
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800">
                <div className="text-[11px] text-neutral-500">Rata-rata Makan/Hari</div>
                <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-neutral-900 dark:text-white mt-0.5 whitespace-nowrap">
                  {formatIDR(correlation.averageDailyFoodCost)}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800">
                <div className="text-[11px] text-neutral-500">Jajan vs Makan Utama</div>
                <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5 whitespace-nowrap">
                  {formatIDR(correlation.monthlyJajanSpend)}
                </div>
                <div className="text-[11px] text-neutral-400 font-mono tabular-nums whitespace-nowrap">
                  Makan: {formatIDR(correlation.monthlyMakananSpend)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Rincian per Waktu Makan
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden text-xs">
                {correlation.mealTypeCostComparison.map((row) => (
                  <div key={row.mealType} className="px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-neutral-900 dark:text-white truncate">{row.label}</div>
                      <div className="text-[11px] text-neutral-500">
                        {row.count}x · Rata-rata {row.avgCalories} kkal ({row.avgProtein}g P)
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="font-semibold text-neutral-900 dark:text-white whitespace-nowrap">
                        {formatIDR(row.totalCost)}
                      </div>
                      <div className="text-[11px] text-neutral-500 whitespace-nowrap">
                        Avg {formatIDR(row.avgCost)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Food Journal History */}
          <div className="p-4 sm:p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121716] space-y-4">
            <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
              Riwayat Jurnal Makanan ({foodLogs.length})
            </h3>
            {foodLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500">
                Belum ada catatan makanan. Gunakan tombol Gunakan Foto Referensi Makanan atau unggah foto untuk mencatat hidangan pertama Anda.
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {foodLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs min-w-0">
                      <div className="font-semibold text-neutral-900 dark:text-white truncate">
                        {log.mealName}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {formatDateID(log.logDate)} · {log.logTime} ·{' '}
                        {log.consumptionKind === 'makan_utama' ? 'Makan Utama' : 'Jajan'} ·{' '}
                        <span className="font-mono tabular-nums font-semibold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                          {formatIDR(log.costAmount)}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {log.totalCalories} kkal · {log.totalProtein}g P · {log.totalCarbs}g K · {log.totalFat}g L
                      </div>
                      <div className="text-[11px] text-neutral-500 line-clamp-2">{log.itemsSummary}</div>
                      <div className="text-[10px] text-neutral-400 flex items-center gap-1 truncate">
                        <Link2 className="w-3 h-3 shrink-0" />
                        <span className="truncate">{log.dataSourceSummary}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteFoodLog(log.id)}
                      aria-label={`Hapus catatan makanan ${log.mealName}`}
                      className="p-1.5 text-neutral-400 hover:text-rose-500 transition-colors shrink-0"
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
