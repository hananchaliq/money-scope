'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { Calendar, Filter, X, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AnalyticsPeriodKey, TransactionRecord } from '@/lib/types';
import {
  computePeriodAnalytics,
  formatDateID,
  formatIDR,
  resolvePeriodWindow,
} from '@/lib/analytics-engine';

interface TimeAnalyticsViewProps {
  transactions: TransactionRecord[];
  referenceDate: string;
}

const PERIOD_OPTIONS: {
  key: AnalyticsPeriodKey;
  label: string;
  group: 'calendar' | 'rolling' | 'custom';
}[] = [
  { key: 'today', label: 'Hari Ini', group: 'calendar' },
  { key: 'yesterday', label: 'Kemarin', group: 'calendar' },
  { key: 'last_7_days', label: '7 Hari Terakhir (Rolling)', group: 'rolling' },
  { key: 'this_week', label: 'Minggu Ini (Kalender)', group: 'calendar' },
  { key: 'last_week', label: 'Minggu Sebelumnya', group: 'calendar' },
  { key: 'last_14_days', label: '14 Hari Terakhir (Rolling)', group: 'rolling' },
  { key: 'first_2_weeks', label: '2 Minggu Pertama (Tgl 1–14)', group: 'calendar' },
  { key: 'last_2_weeks', label: '2 Minggu Terakhir (Tgl 15–Akhir)', group: 'calendar' },
  { key: 'this_month', label: 'Bulan Ini', group: 'calendar' },
  { key: 'last_month', label: 'Bulan Sebelumnya', group: 'calendar' },
  { key: 'last_3_months', label: '3 Bulan Terakhir (Rolling)', group: 'rolling' },
  { key: 'last_6_months', label: '6 Bulan Terakhir (Rolling)', group: 'rolling' },
  { key: 'this_year', label: 'Tahun Ini', group: 'calendar' },
  { key: 'last_year', label: 'Tahun Sebelumnya', group: 'calendar' },
  { key: 'custom', label: 'Rentang Tanggal Kustom', group: 'custom' },
];

const CATEGORY_COLORS = ['#10b981', '#f59e0b', '#38bdf8', '#f43f5e', '#a855f7', '#64748b'];

