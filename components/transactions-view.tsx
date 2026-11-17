'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Download,
  Upload,
  Trash2,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import {
  CategoryDefinition,
  FinancialAccount,
  TransactionRecord,
  TransactionType,
} from '@/lib/types';
import {
  exportTransactionsToCSV,
  formatDateID,
  formatIDR,
  parseAndValidateCSV,
} from '@/lib/analytics-engine';

interface TransactionsViewProps {
  transactions: TransactionRecord[];
  categories: CategoryDefinition[];
  accounts: FinancialAccount[];
  referenceDate: string;
  userId: string;
  onAddTransaction: (
    tx: Omit<TransactionRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateTransaction: (id: string, tx: Partial<TransactionRecord>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onBulkImportTransactions: (
    rows: Omit<TransactionRecord, 'id' | 'createdAt' | 'updatedAt'>[]
  ) => Promise<void>;
}

export function TransactionsView({
  transactions,
  categories,
  accounts,
  referenceDate,
  userId,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onBulkImportTransactions,
}: TransactionsViewProps) {
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Add Form State
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('Makanan');
  const [subcategory, setSubcategory] = useState<string>('Makan siang');
  const [description, setDescription] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>(referenceDate);
  const [transactionTime, setTransactionTime] = useState<string>('12:30');
  const [paymentMethod, setPaymentMethod] = useState<string>('QRIS');
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id || 'acc-main');
  const [merchant, setMerchant] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // Inline Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const availableCategories = useMemo(() => {
    if (txType === 'income') {
      return categories.filter((c) => c.type === 'income');
    }
    return categories.filter((c) => c.type === 'expense');
  }, [categories, txType]);

  const activeCategoryObj = useMemo(() => {
    return (
      availableCategories.find((c) => c.name === category) ||
      availableCategories[0]
    );
  }, [availableCategories, category]);

  const handleTypeChange = (newType: TransactionType) => {
    setTxType(newType);
    if (newType === 'income') {
      const incCat = categories.find((c) => c.type === 'income');
      if (incCat) {
        setCategory(incCat.name);
        setSubcategory(incCat.subcategories[0] || 'Gaji');
      }
    } else {
      const expCat = categories.find((c) => c.name === 'Makanan') || categories[0];
      if (expCat) {
        setCategory(expCat.name);
        setSubcategory(expCat.subcategories[0] || 'Makan siang');
      }
    }
  };

  const handleCategoryChange = (newCatName: string) => {
    setCategory(newCatName);
    const found = availableCategories.find((c) => c.name === newCatName);
    if (found && found.subcategories.length > 0) {
      setSubcategory(found.subcategories[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanAmount = Math.round(Number(amount.replace(/[^0-9]/g, '')) || 0);
    if (cleanAmount <= 0) {
      setFormError('Nominal transaksi wajib lebih besar dari Rp 0.');
      return;
    }
    const cleanDesc = description.trim() || `${category} - ${subcategory}`;
    await onAddTransaction({
      amount: cleanAmount,
      type: txType,
      category: activeCategoryObj ? activeCategoryObj.name : category,
      subcategory,
      description: cleanDesc,
      transactionDate,
      transactionTime,
      paymentMethod,
      accountId: accountId || accounts[0]?.id || 'acc-main',
      merchant: merchant.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setAmount('');
    setDescription('');
    setMerchant('');
    setNotes('');
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (filterCategory !== 'all' && t.category !== filterCategory) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            t.description.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.subcategory.toLowerCase().includes(q) ||
            (t.merchant && t.merchant.toLowerCase().includes(q));
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) =>
        `${b.transactionDate} ${b.transactionTime}`.localeCompare(
          `${a.transactionDate} ${a.transactionTime}`
        )
      );
  }, [transactions, filterType, filterCategory, searchQuery]);

  const handleExportCSV = () => {
    const csvContent = exportTransactionsToCSV(filteredTransactions);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moneyscope-transaksi-${referenceDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      const parsed = parseAndValidateCSV(
        reader.result,
        accounts[0]?.id || 'acc-main',
        userId
      );
      if (parsed.valid.length > 0) {
        await onBulkImportTransactions(parsed.valid);
      }
      setImportFeedback(
        `Impor CSV selesai: ${parsed.valid.length} transaksi valid berhasil ditambahkan.${
          parsed.errors.length > 0 ? ` (${parsed.errors.length} baris dilewati: ${parsed.errors[0]})` : ''
        }`
      );
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Fast Transaction Entry Form */}
      <div className="lg:col-span-5 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">
            Catat Transaksi Baru
          </h2>
          <p className="text-xs text-neutral-500">
            Kategori Makanan Utama dan Jajan dipisahkan secara eksplisit untuk akurasi analitik.
          </p>
        </div>

        {/* Transaction Type Segmented Control */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950">
          {(
            [
              { id: 'expense', label: 'Pengeluaran' },
              { id: 'income', label: 'Pemasukan' },
              { id: 'transfer', label: 'Transfer' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTypeChange(item.id)}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                txType === item.id
                  ? item.id === 'income'
                    ? 'bg-emerald-600 text-white'
                    : item.id === 'expense'
                    ? 'bg-rose-600 text-white'
                    : 'bg-sky-600 text-white'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {formError && (
          <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label htmlFor="tx-amount-input" className="block text-neutral-500 mb-1">
              Nominal Rupiah (IDR)
            </label>
            <input
              id="tx-amount-input"
              type="number"
              min={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 25000"
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-base font-bold font-mono tabular-nums text-neutral-900 dark:text-white"
            />
            {Number(amount) > 0 && (
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                Terformat: {formatIDR(Number(amount))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tx-category-select" className="block text-neutral-500 mb-1">
                Kategori Utama
              </label>
              <select
                id="tx-category-select"
                value={activeCategoryObj?.name || category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              >
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tx-subcategory-select" className="block text-neutral-500 mb-1">
                Subkategori
              </label>
              <select
                id="tx-subcategory-select"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              >
                {(activeCategoryObj?.subcategories || ['Umum']).map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tx-desc-input" className="block text-neutral-500 mb-1">
              Deskripsi Transaksi
            </label>
            <input
              id="tx-desc-input"
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Makan Siang Nasi Ayam Bakar"
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tx-date-input" className="block text-neutral-500 mb-1">
                Tanggal Transaksi
              </label>
              <input
                id="tx-date-input"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono"
              />
            </div>
            <div>
              <label htmlFor="tx-time-input" className="block text-neutral-500 mb-1">
                Waktu (WIB)
              </label>
              <input
                id="tx-time-input"
                type="time"
                value={transactionTime}
                onChange={(e) => setTransactionTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tx-account-select" className="block text-neutral-500 mb-1">
                Rekening / Dompet
              </label>
              <select
                id="tx-account-select"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tx-method-select" className="block text-neutral-500 mb-1">
                Metode Pembayaran
              </label>
              <select
                id="tx-method-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              >
                <option value="QRIS">QRIS</option>
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="Tunai / Cash">Tunai / Cash</option>
                <option value="Kartu Debit/Kredit">Kartu Debit/Kredit</option>
                <option value="GoPay / OVO / Dana">GoPay / OVO / Dana</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tx-merchant-input" className="block text-neutral-500 mb-1">
              Merchant / Tempat Transaksi (Opsional)
            </label>
            <input
              id="tx-merchant-input"
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Contoh: Warteg Bahari / Kopi Kenangan"
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Simpan Transaksi
          </button>
        </form>
      </div>

      {/* Right: Transaction Ledger, Search, Filters, CSV Import/Export */}
      <div className="lg:col-span-7 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">
            Daftar Transaksi ({filteredTransactions.length})
          </h2>
          <div className="flex items-center gap-2">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportCSVFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {importFeedback && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
            {importFeedback}
          </div>
        )}

        {/* Search & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
          <div className="sm:col-span-6 relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Cari Transaksi"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari deskripsi, kategori, merchant..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
            />
          </div>
          <div className="sm:col-span-3">
            <select
              aria-label="Filter Tipe Transaksi"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
            >
              <option value="all">Semua Tipe</option>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <select
              aria-label="Filter Kategori Transaksi"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            Belum ada transaksi yang sesuai filter. Gunakan formulir di samping untuk menambahkan transaksi pertama Anda.
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl max-h-[520px] overflow-y-auto">
            {filteredTransactions.map((tx) => {
              const isEditing = editingId === tx.id;
              const isConfirmingDelete = confirmDeleteId === tx.id;

              return (
                <div
                  key={tx.id}
                  className="p-3.5 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 flex items-center justify-between gap-3 text-xs"
                >
                  {isEditing ? (
                    <div className="flex-1 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        aria-label="Edit Deskripsi"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                      />
                      <input
                        type="number"
                        aria-label="Edit Nominal"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-28 px-2.5 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await onUpdateTransaction(tx.id, {
                            description: editDesc.trim() || tx.description,
                            amount: Math.max(1, Math.round(Number(editAmount) || tx.amount)),
                          });
                          setEditingId(null);
                        }}
                        aria-label="Simpan Edit"
                        className="p-1.5 rounded bg-emerald-600 text-white"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        aria-label="Batal Edit"
                        className="p-1.5 rounded bg-neutral-200 dark:bg-neutral-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-semibold text-neutral-900 dark:text-white truncate">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {tx.category} · {tx.subcategory} · {formatDateID(tx.transactionDate)} ·{' '}
                          {tx.transactionTime} · {tx.paymentMethod}
                          {tx.merchant ? ` · ${tx.merchant}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-mono tabular-nums font-bold text-sm ${
                            tx.type === 'income'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : tx.type === 'expense'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-sky-600 dark:text-sky-400'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                          {formatIDR(tx.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(tx.id);
                            setEditDesc(tx.description);
                            setEditAmount(String(tx.amount));
                          }}
                          aria-label={`Edit transaksi ${tx.description}`}
                          className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteTransaction(tx.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-semibold"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded bg-neutral-200 dark:bg-neutral-800 text-[10px]"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(tx.id)}
                            aria-label={`Hapus transaksi ${tx.description}`}
                            className="p-1 text-neutral-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
