import {
  AnalyticsPeriodKey,
  BudgetRecord,
  BudgetStatusSummary,
  DateRangeWindow,
  FoodLogRecord,
  SmartInsight,
  TransactionRecord,
} from './types';

/**
 * Formats a numeric value into Indonesian Rupiah (IDR).
 */
export function formatIDR(amount: number): string {
  const isNegative = amount < 0;
  const absVal = Math.round(Math.abs(amount));
  const formatted = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNegative ? '-Rp ' : 'Rp '}${formatted}`;
}

/**
 * Formats YYYY-MM-DD into Indonesian date string (DD MMMM YYYY).
 */
const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatDateID(ymd: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  const monthName = MONTHS_ID[(m || 1) - 1] || '';
  return `${String(d).padStart(2, '0')} ${monthName} ${y}`;
}

export function toYMD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function addDaysYMD(ymd: string, days: number): string {
  const dt = parseYMD(ymd);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toYMD(dt);
}

export function daysBetweenInclusive(startYMD: string, endYMD: string): number {
  const s = parseYMD(startYMD).getTime();
  const e = parseYMD(endYMD).getTime();
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

/**
 * Resolves exact date range windows for all 15 period options,
 * strictly distinguishing Rolling Periods vs Calendar Periods.
 */
export function resolvePeriodWindow(
  period: AnalyticsPeriodKey,
  referenceYMD: string,
  customStart?: string,
  customEnd?: string
): DateRangeWindow {
  const refDate = parseYMD(referenceYMD);
  const year = refDate.getUTCFullYear();
  const month = refDate.getUTCMonth(); // 0-indexed

  let startDate = referenceYMD;
  let endDate = referenceYMD;
  let label = 'Hari Ini';
  let periodKind: 'rolling' | 'calendar' | 'custom' = 'calendar';
  let description = '';

  switch (period) {
    case 'today': {
      startDate = referenceYMD;
      endDate = referenceYMD;
      label = 'Hari Ini';
      periodKind = 'calendar';
      description = `Kalender hari ini (${formatDateID(referenceYMD)})`;
      break;
    }
    case 'yesterday': {
      const yest = addDaysYMD(referenceYMD, -1);
      startDate = yest;
      endDate = yest;
      label = 'Kemarin';
      periodKind = 'calendar';
      description = `Kalender kemarin (${formatDateID(yest)})`;
      break;
    }
    case 'last_7_days': {
      startDate = addDaysYMD(referenceYMD, -6);
      endDate = referenceYMD;
      label = '7 Hari Terakhir';
      periodKind = 'rolling';
      description = 'Rolling 7 hari berjalan hingga hari ini';
      break;
    }
    case 'this_week': {
      // Monday as start of week
      const dayOfWeek = refDate.getUTCDay(); // 0=Sun, 1=Mon
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate = addDaysYMD(referenceYMD, diffToMonday);
      endDate = addDaysYMD(startDate, 6);
      label = 'Minggu Ini';
      periodKind = 'calendar';
      description = 'Kalender minggu berjalan (Senin–Minggu)';
      break;
    }
    case 'last_week': {
      const dayOfWeek = refDate.getUTCDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const thisMonday = addDaysYMD(referenceYMD, diffToMonday);
      startDate = addDaysYMD(thisMonday, -7);
      endDate = addDaysYMD(thisMonday, -1);
      label = 'Minggu Sebelumnya';
      periodKind = 'calendar';
      description = 'Kalender minggu lalu penuh (Senin–Minggu)';
      break;
    }
    case 'last_14_days': {
      startDate = addDaysYMD(referenceYMD, -13);
      endDate = referenceYMD;
      label = '14 Hari Terakhir';
      periodKind = 'rolling';
      description = 'Rolling 14 hari berjalan dari tanggal sekarang';
      break;
    }
    case 'first_2_weeks': {
      startDate = toYMD(new Date(Date.UTC(year, month, 1)));
      endDate = toYMD(new Date(Date.UTC(year, month, 14)));
      label = '2 Minggu Pertama';
      periodKind = 'calendar';
      description = 'Kalender tanggal 1 sampai 14 bulan berjalan';
      break;
    }
    case 'last_2_weeks': {
      startDate = toYMD(new Date(Date.UTC(year, month, 15)));
      const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      endDate = toYMD(new Date(Date.UTC(year, month, lastDayOfMonth)));
      label = '2 Minggu Terakhir';
      periodKind = 'calendar';
      description = `Kalender tanggal 15 sampai akhir bulan (${lastDayOfMonth})`;
      break;
    }
    case 'this_month': {
      startDate = toYMD(new Date(Date.UTC(year, month, 1)));
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      endDate = toYMD(new Date(Date.UTC(year, month, lastDay)));
      label = 'Bulan Ini';
      periodKind = 'calendar';
      description = `Kalender bulan ${MONTHS_ID[month]} ${year}`;
      break;
    }
    case 'last_month': {
      const prevMonthStart = new Date(Date.UTC(year, month - 1, 1));
      const prevMonthEnd = new Date(Date.UTC(year, month, 0));
      startDate = toYMD(prevMonthStart);
      endDate = toYMD(prevMonthEnd);
      label = 'Bulan Sebelumnya';
      periodKind = 'calendar';
      description = `Kalender bulan lalu (${MONTHS_ID[prevMonthStart.getUTCMonth()]} ${prevMonthStart.getUTCFullYear()})`;
      break;
    }
    case 'last_3_months': {
      startDate = addDaysYMD(referenceYMD, -89);
      endDate = referenceYMD;
      label = '3 Bulan Terakhir';
      periodKind = 'rolling';
      description = 'Rolling 90 hari berjalan hingga hari ini';
      break;
    }
    case 'last_6_months': {
      startDate = addDaysYMD(referenceYMD, -179);
      endDate = referenceYMD;
      label = '6 Bulan Terakhir';
      periodKind = 'rolling';
      description = 'Rolling 180 hari berjalan hingga hari ini';
      break;
    }
    case 'this_year': {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
      label = 'Tahun Ini';
      periodKind = 'calendar';
      description = `Kalender tahun ${year}`;
      break;
    }
    case 'last_year': {
      const lastY = year - 1;
      startDate = `${lastY}-01-01`;
      endDate = `${lastY}-12-31`;
      label = 'Tahun Sebelumnya';
      periodKind = 'calendar';
      description = `Kalender tahun ${lastY}`;
      break;
    }
    case 'custom': {
      startDate = customStart && /^\d{4}-\d{2}-\d{2}$/.test(customStart) ? customStart : addDaysYMD(referenceYMD, -6);
      endDate = customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) ? customEnd : referenceYMD;
      if (startDate > endDate) {
        const tmp = startDate;
        startDate = endDate;
        endDate = tmp;
      }
      label = 'Rentang Kustom';
      periodKind = 'custom';
      description = `${formatDateID(startDate)} – ${formatDateID(endDate)}`;
      break;
    }
  }

  const spanDays = daysBetweenInclusive(startDate, endDate);
  const previousEndDate = addDaysYMD(startDate, -1);
  const previousStartDate = addDaysYMD(previousEndDate, -(spanDays - 1));

  return {
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    label,
    periodKind,
    description,
  };
}

export interface PeriodAnalyticsResult {
  window: DateRangeWindow;
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  transactionCount: number;
  averageDailyExpense: number;
  largestExpense: TransactionRecord | null;
  dominantCategory: { category: string; amount: number; percentage: number } | null;
  previousTotalIncome: number;
  previousTotalExpense: number;
  incomeChangePct: number | null;
  expenseChangePct: number | null;
  makananExpense: number;
  jajanExpense: number;
  categoryBreakdown: {
    category: string;
    amount: number;
    count: number;
    percentage: number;
  }[];
  dailySeries: {
    date: string;
    label: string;
    income: number;
    expense: number;
    balanceDelta: number;
  }[];
  filteredTransactions: TransactionRecord[];
}

export function computePeriodAnalytics(
  transactions: TransactionRecord[],
  window: DateRangeWindow
): PeriodAnalyticsResult {
  const currentTx = transactions.filter(
    (t) => t.transactionDate >= window.startDate && t.transactionDate <= window.endDate
  );
  const previousTx = transactions.filter(
    (t) => t.transactionDate >= window.previousStartDate && t.transactionDate <= window.previousEndDate
  );

  let totalIncome = 0;
  let totalExpense = 0;
  let makananExpense = 0;
  let jajanExpense = 0;
  let largestExpense: TransactionRecord | null = null;

  const categoryMap = new Map<string, { amount: number; count: number }>();

  for (const tx of currentTx) {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else if (tx.type === 'expense') {
      totalExpense += tx.amount;
      if (tx.category === 'Makanan') makananExpense += tx.amount;
      if (tx.category === 'Jajan') jajanExpense += tx.amount;

      if (!largestExpense || tx.amount > largestExpense.amount) {
        largestExpense = tx;
      }

      const prev = categoryMap.get(tx.category) || { amount: 0, count: 0 };
      categoryMap.set(tx.category, {
        amount: prev.amount + tx.amount,
        count: prev.count + 1,
      });
    }
  }

  let previousTotalIncome = 0;
  let previousTotalExpense = 0;
  for (const tx of previousTx) {
    if (tx.type === 'income') previousTotalIncome += tx.amount;
    else if (tx.type === 'expense') previousTotalExpense += tx.amount;
  }

  const incomeChangePct =
    previousTotalIncome > 0
      ? Number((((totalIncome - previousTotalIncome) / previousTotalIncome) * 100).toFixed(1))
      : null;

  const expenseChangePct =
    previousTotalExpense > 0
      ? Number((((totalExpense - previousTotalExpense) / previousTotalExpense) * 100).toFixed(1))
      : null;

  const spanDays = daysBetweenInclusive(window.startDate, window.endDate);
  const averageDailyExpense = spanDays > 0 ? Math.round(totalExpense / spanDays) : 0;

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
      percentage: totalExpense > 0 ? Number(((data.amount / totalExpense) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const dominantCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;

  // Build daily series (cap at 60 points by grouping or listing daily within window)
  const dailyMap = new Map<string, { income: number; expense: number }>();
  const maxDaysToEnumerate = Math.min(spanDays, 62);
  const seriesStart =
    spanDays > 62 ? addDaysYMD(window.endDate, -(maxDaysToEnumerate - 1)) : window.startDate;

  for (let i = 0; i < maxDaysToEnumerate; i++) {
    const d = addDaysYMD(seriesStart, i);
    dailyMap.set(d, { income: 0, expense: 0 });
  }

  for (const tx of currentTx) {
    const bucket = dailyMap.get(tx.transactionDate);
    if (bucket) {
      if (tx.type === 'income') bucket.income += tx.amount;
      else if (tx.type === 'expense') bucket.expense += tx.amount;
    }
  }

  const dailySeries = Array.from(dailyMap.entries()).map(([date, vals]) => {
    const [, m, d] = date.split('-');
    return {
      date,
      label: `${d}/${m}`,
      income: vals.income,
      expense: vals.expense,
      balanceDelta: vals.income - vals.expense,
    };
  });

  return {
    window,
    totalIncome,
    totalExpense,
    netCashFlow: totalIncome - totalExpense,
    transactionCount: currentTx.length,
    averageDailyExpense,
    largestExpense,
    dominantCategory,
    previousTotalIncome,
    previousTotalExpense,
    incomeChangePct,
    expenseChangePct,
    makananExpense,
    jajanExpense,
    categoryBreakdown,
    dailySeries,
    filteredTransactions: currentTx.sort((a, b) =>
      `${b.transactionDate} ${b.transactionTime}`.localeCompare(`${a.transactionDate} ${a.transactionTime}`)
    ),
  };
}

/**
 * Generates Smart Insights strictly from actual user transactions.
 * Returns empty array if no transactions exist (never fabricates insights).
 */
export function generateSmartInsights(
  transactions: TransactionRecord[],
  referenceYMD: string
): SmartInsight[] {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const insights: SmartInsight[] = [];
  const monthWindow = resolvePeriodWindow('this_month', referenceYMD);
  const analytics = computePeriodAnalytics(transactions, monthWindow);

  if (analytics.dominantCategory && analytics.totalExpense > 0) {
    insights.push({
      id: 'dominant-category',
      type: analytics.dominantCategory.percentage >= 45 ? 'warning' : 'neutral',
      title: `${analytics.dominantCategory.category} menjadi kategori pengeluaran terbesar`,
      description: `Menyerap ${analytics.dominantCategory.percentage}% (${formatIDR(
        analytics.dominantCategory.amount
      )}) dari total pengeluaran periode ini.`,
      metricLabel: `${analytics.dominantCategory.percentage}% porsi pengeluaran`,
    });
  }

  if (analytics.jajanExpense > 0 && analytics.makananExpense > 0) {
    const ratio = Math.round((analytics.jajanExpense / (analytics.makananExpense + analytics.jajanExpense)) * 100);
    insights.push({
      id: 'makanan-vs-jajan',
      type: ratio > 35 ? 'warning' : 'positive',
      title: ratio > 35 ? 'Proporsi Jajan cukup tinggi dibanding Makan Utama' : 'Rasio Makan Utama vs Jajan terkendali',
      description: `Pengeluaran Jajan tercatat ${formatIDR(analytics.jajanExpense)} (${ratio}% dari total konsumsi ${formatIDR(
        analytics.makananExpense + analytics.jajanExpense
      )}).`,
      metricLabel: `Jajan ${ratio}% vs Makanan ${100 - ratio}%`,
    });
  }

  // Time-of-day pattern from actual transactionTime
  const expenseTxs = transactions.filter((t) => t.type === 'expense' && t.transactionTime);
  if (expenseTxs.length >= 2) {
    let morning = 0; // 05-11
    let afternoon = 0; // 11-17
    let evening = 0; // 17-24 or 00-05
    for (const tx of expenseTxs) {
      const hour = Number(tx.transactionTime.split(':')[0] || 12);
      if (hour >= 5 && hour < 11) morning++;
      else if (hour >= 11 && hour < 17) afternoon++;
      else evening++;
    }
    const maxCount = Math.max(morning, afternoon, evening);
    const timeSlot =
      maxCount === evening ? 'malam hari (17:00–24:00)' : maxCount === afternoon ? 'siang–sore hari (11:00–17:00)' : 'pagi hari (05:00–11:00)';
    insights.push({
      id: 'time-of-day-habit',
      type: 'neutral',
      title: `Transaksi paling sering dilakukan pada ${timeSlot}`,
      description: `Tercatat ${maxCount} dari ${expenseTxs.length} transaksi pengeluaran terjadi pada waktu tersebut.`,
      metricLabel: `${maxCount}x transaksi`,
    });
  }

  if (analytics.expenseChangePct !== null) {
    const increased = analytics.expenseChangePct > 0;
    insights.push({
      id: 'period-comparison',
      type: increased ? 'warning' : 'positive',
      title: increased
        ? `Pengeluaran naik ${analytics.expenseChangePct}% dibanding periode sebelumnya`
        : `Pengeluaran lebih hemat ${Math.abs(analytics.expenseChangePct)}% dibanding periode sebelumnya`,
      description: `Periode ini ${formatIDR(analytics.totalExpense)} berbanding ${formatIDR(
        analytics.previousTotalExpense
      )} pada periode pembanding.`,
      metricLabel: `${increased ? '+' : ''}${analytics.expenseChangePct}% MoM`,
    });
  }

  return insights;
}

/**
 * Evaluates budgets against actual transactions in the current period.
 */
export function evaluateBudgets(
  budgets: BudgetRecord[],
  transactions: TransactionRecord[],
  referenceYMD: string
): BudgetStatusSummary[] {
  const monthWindow = resolvePeriodWindow('this_month', referenceYMD);
  const weekWindow = resolvePeriodWindow('this_week', referenceYMD);
  const currentDay = Number(referenceYMD.split('-')[2] || 15);
  const totalDaysInMonth = daysBetweenInclusive(monthWindow.startDate, monthWindow.endDate);

  return budgets.map((budget) => {
    const activeWindow = budget.period === 'weekly' ? weekWindow : monthWindow;
    const matchingTx = transactions.filter(
      (t) =>
        t.type === 'expense' &&
        t.transactionDate >= activeWindow.startDate &&
        t.transactionDate <= activeWindow.endDate &&
        t.category.toLowerCase() === budget.category.toLowerCase() &&
        (!budget.subcategory || t.subcategory.toLowerCase() === budget.subcategory.toLowerCase())
    );

    const spent = matchingTx.reduce((acc, item) => acc + item.amount, 0);
    const remaining = Math.max(0, budget.limitAmount - spent);
    const percentageUsed =
      budget.limitAmount > 0 ? Number(((spent / budget.limitAmount) * 100).toFixed(1)) : 0;

    const projectedSpend =
      budget.period === 'monthly' && currentDay > 0
        ? Math.round((spent / currentDay) * totalDaysInMonth)
        : spent;

    let alertLevel: BudgetStatusSummary['alertLevel'] = 'normal';
    if (percentageUsed > 100) alertLevel = 'exceeded';
    else if (percentageUsed >= 100 && budget.threshold100) alertLevel = 'reached_100';
    else if (percentageUsed >= 80 && budget.threshold80) alertLevel = 'warning_80';
    else if (percentageUsed >= 50 && budget.threshold50) alertLevel = 'warning_50';

    return {
      budget,
      spent,
      remaining,
      percentageUsed,
      projectedSpend,
      alertLevel,
    };
  });
}

export interface NutritionFinanceCorrelation {
  averageDailyFoodCost: number;
  monthlyMakananSpend: number;
  monthlyJajanSpend: number;
  costPerGramProtein: number | null;
  mealTypeCostComparison: {
    mealType: string;
    label: string;
    totalCost: number;
    avgCost: number;
    avgCalories: number;
    avgProtein: number;
    count: number;
  }[];
  topConsumedFoods: {
    name: string;
    count: number;
    totalCost: number;
  }[];
  calculationMethodNote: string;
}

export function computeNutritionFinanceCorrelation(
  transactions: TransactionRecord[],
  foodLogs: FoodLogRecord[],
  referenceYMD: string
): NutritionFinanceCorrelation {
  const monthWindow = resolvePeriodWindow('this_month', referenceYMD);
  const monthAnalytics = computePeriodAnalytics(transactions, monthWindow);

  const monthLogs = foodLogs.filter(
    (l) => l.logDate >= monthWindow.startDate && l.logDate <= monthWindow.endDate
  );

  const distinctDays = new Set([
    ...transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          (t.category === 'Makanan' || t.category === 'Jajan') &&
          t.transactionDate >= monthWindow.startDate &&
          t.transactionDate <= monthWindow.endDate
      )
      .map((t) => t.transactionDate),
    ...monthLogs.map((l) => l.logDate),
  ]);

  const activeFoodDays = Math.max(1, distinctDays.size);
  const totalFoodAndJajanSpend = monthAnalytics.makananExpense + monthAnalytics.jajanExpense;
  const averageDailyFoodCost =
    distinctDays.size > 0 ? Math.round(totalFoodAndJajanSpend / activeFoodDays) : 0;

  // Cost per gram of protein from food logs that have both costAmount > 0 and totalProtein > 0
  const logsWithCostAndProtein = monthLogs.filter((l) => l.costAmount > 0 && l.totalProtein > 0);
  const sumLogCost = logsWithCostAndProtein.reduce((s, l) => s + l.costAmount, 0);
  const sumLogProtein = logsWithCostAndProtein.reduce((s, l) => s + l.totalProtein, 0);
  const costPerGramProtein =
    sumLogProtein > 0 ? Math.round(sumLogCost / sumLogProtein) : null;

  const mealLabels: Record<string, string> = {
    breakfast: 'Sarapan (Breakfast)',
    lunch: 'Makan Siang (Lunch)',
    dinner: 'Makan Malam (Dinner)',
    snack: 'Camilan / Jajan (Snack)',
    drinks: 'Minuman / Kopi (Drinks)',
  };

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'drinks'];
  const mealTypeCostComparison = mealTypes.map((mt) => {
    const matching = monthLogs.filter((l) => l.mealType === mt);
    const count = matching.length;
    const totalCost = matching.reduce((s, l) => s + l.costAmount, 0);
    const totalCal = matching.reduce((s, l) => s + l.totalCalories, 0);
    const totalProt = matching.reduce((s, l) => s + l.totalProtein, 0);
    return {
      mealType: mt,
      label: mealLabels[mt] || mt,
      totalCost,
      avgCost: count > 0 ? Math.round(totalCost / count) : 0,
      avgCalories: count > 0 ? Math.round(totalCal / count) : 0,
      avgProtein: count > 0 ? Number((totalProt / count).toFixed(1)) : 0,
      count,
    };
  });

  const foodFreq = new Map<string, { count: number; totalCost: number }>();
  for (const log of monthLogs) {
    const key = log.mealName.trim();
    const prev = foodFreq.get(key) || { count: 0, totalCost: 0 };
    foodFreq.set(key, {
      count: prev.count + 1,
      totalCost: prev.totalCost + log.costAmount,
    });
  }

  const topConsumedFoods = Array.from(foodFreq.entries())
    .map(([name, v]) => ({ name, count: v.count, totalCost: v.totalCost }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    averageDailyFoodCost,
    monthlyMakananSpend: monthAnalytics.makananExpense,
    monthlyJajanSpend: monthAnalytics.jajanExpense,
    costPerGramProtein,
    mealTypeCostComparison,
    topConsumedFoods,
    calculationMethodNote:
      'Dihitung secara deterministik dari transaksi aktual kategori Makanan & Jajan serta jurnal makanan terverifikasi (Σ Biaya Makanan Terkait ÷ Σ Gram Protein Terverifikasi). Bukan klaim medis.',
  };
}

/**
 * Generates CSV string from transactions.
 */
export function exportTransactionsToCSV(transactions: TransactionRecord[]): string {
  const headers = [
    'ID',
    'Tanggal',
    'Waktu',
    'Tipe',
    'Kategori',
    'Subkategori',
    'Jumlah_IDR',
    'Deskripsi',
    'Metode_Pembayaran',
    'Merchant',
  ];
  const rows = transactions.map((t) => [
    t.id,
    t.transactionDate,
    t.transactionTime,
    t.type,
    `"${(t.category || '').replace(/"/g, '""')}"`,
    `"${(t.subcategory || '').replace(/"/g, '""')}"`,
    String(t.amount),
    `"${(t.description || '').replace(/"/g, '""')}"`,
    `"${(t.paymentMethod || '').replace(/"/g, '""')}"`,
    `"${(t.merchant || '').replace(/"/g, '""')}"`,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Validates and parses imported CSV rows into TransactionRecord payloads.
 */