export function TimeAnalyticsView({ transactions, referenceDate }: TimeAnalyticsViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriodKey>('this_month');
  const [customStart, setCustomStart] = useState<string>('2026-11-01');
  const [customEnd, setCustomEnd] = useState<string>(referenceDate);
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const [drilldownDate, setDrilldownDate] = useState<string | null>(null);

  const windowRange = useMemo(
    () => resolvePeriodWindow(selectedPeriod, referenceDate, customStart, customEnd),
    [selectedPeriod, referenceDate, customStart, customEnd]
  );

  const analytics = useMemo(
    () => computePeriodAnalytics(transactions, windowRange),
    [transactions, windowRange]
  );

  const drilldownTransactions = useMemo(() => {
    return analytics.filteredTransactions.filter((tx) => {
      if (drilldownCategory && tx.category !== drilldownCategory) return false;
      if (drilldownDate && tx.transactionDate !== drilldownDate) return false;
      return true;
    });
  }, [analytics.filteredTransactions, drilldownCategory, drilldownDate]);

  return (
    <div className="space-y-6">
      {/* Period Selector Header */}
      <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              Analitik Berbasis Waktu (Rolling vs Calendar Period)
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {windowRange.description} · Rentang Aktif: {formatDateID(windowRange.startDate)} –{' '}
              {formatDateID(windowRange.endDate)} ({windowRange.periodKind.toUpperCase()})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <select
              aria-label="Pilih Periode Analitik"
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value as AnalyticsPeriodKey);
                setDrilldownCategory(null);
                setDrilldownDate(null);
              }}
              className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-xs font-semibold text-neutral-900 dark:text-white"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Period Segmented Bar */}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              'today',
              'last_7_days',
              'last_14_days',
              'first_2_weeks',
              'last_2_weeks',
              'this_month',
              'last_month',
              'this_year',
            ] as AnalyticsPeriodKey[]
          ).map((key) => {
            const opt = PERIOD_OPTIONS.find((o) => o.key === key)!;
            const active = selectedPeriod === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedPeriod(key);
                  setDrilldownCategory(null);
                  setDrilldownDate(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {selectedPeriod === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="custom-start" className="text-neutral-500">Dari:</label>
              <input
                id="custom-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="custom-end" className="text-neutral-500">Sampai:</label>
              <input
                id="custom-end"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Period Summary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Total Pemasukan</div>
          <div className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {formatIDR(analytics.totalIncome)}
          </div>
          {analytics.incomeChangePct !== null && (
            <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-0.5 font-mono tabular-nums">
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              {analytics.incomeChangePct > 0 ? `+${analytics.incomeChangePct}%` : `${analytics.incomeChangePct}%`} vs periode lalu
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Total Pengeluaran</div>
          <div className="text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
            {formatIDR(analytics.totalExpense)}
          </div>
          {analytics.expenseChangePct !== null && (
            <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-0.5 font-mono tabular-nums">
              <ArrowDownRight className="w-3 h-3 text-rose-500" />
              {analytics.expenseChangePct > 0 ? `+${analytics.expenseChangePct}%` : `${analytics.expenseChangePct}%`} vs periode lalu
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Net Cash Flow</div>
          <div
            className={`text-lg font-bold font-mono tabular-nums mt-1 ${
              analytics.netCashFlow >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatIDR(analytics.netCashFlow)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-mono tabular-nums">
            {analytics.transactionCount} transaksi tercatat
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Rata-rata Harian</div>
          <div className="text-lg font-bold font-mono tabular-nums text-neutral-900 dark:text-white mt-1">
            {formatIDR(analytics.averageDailyExpense)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Pengeluaran per hari</div>
        </div>

        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Pengeluaran Terbesar</div>
          <div className="text-lg font-bold font-mono tabular-nums text-neutral-900 dark:text-white mt-1 truncate">
            {analytics.largestExpense ? formatIDR(analytics.largestExpense.amount) : 'Rp 0'}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5 truncate">
            {analytics.largestExpense ? analytics.largestExpense.description : 'Belum ada data'}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Kategori Dominan</div>
          <div className="text-lg font-bold text-neutral-900 dark:text-white mt-1 truncate">
            {analytics.dominantCategory ? analytics.dominantCategory.category : '-'}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-mono tabular-nums">
            {analytics.dominantCategory
              ? `${analytics.dominantCategory.percentage}% (${formatIDR(analytics.dominantCategory.amount)})`
              : 'Belum ada pengeluaran'}
          </div>
        </div>
      </div>

      {/* Charts + Interactive Drill-Down */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Income & Expense Chart (Click a day to drill down) */}
        <div className="lg:col-span-7 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Tren Harian Pemasukan &amp; Pengeluaran
              </h3>
              <p className="text-xs text-neutral-500">
                Klik titik tanggal pada grafik atau daftar di bawah untuk melakukan drill-down transaksi pada tanggal tersebut.
              </p>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={analytics.dailySeries}
                onClick={(state) => {
                  const idx = typeof state?.activeTooltipIndex === 'number' ? state.activeTooltipIndex : -1;
                  const clickedDate = idx >= 0 ? analytics.dailySeries[idx]?.date : undefined;
                  if (clickedDate) {
                    setDrilldownDate(clickedDate);
                  }
                }}
              >
                <defs>
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(val) => formatIDR(Number(val ?? 0))}
                  labelFormatter={(lbl) => `Tanggal: ${lbl}`}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Pemasukan"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#incGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Pengeluaran"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fill="url(#expGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution Bar Chart & Interactive Drill-down Buttons */}
        <div className="lg:col-span-5 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Distribusi Kategori (Interactive Drill-Down)
            </h3>
            <p className="text-xs text-neutral-500">
              Tekan kategori (mis. Makanan atau Jajan) untuk menyaring transaksi kategori tersebut.
            </p>
          </div>

          {analytics.categoryBreakdown.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              Belum ada pengeluaran pada periode ini.
            </div>
          ) : (
            <>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.categoryBreakdown}
                    layout="vertical"
                    onClick={(st) => {
                      const idx = typeof st?.activeTooltipIndex === 'number' ? st.activeTooltipIndex : -1;
                      const cat = idx >= 0 ? analytics.categoryBreakdown[idx]?.category : undefined;
                      if (cat) {
                        setDrilldownCategory((prev) => (prev === cat ? null : cat));
                      }
                    }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={90}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                    />
                    <Tooltip
                      formatter={(val) => formatIDR(Number(val ?? 0))}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="amount" name="Total" radius={[0, 6, 6, 0]} className="cursor-pointer">
                      {analytics.categoryBreakdown.map((entry, index) => (
                        <Cell
                          key={entry.category}
                          fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5">
                {analytics.categoryBreakdown.map((cat) => {
                  const isSelected = drilldownCategory === cat.category;
                  return (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() =>
                        setDrilldownCategory((prev) => (prev === cat.category ? null : cat.category))
                      }
                      className={`w-full px-3 py-2 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                          : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      <span>
                        {cat.category} · {cat.count} transaksi ({cat.percentage}%)
                      </span>
                      <span className="font-mono tabular-nums font-semibold">
                        {formatIDR(cat.amount)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drill-down Transaction Results Table */}
      <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-500" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Rincian Transaksi Periode ({drilldownTransactions.length})
            </h3>
          </div>
          {(drilldownCategory || drilldownDate) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Filter Aktif:{' '}
                {drilldownCategory ? `Kategori = ${drilldownCategory}` : ''}{' '}
                {drilldownDate ? `Tanggal = ${formatDateID(drilldownDate)}` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  setDrilldownCategory(null);
                  setDrilldownDate(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1 hover:bg-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
                Reset Drill-Down
              </button>
            </div>
          )}
        </div>

        {drilldownTransactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500">
            Tidak ada transaksi yang cocok dengan filter periode/drill-down ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500">
                  <th className="py-2.5 px-3 font-medium">Tanggal &amp; Waktu</th>
                  <th className="py-2.5 px-3 font-medium">Deskripsi</th>
                  <th className="py-2.5 px-3 font-medium">Kategori · Subkategori</th>
                  <th className="py-2.5 px-3 font-medium">Metode</th>
                  <th className="py-2.5 px-3 font-medium text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {drilldownTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => setDrilldownDate(tx.transactionDate)}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-600 dark:text-neutral-400">
                      {formatDateID(tx.transactionDate)} · {tx.transactionTime}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-neutral-900 dark:text-white">
                      {tx.description}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">
                      {tx.category} · {tx.subcategory}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500">{tx.paymentMethod}</td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono tabular-nums font-semibold ${
                        tx.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatIDR(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
