'use client';

import React, { useState } from 'react';
import {
  Wallet,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FolderPlus,
  BellRing,
} from 'lucide-react';
import {
  AccountType,
  BudgetRecord,
  CategoryDefinition,
  FinancialAccount,
  TransactionRecord,
} from '@/lib/types';
import { evaluateBudgets, formatIDR } from '@/lib/analytics-engine';

interface BudgetsAccountsViewProps {
  accounts: FinancialAccount[];
  budgets: BudgetRecord[];
  categories: CategoryDefinition[];
  transactions: TransactionRecord[];
  referenceDate: string;
  onAddAccount: (acc: Omit<FinancialAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onAddBudget: (b: Omit<BudgetRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
  onAddCategory: (c: Omit<CategoryDefinition, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

export function BudgetsAccountsView({
  accounts,
  budgets,
  categories,
  transactions,
  referenceDate,
  onAddAccount,
  onDeleteAccount,
  onAddBudget,
  onDeleteBudget,
  onAddCategory,
  onDeleteCategory,
}: BudgetsAccountsViewProps) {
  // Budget Form State
  const [budgetName, setBudgetName] = useState<string>('');
  const [budgetCategory, setBudgetCategory] = useState<string>('Makanan');
  const [budgetLimit, setBudgetLimit] = useState<string>('1000000');
  const [budgetPeriod, setBudgetPeriod] = useState<'monthly' | 'weekly' | 'custom'>('monthly');
  const [t50, setT50] = useState<boolean>(true);
  const [t80, setT80] = useState<boolean>(true);
  const [t100, setT100] = useState<boolean>(true);

  // Account Form State
  const [accName, setAccName] = useState<string>('');
  const [accType, setAccType] = useState<AccountType>('bank');
  const [accBalance, setAccBalance] = useState<string>('2500000');

  // Category Form State
  const [catName, setCatName] = useState<string>('');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catSubcategories, setCatSubcategories] = useState<string>('');

  const evaluatedBudgets = evaluateBudgets(budgets, transactions, referenceDate);

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = Math.round(Number(budgetLimit) || 0);
    if (limitNum <= 0) return;
    await onAddBudget({
      name: budgetName.trim() || `Anggaran ${budgetCategory}`,
      category: budgetCategory,
      limitAmount: limitNum,
      period: budgetPeriod,
      threshold50: t50,
      threshold80: t80,
      threshold100: t100,
    });
    setBudgetName('');
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    await onAddAccount({
      name: accName.trim(),
      type: accType,
      balance: Math.round(Number(accBalance) || 0),
      color: accType === 'bank' ? '#10b981' : accType === 'ewallet' ? '#38bdf8' : '#f59e0b',
    });
    setAccName('');
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    const subs = catSubcategories
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await onAddCategory({
      name: catName.trim(),
      type: catType,
      group: catType === 'expense' ? 'Kustom Pengeluaran' : 'Kustom Pemasukan',
      subcategories: subs.length > 0 ? subs.slice(0, 20) : ['Umum'],
    });
    setCatName('');
    setCatSubcategories('');
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Budget Management & Configurable Threshold Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-emerald-500" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
              Buat Anggaran (Budget) &amp; Threshold Notifikasi
            </h2>
          </div>
          <form onSubmit={handleCreateBudget} className="space-y-3 text-xs">
            <div>
              <label htmlFor="budget-name" className="block text-neutral-500 mb-1">
                Nama Anggaran
              </label>
              <input
                id="budget-name"
                type="text"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                placeholder="Contoh: Anggaran Makan Bulanan"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="budget-cat" className="block text-neutral-500 mb-1">
                  Kategori Target
                </label>
                <select
                  id="budget-cat"
                  value={budgetCategory}
                  onChange={(e) => setBudgetCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                >
                  {categories
                    .filter((c) => c.type === 'expense')
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="budget-period" className="block text-neutral-500 mb-1">
                  Periode
                </label>
                <select
                  id="budget-period"
                  value={budgetPeriod}
                  onChange={(e) => setBudgetPeriod(e.target.value as 'monthly' | 'weekly' | 'custom')}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                >
                  <option value="monthly">Bulanan</option>
                  <option value="weekly">Mingguan</option>
                  <option value="custom">Khusus</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="budget-limit" className="block text-neutral-500 mb-1">
                Batas Anggaran (Rp)
              </label>
              <input
                id="budget-limit"
                type="number"
                min={1000}
                required
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono tabular-nums"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="font-medium text-neutral-700 dark:text-neutral-300">
                Konfigurasi Peringatan Threshold:
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t50}
                    onChange={(e) => setT50(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span>50% Terpakai</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t80}
                    onChange={(e) => setT80(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span>80% Terpakai</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t100}
                    onChange={(e) => setT100(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span>100% / Melewati Batas</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tambah Anggaran
            </button>
          </form>
        </div>

        {/* Active Budgets Progress & Alerts */}
        <div className="lg:col-span-7 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">
            Status Penggunaan Anggaran &amp; Proyeksi Pengeluaran ({evaluatedBudgets.length})
          </h2>

          {evaluatedBudgets.length === 0 ? (
            <div className="py-10 text-center text-xs text-neutral-500">
              Belum ada anggaran yang dibuat. Buat anggaran untuk Makanan, Jajan, Game, atau Transportasi di sebelah kiri.
            </div>
          ) : (
            <div className="space-y-4">
              {evaluatedBudgets.map(({ budget, spent, remaining, percentageUsed, projectedSpend, alertLevel }) => {
                const barWidth = Math.min(100, Math.max(0, percentageUsed));
                const barColor =
                  alertLevel === 'exceeded' || alertLevel === 'reached_100'
                    ? 'bg-rose-500'
                    : alertLevel === 'warning_80'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';

                return (
                  <div
                    key={budget.id}
                    className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/60 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-neutral-900 dark:text-white">
                          {budget.name}
                        </div>
                        <div className="text-xs text-neutral-500">
                          Kategori: {budget.category} · Periode:{' '}
                          {budget.period === 'monthly' ? 'Bulanan' : budget.period === 'weekly' ? 'Mingguan' : 'Khusus'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteBudget(budget.id)}
                        aria-label={`Hapus anggaran ${budget.name}`}
                        className="p-1 text-neutral-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono tabular-nums">
                      <div>
                        <span className="text-neutral-500 block font-sans">Terpakai</span>
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {formatIDR(spent)} ({percentageUsed}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block font-sans">Batas Limit</span>
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {formatIDR(budget.limitAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block font-sans">Sisa Anggaran</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatIDR(remaining)}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block font-sans">Proyeksi Akhir</span>
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                          {formatIDR(projectedSpend)}
                        </span>
                      </div>
                    </div>

                    {alertLevel !== 'normal' && (
                      <div className="text-xs flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium pt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {alertLevel === 'exceeded'
                            ? 'Peringatan: Pengeluaran telah melewati 100% batas anggaran!'
                            : alertLevel === 'reached_100'
                            ? 'Peringatan: Anggaran telah mencapai 100% batas yang ditentukan.'
                            : alertLevel === 'warning_80'
                            ? 'Perhatian: Penggunaan anggaran telah melewati threshold 80%.'
                            : 'Info: Penggunaan anggaran telah mencapai threshold 50%.'}
                        </span>
                      </div>
                    )}
                    {alertLevel === 'normal' && (
                      <div className="text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Pengeluaran masih berada dalam batas aman.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Multi-Account & Custom Category Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Accounts Management */}
        <div className="lg:col-span-6 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-500" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Manajemen Rekening &amp; Dompet ({accounts.length})
            </h3>
          </div>

          <form onSubmit={handleCreateAccount} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end text-xs">
            <div className="sm:col-span-5">
              <label htmlFor="acc-name" className="block text-neutral-500 mb-1">
                Nama Rekening / E-Wallet
              </label>
              <input
                id="acc-name"
                type="text"
                required
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                placeholder="BCA / GoPay / Dompet Tunai"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="acc-type" className="block text-neutral-500 mb-1">
                Tipe
              </label>
              <select
                id="acc-type"
                value={accType}
                onChange={(e) => setAccType(e.target.value as AccountType)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              >
                <option value="bank">Bank</option>
                <option value="ewallet">E-Wallet</option>
                <option value="cash">Tunai</option>
                <option value="investment">Investasi</option>
              </select>
            </div>
            <div className="sm:col-span-4">
              <label htmlFor="acc-bal" className="block text-neutral-500 mb-1">
                Saldo Awal (Rp)
              </label>
              <div className="flex gap-1.5">
                <input
                  id="acc-bal"
                  type="number"
                  value={accBalance}
                  onChange={(e) => setAccBalance(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono tabular-nums"
                />
                <button
                  type="submit"
                  aria-label="Tambah Rekening"
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>

          <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl">
            {accounts.map((acc) => (
              <div key={acc.id} className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-white">{acc.name}</div>
                  <div className="text-[11px] text-neutral-500 uppercase">{acc.type}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums font-bold text-sm text-neutral-900 dark:text-white">
                    {formatIDR(acc.balance)}
                  </span>
                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteAccount(acc.id)}
                      aria-label={`Hapus rekening ${acc.name}`}
                      className="text-neutral-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Categories Management */}
        <div className="lg:col-span-6 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-emerald-500" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Kategori &amp; Subkategori (Makanan &amp; Jajan Terpisah)
            </h3>
          </div>

          <form onSubmit={handleCreateCategory} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end text-xs">
            <div className="sm:col-span-4">
              <label htmlFor="cat-name" className="block text-neutral-500 mb-1">
                Nama Kategori Baru
              </label>
              <input
                id="cat-name"
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Contoh: Olahraga"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="cat-type" className="block text-neutral-500 mb-1">
                Jenis
              </label>
              <select
                id="cat-type"
                value={catType}
                onChange={(e) => setCatType(e.target.value as 'expense' | 'income')}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              >
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
              </select>
            </div>
            <div className="sm:col-span-5">
              <label htmlFor="cat-subs" className="block text-neutral-500 mb-1">
                Subkategori (pisahkan koma)
              </label>
              <div className="flex gap-1.5">
                <input
                  id="cat-subs"
                  type="text"
                  value={catSubcategories}
                  onChange={(e) => setCatSubcategories(e.target.value)}
                  placeholder="Gym, Suplemen, Sepatu"
                  className="w-full px-2.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                />
                <button
                  type="submit"
                  aria-label="Tambah Kategori"
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>

          <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl max-h-[260px] overflow-y-auto">
            {categories.map((cat) => (
              <div key={cat.id} className="p-3 flex items-start justify-between gap-2 text-xs">
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-white">
                    {cat.name}{' '}
                    <span className="font-normal text-neutral-500">
                      ({cat.type === 'income' ? 'Pemasukan' : 'Pengeluaran'})
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {cat.subcategories.join(' · ')}
                  </div>
                </div>
                {!cat.isSystem && (
                  <button
                    type="button"
                    onClick={() => onDeleteCategory(cat.id)}
                    aria-label={`Hapus kategori ${cat.name}`}
                    className="text-neutral-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