export function parseAndValidateCSV(
  csvText: string,
  defaultAccountId: string,
  userId: string
): { valid: Omit<TransactionRecord, 'id' | 'createdAt' | 'updatedAt'>[]; errors: string[] } {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { valid: [], errors: ['File CSV harus memiliki baris header dan minimal 1 baris data transaksi.'] };
  }

  const valid: Omit<TransactionRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    // Support either 10-column export format or 6-column simple format: Tanggal,Waktu,Tipe,Kategori,Subkategori,Jumlah,Deskripsi
    const isFullFormat = cols.length >= 9 && /^\d{4}-\d{2}-\d{2}$/.test(cols[1]);
    const dateStr = isFullFormat ? cols[1] : cols[0];
    const timeStr = isFullFormat ? cols[2] : cols[1] || '12:00';
    const typeStr = (isFullFormat ? cols[3] : cols[2])?.toLowerCase();
    const category = isFullFormat ? cols[4] : cols[3];
    const subcategory = isFullFormat ? cols[5] : cols[4];
    const amountRaw = Number(isFullFormat ? cols[6] : cols[5]);
    const description = (isFullFormat ? cols[7] : cols[6]) || `${category} - ${subcategory}`;
    const paymentMethod = (isFullFormat ? cols[8] : cols[7]) || 'Transfer / QRIS';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      errors.push(`Baris ${i + 1}: Format tanggal "${dateStr}" tidak valid (gunakan YYYY-MM-DD).`);
      continue;
    }
    if (typeStr !== 'income' && typeStr !== 'expense' && typeStr !== 'transfer') {
      errors.push(`Baris ${i + 1}: Tipe transaksi "${typeStr}" harus income, expense, atau transfer.`);
      continue;
    }
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
      errors.push(`Baris ${i + 1}: Jumlah nominal harus angka positif.`);
      continue;
    }
    if (!category || !subcategory) {
      errors.push(`Baris ${i + 1}: Kategori dan subkategori wajib diisi.`);
      continue;
    }

    valid.push({
      userId,
      transactionDate: dateStr,
      transactionTime: /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : '12:00',
      type: typeStr,
      category,
      subcategory,
      amount: Math.round(amountRaw),
      description: description.slice(0, 240),
      paymentMethod: paymentMethod.slice(0, 64),
      accountId: defaultAccountId,
    });
  }

  return { valid, errors };
}

