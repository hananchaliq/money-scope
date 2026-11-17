import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNutritionFinanceCorrelation,
  computePeriodAnalytics,
  evaluateBudgets,
  formatDateID,
  formatIDR,
  generateSmartInsights,
  parseAndValidateCSV,
  resolvePeriodWindow,
} from './analytics-engine';
import { matchLocalVerifiedFood } from './nutrition-db';
import { BudgetRecord, FoodLogRecord, TransactionRecord } from './types';

test('formatIDR and formatDateID follow Indonesian locale standards', () => {
  assert.equal(formatIDR(18000), 'Rp 18.000');
  assert.equal(formatIDR(1540000), 'Rp 1.540.000');
  assert.equal(formatIDR(-25000), '-Rp 25.000');
  assert.equal(formatDateID('2026-11-17'), '17 November 2026');
});

test('resolvePeriodWindow distinguishes rolling 14 days vs calendar first/last 2 weeks', () => {
  const ref = '2026-11-17';

  const rolling14 = resolvePeriodWindow('last_14_days', ref);
  assert.equal(rolling14.periodKind, 'rolling');
  assert.equal(rolling14.startDate, '2026-11-04');
  assert.equal(rolling14.endDate, '2026-11-17');

  const first2Weeks = resolvePeriodWindow('first_2_weeks', ref);
  assert.equal(first2Weeks.periodKind, 'calendar');
  assert.equal(first2Weeks.startDate, '2026-11-01');
  assert.equal(first2Weeks.endDate, '2026-11-14');

  const last2Weeks = resolvePeriodWindow('last_2_weeks', ref);
  assert.equal(last2Weeks.periodKind, 'calendar');
  assert.equal(last2Weeks.startDate, '2026-11-15');
  assert.equal(last2Weeks.endDate, '2026-11-30');
});

test('computePeriodAnalytics separates Makanan vs Jajan and calculates exact totals', () => {
  const sampleTx: TransactionRecord[] = [
    {
      id: 't1',
      userId: 'u1',
      amount: 5000000,
      type: 'income',
      category: 'Pemasukan',
      subcategory: 'Gaji',
      description: 'Gaji Bulanan',
      transactionDate: '2026-11-01',
      transactionTime: '09:00',
      paymentMethod: 'BCA',
      accountId: 'acc1',
      createdAt: '2026-11-01T09:00:00Z',
      updatedAt: '2026-11-01T09:00:00Z',
    },
    {
      id: 't2',
      userId: 'u1',
      amount: 25000,
      type: 'expense',
      category: 'Makanan',
      subcategory: 'Makan siang',
      description: 'Nasi Ayam Bakar',
      transactionDate: '2026-11-16',
      transactionTime: '12:30',
      paymentMethod: 'QRIS',
      accountId: 'acc1',
      createdAt: '2026-11-16T12:30:00Z',
      updatedAt: '2026-11-16T12:30:00Z',
    },
    {
      id: 't3',
      userId: 'u1',
      amount: 22000,
      type: 'expense',
      category: 'Jajan',
      subcategory: 'Kopi',
      description: 'Es Kopi Susu Aren',
      transactionDate: '2026-11-17',
      transactionTime: '19:15',
      paymentMethod: 'QRIS',
      accountId: 'acc1',
      createdAt: '2026-11-17T19:15:00Z',
      updatedAt: '2026-11-17T19:15:00Z',
    },
  ];

  const win = resolvePeriodWindow('this_month', '2026-11-17');
  const res = computePeriodAnalytics(sampleTx, win);

  assert.equal(res.totalIncome, 5000000);
  assert.equal(res.totalExpense, 47000);
  assert.equal(res.netCashFlow, 4953000);
  assert.equal(res.makananExpense, 25000);
  assert.equal(res.jajanExpense, 22000);
  assert.equal(res.dominantCategory?.category, 'Makanan');
});

test('generateSmartInsights returns empty array when database is empty (no fake insights)', () => {
  const emptyInsights = generateSmartInsights([], '2026-11-17');
  assert.equal(emptyInsights.length, 0);
});

test('evaluateBudgets triggers accurate threshold alerts and nutrition correlation computes cost per gram protein', () => {
  const budgets: BudgetRecord[] = [
    {
      id: 'b1',
      userId: 'u1',
      name: 'Budget Jajan',
      category: 'Jajan',
      limitAmount: 100000,
      period: 'monthly',
      threshold50: true,
      threshold80: true,
      threshold100: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
  ];
  const tx: TransactionRecord[] = [
    {
      id: 'tx1',
      userId: 'u1',
      amount: 85000,
      type: 'expense',
      category: 'Jajan',
      subcategory: 'Kopi',
      description: 'Kopi mingguan',
      transactionDate: '2026-11-15',
      transactionTime: '16:00',
      paymentMethod: 'QRIS',
      accountId: 'a1',
      createdAt: '2026-11-15T16:00:00Z',
      updatedAt: '2026-11-15T16:00:00Z',
    },
  ];

  const evaluated = evaluateBudgets(budgets, tx, '2026-11-17');
  assert.equal(evaluated[0].percentageUsed, 85);
  assert.equal(evaluated[0].alertLevel, 'warning_80');

  const foodLogs: FoodLogRecord[] = [
    {
      id: 'fl1',
      userId: 'u1',
      mealType: 'lunch',
      consumptionKind: 'makan_utama',
      mealName: 'Nasi Putih & Ayam Goreng Dada',
      logDate: '2026-11-17',
      logTime: '12:30',
      totalCalories: 540,
      totalProtein: 36,
      totalCarbs: 52,
      totalFat: 18,
      totalFiber: 3,
      totalSodium: 420,
      costAmount: 18000,
      items: [],
      itemsSummary: 'Nasi putih (150g), Ayam goreng dada (120g)',
      dataSourceSummary: 'TKPI Kemenkes RI',
      createdAt: '2026-11-17T12:30:00Z',
      updatedAt: '2026-11-17T12:30:00Z',
    },
  ];

  const corr = computeNutritionFinanceCorrelation(tx, foodLogs, '2026-11-17');
  assert.equal(corr.costPerGramProtein, 500); // Rp 18.000 / 36g = Rp 500 / g protein
});

test('parseAndValidateCSV validates date, type, and positive amounts', () => {
  const csv = `Tanggal,Waktu,Tipe,Kategori,Subkategori,Jumlah,Deskripsi,Metode
2026-11-17,08:30,expense,Makanan,Sarapan,15000,Bubur Ayam,Tunai
invalid-date,08:30,expense,Makanan,Sarapan,-500,Invalid Row,Tunai`;

  const result = parseAndValidateCSV(csv, 'acc-default', 'user-1');
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0].amount, 15000);
  assert.equal(result.errors.length, 1);
});

test('matchLocalVerifiedFood enforces word boundaries so bayam does not match ayam', () => {
  const spinach = matchLocalVerifiedFood('daun bayam', 'spinach', 80, 0.92);
  assert.ok(spinach);
  assert.equal(spinach.matchedDbId, 'TKPI-SY002');

  const corn = matchLocalVerifiedFood('jagung manis', 'sweet corn', 65, 0.9);
  assert.ok(corn);
  assert.equal(corn.matchedDbId, 'TKPI-SY014');

  const chicken = matchLocalVerifiedFood('ayam bakar', 'grilled chicken', 110, 0.95);
  assert.ok(chicken);
  assert.equal(chicken.matchedDbId, 'TKPI-GP004');
});