/**
 * Formats an automated report message from actual database records for Telegram / WhatsApp.
 */
export function buildAutomatedReportMessage(
  transactions: TransactionRecord[],
  foodLogs: FoodLogRecord[],
  referenceYMD: string,
  options: { includeFinancial: boolean; includeNutrition: boolean; periodKey?: AnalyticsPeriodKey }
): string {
  const periodWindow = resolvePeriodWindow(options.periodKey || 'this_month', referenceYMD);
  const fin = computePeriodAnalytics(transactions, periodWindow);
  const insights = generateSmartInsights(transactions, referenceYMD);

  const periodLogs = foodLogs.filter(
    (l) => l.logDate >= periodWindow.startDate && l.logDate <= periodWindow.endDate
  );

  const lines: string[] = [
    `📊 *LAPORAN MONEYSCOPE — ${periodWindow.label.toUpperCase()}*`,
    `Periode: ${formatDateID(periodWindow.startDate)} s/d ${formatDateID(periodWindow.endDate)}`,
    '',
  ];

  if (options.includeFinancial) {
    lines.push('💰 *FINANCIAL REPORT*');
    lines.push(`• Total Pemasukan: ${formatIDR(fin.totalIncome)}`);
    lines.push(`• Total Pengeluaran: ${formatIDR(fin.totalExpense)}`);
    lines.push(`• Saldo Bersih (Net Cash Flow): ${formatIDR(fin.netCashFlow)}`);
    lines.push(
      `• Kategori Terbesar: ${
        fin.dominantCategory
          ? `${fin.dominantCategory.category} (${formatIDR(fin.dominantCategory.amount)} / ${fin.dominantCategory.percentage}%)`
          : 'Belum ada data pengeluaran'
      }`
    );
    lines.push(`• Pengeluaran Makanan Utama: ${formatIDR(fin.makananExpense)}`);
    lines.push(`• Pengeluaran Jajan & Kopi: ${formatIDR(fin.jajanExpense)}`);
    if (fin.expenseChangePct !== null) {
      lines.push(
        `• Perbandingan Periode: ${fin.expenseChangePct > 0 ? `+${fin.expenseChangePct}%` : `${fin.expenseChangePct}%`} vs periode sebelumnya`
      );
    }
    if (insights.length > 0) {
      lines.push(`• Insight Utama: ${insights[0].title}`);
    }
    lines.push('');
  }

  if (options.includeNutrition) {
    const totalCal = periodLogs.reduce((s, l) => s + l.totalCalories, 0);
    const totalProt = periodLogs.reduce((s, l) => s + l.totalProtein, 0);
    const totalCarbs = periodLogs.reduce((s, l) => s + l.totalCarbs, 0);
    const totalFat = periodLogs.reduce((s, l) => s + l.totalFat, 0);
    const makanUtamaCount = periodLogs.filter((l) => l.consumptionKind === 'makan_utama').length;
    const jajanCount = periodLogs.filter((l) => l.consumptionKind === 'jajan').length;

    lines.push('🥗 *NUTRITION INTELLIGENCE REPORT*');
    lines.push(`• Total Estimasi Kalori: ${Math.round(totalCal).toLocaleString('id-ID')} kkal`);
    lines.push(`• Protein: ${totalProt.toFixed(1)} g | Karbohidrat: ${totalCarbs.toFixed(1)} g | Lemak: ${totalFat.toFixed(1)} g`);
    lines.push(`• Frekuensi Makan Utama: ${makanUtamaCount}x | Frekuensi Jajan/Minuman: ${jajanCount}x`);
    lines.push('• Catatan: Nilai nutrisi bersumber dari pencocokan TKPI Kemenkes RI / USDA FoodData Central.');
  }

  return lines.join('\n').trim();
}
