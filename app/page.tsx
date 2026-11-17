'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Clock,
  Wallet,
  Utensils,
  Box,
  Send,
  Settings,
  Plus,
  Sun,
  Moon,
  Download,
  LogIn,
  LogOut,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Trash2,
  X,
  Menu,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '@/lib/firebase';
import {
  BudgetRecord,
  CategoryDefinition,
  DEFAULT_CATEGORIES,
  FinancialAccount,
  FoodLogRecord,
  ReportPreference,
  TransactionRecord,
} from '@/lib/types';
import {
  computePeriodAnalytics,
  evaluateBudgets,
  formatDateID,
  formatIDR,
  generateSmartInsights,
  resolvePeriodWindow,
} from '@/lib/analytics-engine';
import { MobileLiquidNavbar, NavTabId } from '@/components/mobile-liquid-navbar';
import { TransactionsView } from '@/components/transactions-view';
import { TimeAnalyticsView } from '@/components/time-analytics-view';
import { BudgetsAccountsView } from '@/components/budgets-accounts-view';
import { NutritionIntelligenceView } from '@/components/nutrition-intelligence-view';
import { Wealth3DStudio } from '@/components/wealth-3d-studio';
import { ReportsIntegrationsView } from '@/components/reports-integrations-view';
import { useOnlineStatus, usePWAInstall } from '@/hooks/use-pwa';

const REFERENCE_TODAY = '2026-11-17';

const INITIAL_ACCOUNTS: FinancialAccount[] = [
  {
    id: 'acc-bca',
    userId: 'local-user',
    name: 'Rekening Utama BCA',
    type: 'bank',
    balance: 0,
    color: '#10b981',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'acc-gopay',
    userId: 'local-user',
    name: 'GoPay & QRIS Harian',
    type: 'ewallet',
    balance: 0,
    color: '#38bdf8',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'acc-cash',
    userId: 'local-user',
    name: 'Dompet Tunai',
    type: 'cash',
    balance: 0,
    color: '#f59e0b',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
];

const CHART_COLORS = ['#10b981', '#f59e0b', '#38bdf8', '#f43f5e', '#a855f7', '#64748b'];

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export default function MoneyScopePage() {
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [quickAddOpen, setQuickAddOpen] = useState<boolean>(false);

  // Quick Add Modal State
  const [qaType, setQaType] = useState<'expense' | 'income'>('expense');
  const [qaAmount, setQaAmount] = useState<string>('');
  const [qaCategory, setQaCategory] = useState<string>('Makanan');
  const [qaSubcategory, setQaSubcategory] = useState<string>('Makan siang');
  const [qaDescription, setQaDescription] = useState<string>('');
  const [qaError, setQaError] = useState<string | null>(null);

  // Firebase Auth & Persistent State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<FinancialAccount[]>(INITIAL_ACCOUNTS);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [customCategories, setCustomCategories] = useState<CategoryDefinition[]>([]);
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLogRecord[]>([]);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  const [dailyCalorieTarget, setDailyCalorieTarget] = useState<number>(2100);
  const [dailyProteinTarget, setDailyProteinTarget] = useState<number>(110);

  const [reportPreference, setReportPreference] = useState<ReportPreference>({
    userId: 'local-user',
    frequency: 'weekly',
    telegramEnabled: false,
    whatsappEnabled: false,
    includeFinancial: true,
    includeNutrition: true,
    updatedAt: '2026-11-17T00:00:00Z',
  });

  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);

  // Sync dark/light class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Boot Firestore connection check & Auth listener
  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (currUser) => {
      setUser(currUser);
      setAuthReady(true);
      if (currUser && currUser.emailVerified) {
        try {
          await setDoc(
            doc(db, 'users', currUser.uid),
            {
              userId: currUser.uid,
              displayName: (currUser.displayName || 'Pengguna MoneyScope').slice(0, 95),
              currency: 'IDR',
              timezone: 'Asia/Jakarta',
              dailyCalorieTarget: 2100,
              dailyProteinTarget: 110,
              onboardingCompleted: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // Profile already initialized
        }
      }
    });
    return () => unsub();
  }, []);

  // Firestore real-time listeners when authenticated
  useEffect(() => {
    if (!authReady || !user) return;
    const uid = user.uid;

    const txQuery = query(collection(db, 'transactions'), where('userId', '==', uid));
    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        const list: TransactionRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId,
            amount: Number(data.amount || 0),
            type: data.type,
            category: data.category,
            subcategory: data.subcategory,
            description: data.description,
            transactionDate: data.transactionDate,
            transactionTime: data.transactionTime,
            paymentMethod: data.paymentMethod,
            accountId: data.accountId,
            toAccountId: data.toAccountId,
            merchant: data.merchant,
            notes: data.notes,
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        setTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    const accQuery = query(collection(db, 'accounts'), where('userId', '==', uid));
    const unsubAcc = onSnapshot(
      accQuery,
      (snap) => {
        if (snap.empty) return;
        const list: FinancialAccount[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId,
            name: data.name,
            type: data.type,
            balance: Number(data.balance || 0),
            color: data.color || '#10b981',
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        setAccounts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'accounts')
    );

    const budgetQuery = query(collection(db, 'budgets'), where('userId', '==', uid));
    const unsubBudgets = onSnapshot(
      budgetQuery,
      (snap) => {
        const list: BudgetRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId,
            name: data.name,
            category: data.category,
            subcategory: data.subcategory,
            limitAmount: Number(data.limitAmount || 0),
            period: data.period,
            threshold50: Boolean(data.threshold50),
            threshold80: Boolean(data.threshold80),
            threshold100: Boolean(data.threshold100),
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        setBudgets(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'budgets')
    );

    const foodQuery = query(collection(db, 'food_logs'), where('userId', '==', uid));
    const unsubFood = onSnapshot(
      foodQuery,
      (snap) => {
        const list: FoodLogRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId,
            mealType: data.mealType,
            consumptionKind: data.consumptionKind,
            mealName: data.mealName,
            logDate: data.logDate,
            logTime: data.logTime,
            totalCalories: Number(data.totalCalories || 0),
            totalProtein: Number(data.totalProtein || 0),
            totalCarbs: Number(data.totalCarbs || 0),
            totalFat: Number(data.totalFat || 0),
            totalFiber: Number(data.totalFiber || 0),
            totalSodium: Number(data.totalSodium || 0),
            costAmount: Number(data.costAmount || 0),
            linkedTransactionId: data.linkedTransactionId,
            items: [],
            itemsSummary: data.itemsSummary,
            dataSourceSummary: data.dataSourceSummary,
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        setFoodLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'food_logs')
    );

    return () => {
      unsubTx();
      unsubAcc();
      unsubBudgets();
      unsubFood();
    };
  }, [authReady, user]);

  // All merged categories (Default system categories separating Makanan & Jajan + user custom categories)
  const allCategories = useMemo<CategoryDefinition[]>(() => {
    const sys = DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      userId: user?.uid || 'local-user',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    }));
    return [...sys, ...customCategories];
  }, [customCategories, user]);

  // CRUD Handlers (Write to Firestore when signed in + immediate state update)
  const handleAddTransaction = async (
    tx: Omit<TransactionRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();
    const uid = user?.uid || 'local-user';
    const record: TransactionRecord = {
      ...tx,
      id,
      userId: uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setTransactions((prev) => [record, ...prev]);

    // Update account balance
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id !== tx.accountId) return acc;
        const delta = tx.type === 'income' ? tx.amount : tx.type === 'expense' ? -tx.amount : 0;
        return { ...acc, balance: acc.balance + delta };
      })
    );

    if (!isOnline) {
      setOfflineQueueCount((c) => c + 1);
      return;
    }

    if (user) {
      try {
        const firestorePayload: Record<string, unknown> = {
          userId: uid,
          amount: record.amount,
          type: record.type,
          category: record.category.slice(0, 64),
          subcategory: record.subcategory.slice(0, 64),
          description: record.description.slice(0, 240),
          transactionDate: record.transactionDate.slice(0, 20),
          transactionTime: record.transactionTime.slice(0, 10),
          paymentMethod: record.paymentMethod.slice(0, 64),
          accountId: record.accountId.slice(0, 128),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (record.toAccountId) firestorePayload.toAccountId = record.toAccountId.slice(0, 128);
        if (record.merchant) firestorePayload.merchant = record.merchant.slice(0, 120);
        if (record.notes) firestorePayload.notes = record.notes.slice(0, 500);

        await setDoc(doc(db, 'transactions', id), firestorePayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `transactions/${id}`);
      }
    }
  };

  const handleUpdateTransaction = async (id: string, patch: Partial<TransactionRecord>) => {
    setTransactions((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
      )
    );
    if (user) {
      const existing = transactions.find((t) => t.id === id);
      if (!existing) return;
      try {
        await setDoc(
          doc(db, 'transactions', id),
          {
            ...existing,
            ...patch,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `transactions/${id}`);
      }
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    setTransactions((prev) => prev.filter((item) => item.id !== id));
    if (user) {
      try {
        await deleteDoc(doc(db, 'transactions', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
      }
    }
  };

  const handleBulkImportTransactions = async (
    rows: Omit<TransactionRecord, 'id' | 'createdAt' | 'updatedAt'>[]
  ) => {
    for (const r of rows) {
      await handleAddTransaction(r);
    }
  };

  const handleAddAccount = async (
    acc: Omit<FinancialAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    const id = `acc-${Date.now()}`;
    const uid = user?.uid || 'local-user';
    const nowIso = new Date().toISOString();
    const record: FinancialAccount = { ...acc, id, userId: uid, createdAt: nowIso, updatedAt: nowIso };
    setAccounts((prev) => [...prev, record]);
    if (user) {
      try {
        await setDoc(doc(db, 'accounts', id), {
          userId: uid,
          name: record.name.slice(0, 80),
          type: record.type,
          balance: record.balance,
          color: record.color.slice(0, 32),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `accounts/${id}`);
      }
    }
  };

  const handleDeleteAccount = async (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    if (user) {
      try {
        await deleteDoc(doc(db, 'accounts', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `accounts/${id}`);
      }
    }
  };

  const handleAddBudget = async (
    b: Omit<BudgetRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    const id = `bdg-${Date.now()}`;
    const uid = user?.uid || 'local-user';
    const nowIso = new Date().toISOString();
    const record: BudgetRecord = { ...b, id, userId: uid, createdAt: nowIso, updatedAt: nowIso };
    setBudgets((prev) => [...prev, record]);
    if (user) {
      try {
        await setDoc(doc(db, 'budgets', id), {
          userId: uid,
          name: record.name.slice(0, 80),
          category: record.category.slice(0, 64),
          limitAmount: record.limitAmount,
          period: record.period,
          threshold50: record.threshold50,
          threshold80: record.threshold80,
          threshold100: record.threshold100,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `budgets/${id}`);
      }
    }
  };

  const handleDeleteBudget = async (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    if (user) {
      try {
        await deleteDoc(doc(db, 'budgets', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `budgets/${id}`);
      }
    }
  };

  const handleAddCategory = async (
    c: Omit<CategoryDefinition, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    const id = `cat-${Date.now()}`;
    const uid = user?.uid || 'local-user';
    const nowIso = new Date().toISOString();
    setCustomCategories((prev) => [
      ...prev,
      { ...c, id, userId: uid, createdAt: nowIso, updatedAt: nowIso },
    ]);
  };

  const handleDeleteCategory = async (id: string) => {
    setCustomCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSaveFoodLog = async (
    logPayload: Omit<FoodLogRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    autoExpense?: { create: boolean; accountId: string; paymentMethod: string }
  ) => {
    const id = `food-${Date.now()}`;
    const uid = user?.uid || 'local-user';
    const nowIso = new Date().toISOString();

    let linkedTxId = logPayload.linkedTransactionId;
    if (autoExpense?.create && logPayload.costAmount > 0) {
      const txCategory = logPayload.consumptionKind === 'makan_utama' ? 'Makanan' : 'Jajan';
      const txSub =
        logPayload.mealType === 'breakfast'
          ? 'Sarapan'
          : logPayload.mealType === 'lunch'
          ? 'Makan siang'
          : logPayload.mealType === 'dinner'
          ? 'Makan malam'
          : logPayload.mealType === 'drinks'
          ? 'Kopi'
          : 'Camilan';
      await handleAddTransaction({
        amount: logPayload.costAmount,
        type: 'expense',
        category: txCategory,
        subcategory: txSub,
        description: logPayload.mealName,
        transactionDate: logPayload.logDate,
        transactionTime: logPayload.logTime,
        paymentMethod: autoExpense.paymentMethod,
        accountId: autoExpense.accountId,
      });
    }

    const record: FoodLogRecord = {
      ...logPayload,
      id,
      userId: uid,
      linkedTransactionId: linkedTxId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setFoodLogs((prev) => [record, ...prev]);

    if (user) {
      try {
        const firestoreDoc: Record<string, unknown> = {
          userId: uid,
          mealType: record.mealType,
          consumptionKind: record.consumptionKind,
          mealName: record.mealName.slice(0, 160),
          logDate: record.logDate.slice(0, 20),
          logTime: record.logTime.slice(0, 10),
          totalCalories: record.totalCalories,
          totalProtein: record.totalProtein,
          totalCarbs: record.totalCarbs,
          totalFat: record.totalFat,
          totalFiber: record.totalFiber,
          totalSodium: record.totalSodium,
          costAmount: record.costAmount,
          itemsSummary: record.itemsSummary.slice(0, 1500),
          dataSourceSummary: record.dataSourceSummary.slice(0, 240),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (record.linkedTransactionId) {
          firestoreDoc.linkedTransactionId = record.linkedTransactionId;
        }
        await setDoc(doc(db, 'food_logs', id), firestoreDoc);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `food_logs/${id}`);
      }
    }
  };

  const handleDeleteFoodLog = async (id: string) => {
    setFoodLogs((prev) => prev.filter((f) => f.id !== id));
    if (user) {
      try {
        await deleteDoc(doc(db, 'food_logs', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `food_logs/${id}`);
      }
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQaError(null);
    const val = Math.round(Number(qaAmount.replace(/[^0-9]/g, '')) || 0);
    if (val <= 0) {
      setQaError('Masukkan nominal Rupiah yang valid (> Rp 0).');
      return;
    }
    await handleAddTransaction({
      amount: val,
      type: qaType,
      category: qaType === 'income' ? 'Pemasukan' : qaCategory,
      subcategory: qaType === 'income' ? 'Gaji' : qaSubcategory,
      description: qaDescription.trim() || `${qaCategory} - ${qaSubcategory}`,
      transactionDate: REFERENCE_TODAY,
      transactionTime: '13:00',
      paymentMethod: 'QRIS',
      accountId: accounts[0]?.id || 'acc-bca',
    });
    setQaAmount('');
    setQaDescription('');
    setQuickAddOpen(false);
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : 'Gagal masuk dengan akun Google.'
      );
    }
  };

  const handleClearAllUserData = async () => {
    setTransactions([]);
    setBudgets([]);
    setFoodLogs([]);
    setAccounts(INITIAL_ACCOUNTS);
  };

  // Real-time Dashboard Computations from actual records
  const monthWindow = useMemo(() => resolvePeriodWindow('this_month', REFERENCE_TODAY), []);
  const monthAnalytics = useMemo(
    () => computePeriodAnalytics(transactions, monthWindow),
    [transactions, monthWindow]
  );
  const smartInsights = useMemo(
    () => generateSmartInsights(transactions, REFERENCE_TODAY),
    [transactions]
  );
  const evaluatedBudgets = useMemo(
    () => evaluateBudgets(budgets, transactions, REFERENCE_TODAY),
    [budgets, transactions]
  );

  const totalAccountBalance = useMemo(() => {
    const baseAccSum = accounts.reduce((s, a) => s + a.balance, 0);
    // If accounts start at 0, reflect net cash flow from recorded transactions
    return baseAccSum !== 0 ? baseAccSum : monthAnalytics.netCashFlow;
  }, [accounts, monthAnalytics.netCashFlow]);

  const totalBudgetLimit = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalBudgetSpent = evaluatedBudgets.reduce((s, b) => s + b.spent, 0);
  const overallBudgetUtilization =
    totalBudgetLimit > 0 ? Math.min(100, Math.round((totalBudgetSpent / totalBudgetLimit) * 100)) : 0;

  const todayFoodLogs = foodLogs.filter((l) => l.logDate === REFERENCE_TODAY);
  const todayMacros = todayFoodLogs.reduce(
    (acc, l) => ({
      cal: acc.cal + l.totalCalories,
      prot: acc.prot + l.totalProtein,
      carb: acc.carb + l.totalCarbs,
      fat: acc.fat + l.totalFat,
    }),
    { cal: 0, prot: 0, carb: 0, fat: 0 }
  );

  const navItems: { id: NavTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard Utama', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transaksi & CSV', icon: ArrowLeftRight },
    { id: 'analytics', label: 'Analitik Waktu', icon: Clock },
    { id: 'budgets', label: 'Anggaran & Akun', icon: Wallet },
    { id: 'nutrition', label: 'Nutrisi & AI Scan', icon: Utensils },
    { id: 'studio3d', label: '3D Wealth Studio', icon: Box },
    { id: 'reports', label: 'Laporan Telegram/WA', icon: Send },
    { id: 'settings', label: 'Pengaturan & Privasi', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-neutral-50 dark:bg-[#0B0F0E] text-neutral-900 dark:text-neutral-100">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#0F1413] z-30">
        <div className="h-16 px-6 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2 whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-lg bg-emerald-500 text-neutral-950 font-mono font-bold text-sm flex items-center justify-center">
              M
            </span>
            <span>MoneyScope</span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Navigasi Sidebar Desktop">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Quick Add + Auth State */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800/80 space-y-3">
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Catat Cepat (Quick Add)
          </button>

          {user ? (
            <div className="flex items-center justify-between text-xs pt-1">
              <div className="truncate pr-2">
                <div className="font-semibold text-neutral-900 dark:text-white truncate">
                  {user.displayName || user.email}
                </div>
                <div className="text-[11px] text-emerald-500">Cloud Firestore Aktif</div>
              </div>
              <button
                type="button"
                onClick={() => signOut(auth)}
                aria-label="Keluar Akun"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-2 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-500" />
              Masuk dengan Google
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 pb-24 lg:pb-10">
        {/* Sticky Top Header (Follows Top Bar Contract & Mobile Sticky Header requirement) */}
        <header className="sticky top-0 z-30 h-14 lg:h-16 px-4 lg:px-8 border-b border-neutral-200 dark:border-neutral-800/80 bg-white/90 dark:bg-[#0B0F0E]/90 backdrop-blur-md flex items-center justify-between gap-4">
          {/* Zone 1: Brand / Active Section Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen((o) => !o)}
              aria-label="Menu Navigasi Lengkap"
              className="lg:hidden p-2 -ml-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white truncate">
              {navItems.find((n) => n.id === activeTab)?.label || 'MoneyScope'}
            </span>
          </div>

          {/* Zone 2: Concise Single-Line Navigation Links on Desktop */}
          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Ringkasan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className="hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              15 Periode Waktu
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('nutrition')}
              className="hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              AI Food Scan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className="hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Telegram &amp; WA
            </button>
          </nav>

          {/* Zone 3: Theme Toggle + PWA Install + Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            {!isOnline && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-500 text-xs font-medium flex items-center gap-1 whitespace-nowrap">
                <WifiOff className="w-3.5 h-3.5" />
                Offline ({offlineQueueCount} antrean)
              </span>
            )}

            {!isInstalled && (isInstallable || isIOS) && (
              <button
                type="button"
                onClick={() => (isInstallable ? install() : setShowIOSModal(true))}
                className="px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-500/10 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Install PWA</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label="Ubah Tema Terang atau Gelap"
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Catat Transaksi</span>
            </button>
          </div>
        </header>

        {/* Mobile Secondary Drawer for Reports, Budgets & Settings */}
        {mobileDrawerOpen && (
          <div className="lg:hidden bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 space-y-1.5 z-20">
            <div className="text-[11px] font-semibold text-neutral-400 pb-1">
              Semua Modul MoneyScope
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileDrawerOpen(false);
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      activeTab === item.id
                        ? 'bg-emerald-500/15 text-emerald-500 font-semibold'
                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Workspace Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
          {authError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 flex items-center justify-between">
              <span>{authError}</span>
              <button type="button" onClick={() => setAuthError(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB 1: DASHBOARD UTAMA */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Financial Overview Hero Strip (Inspired by Reference Images 2 & 3: High-contrast Lime/Emerald Balance Card + Dark Slate Metrics) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {/* Primary Balance Card */}
                <div className="lg:col-span-5 p-6 rounded-2xl bg-[#D9F99D] dark:bg-[#D9F99D] text-neutral-950 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-800">
                      Total Saldo Bersih · {formatDateID(REFERENCE_TODAY)}
                    </span>
                    <span className="text-xs font-mono font-semibold text-neutral-800">
                      IDR · Asia/Jakarta
                    </span>
                  </div>

                  <div className="my-4">
                    <div
                      data-testid="dashboard-total-balance"
                      className="text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight text-neutral-950"
                    >
                      {formatIDR(totalAccountBalance)}
                    </div>
                    <div className="text-xs text-neutral-800 mt-1 font-medium">
                      Net Cash Flow Bulan Ini: <span className="font-mono tabular-nums font-bold">{formatIDR(monthAnalytics.netCashFlow)}</span>
                      {monthAnalytics.expenseChangePct !== null && (
                        <span> · {monthAnalytics.expenseChangePct > 0 ? `+${monthAnalytics.expenseChangePct}%` : `${monthAnalytics.expenseChangePct}%`} vs bulan lalu</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-950/15">
                    <div>
                      <div className="text-[11px] font-medium text-neutral-700">Total Pemasukan</div>
                      <div
                        data-testid="dashboard-total-income"
                        className="text-base font-bold font-mono tabular-nums text-emerald-950"
                      >
                        +{formatIDR(monthAnalytics.totalIncome)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-neutral-700">Total Pengeluaran</div>
                      <div
                        data-testid="dashboard-total-expense"
                        className="text-base font-bold font-mono tabular-nums text-rose-900"
                      >
                        -{formatIDR(monthAnalytics.totalExpense)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Secondary Overview Cards */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Makan Utama vs Jajan Bulan Ini
                    </div>
                    <div className="my-2 space-y-1.5">
                      <div>
                        <div className="text-[11px] text-neutral-400">Makanan Utama</div>
                        <div className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatIDR(monthAnalytics.makananExpense)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-neutral-400">Jajan, Kopi &amp; Camilan</div>
                        <div className="text-lg font-bold font-mono tabular-nums text-amber-500">
                          {formatIDR(monthAnalytics.jajanExpense)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('analytics')}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline text-left"
                    >
                      Lihat Drill-Down Kategori →
                    </button>
                  </div>

                  <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Utilisasi Anggaran (Budget)
                    </div>
                    <div className="my-2">
                      <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 dark:text-white">
                        {overallBudgetUtilization}%
                      </div>
                      <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 mt-2 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${overallBudgetUtilization}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono tabular-nums mt-1.5">
                        {formatIDR(totalBudgetSpent)} / {formatIDR(totalBudgetLimit)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('budgets')}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline text-left"
                    >
                      Kelola Batas Anggaran →
                    </button>
                  </div>

                  <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Nutrisi Harian Terverifikasi
                    </div>
                    <div className="my-2">
                      <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 dark:text-white">
                        {todayMacros.cal} <span className="text-xs font-normal text-neutral-400">kkal</span>
                      </div>
                      <div className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                        {todayMacros.prot.toFixed(1)}g P · {todayMacros.carb.toFixed(1)}g K · {todayMacros.fat.toFixed(1)}g L
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('nutrition')}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline text-left"
                    >
                      Scan Foto Makanan AI →
                    </button>
                  </div>
                </div>
              </div>

              {/* Honest Empty State when Database has 0 Transactions (Section 15 Real Data Policy) */}
              {transactions.length === 0 ? (
                <div
                  data-testid="empty-database-state"
                  className="p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-center max-w-2xl mx-auto space-y-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                      Database Anda Masih Kosong (Zero Dummy Data Policy)
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      Sesuai kebijakan kejujuran data MoneyScope, kami tidak menampilkan statistik fiktif atau transaksi palsu saat database kosong. Tambahkan transaksi pertama Anda untuk mengaktifkan grafik analitik, Smart Insights, dan perhitungan korelasi nutrisi.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setQuickAddOpen(true)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      Tambah Transaksi Pertama
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('nutrition')}
                      className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold transition-colors"
                    >
                      Scan Foto Makanan (AI Nutrition)
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Charts Row when real transactions exist */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                            Tren Arus Kas Harian ({monthWindow.label})
                          </h2>
                          <p className="text-xs text-neutral-500">
                            Dihitung langsung dari {transactions.length} transaksi tersimpan.
                          </p>
                        </div>
                      </div>
                      <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={monthAnalytics.dailySeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                            <YAxis
                              tick={{ fontSize: 11, fill: '#94a3b8' }}
                              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                            />
                            <Tooltip
                              formatter={(val) => formatIDR(Number(val ?? 0))}
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                borderColor: '#1e293b',
                                borderRadius: '12px',
                                color: '#fff',
                                fontSize: '12px',
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="income"
                              name="Pemasukan"
                              stroke="#10b981"
                              strokeWidth={2}
                              fill="#10b981"
                              fillOpacity={0.2}
                            />
                            <Area
                              type="monotone"
                              dataKey="expense"
                              name="Pengeluaran"
                              stroke="#f43f5e"
                              strokeWidth={2}
                              fill="#f43f5e"
                              fillOpacity={0.2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="lg:col-span-4 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
                      <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                        Komposisi Kategori Pengeluaran
                      </h2>
                      <div className="h-[190px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={monthAnalytics.categoryBreakdown}
                              dataKey="amount"
                              nameKey="category"
                              innerRadius={48}
                              outerRadius={76}
                              paddingAngle={3}
                            >
                              {monthAnalytics.categoryBreakdown.map((entry, idx) => (
                                <Cell
                                  key={entry.category}
                                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
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
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {monthAnalytics.categoryBreakdown.slice(0, 4).map((c) => (
                          <div key={c.category} className="flex items-center justify-between">
                            <span className="text-neutral-600 dark:text-neutral-300">
                              {c.category} ({c.percentage}%)
                            </span>
                            <span className="font-mono tabular-nums font-semibold">
                              {formatIDR(c.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Smart Insights & Recent Timeline */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
                      <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                        Smart Insights (Dari Transaksi Aktual)
                      </h2>
                      <div className="space-y-3">
                        {smartInsights.map((ins) => (
                          <div
                            key={ins.id}
                            className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 space-y-1"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-neutral-900 dark:text-white">
                                {ins.title}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-500">{ins.description}</p>
                            <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 pt-0.5">
                              {ins.metricLabel}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="lg:col-span-7 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                          Aktivitas Finansial Terbaru
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('transactions')}
                          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Lihat Semua Transaksi →
                        </button>
                      </div>
                      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {monthAnalytics.filteredTransactions.slice(0, 6).map((tx) => (
                          <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-semibold text-neutral-900 dark:text-white">
                                {tx.description}
                              </div>
                              <div className="text-[11px] text-neutral-500">
                                {tx.category} · {tx.subcategory} · {formatDateID(tx.transactionDate)} ·{' '}
                                {tx.transactionTime}
                              </div>
                            </div>
                            <div
                              className={`font-mono tabular-nums font-bold text-sm ${
                                tx.type === 'income'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {tx.type === 'income' ? '+' : '-'}
                              {formatIDR(tx.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: TRANSAKSI */}
          {activeTab === 'transactions' && (
            <TransactionsView
              transactions={transactions}
              categories={allCategories}
              accounts={accounts}
              referenceDate={REFERENCE_TODAY}
              userId={user?.uid || 'local-user'}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onBulkImportTransactions={handleBulkImportTransactions}
            />
          )}

          {/* TAB 3: ANALITIK WAKTU */}
          {activeTab === 'analytics' && (
            <TimeAnalyticsView
              transactions={transactions}
              referenceDate={REFERENCE_TODAY}
            />
          )}

          {/* TAB 4: ANGGARAN & AKUN */}
          {activeTab === 'budgets' && (
            <BudgetsAccountsView
              accounts={accounts}
              budgets={budgets}
              categories={allCategories}
              transactions={transactions}
              referenceDate={REFERENCE_TODAY}
              onAddAccount={handleAddAccount}
              onDeleteAccount={handleDeleteAccount}
              onAddBudget={handleAddBudget}
              onDeleteBudget={handleDeleteBudget}
              onAddCategory={handleAddCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}

          {/* TAB 5: NUTRISI & AI SCAN */}
          {activeTab === 'nutrition' && (
            <NutritionIntelligenceView
              foodLogs={foodLogs}
              transactions={transactions}
              dailyCalorieTarget={dailyCalorieTarget}
              dailyProteinTarget={dailyProteinTarget}
              referenceDate={REFERENCE_TODAY}
              onSaveFoodLog={handleSaveFoodLog}
              onDeleteFoodLog={handleDeleteFoodLog}
              defaultAccountId={accounts[0]?.id || 'acc-bca'}
            />
          )}

          {/* TAB 6: 3D WEALTH & MACRO STUDIO */}
          {activeTab === 'studio3d' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                  3D Spatial Wealth &amp; Nutrition Vault Studio
                </h2>
                <p className="text-xs text-neutral-500">
                  Visualisasi spasial interaktif Three.js yang memetakan proporsi Pemasukan, Pengeluaran Makanan, Jajan, dan Makro Nutrisi harian secara real-time.
                </p>
              </div>
              <Wealth3DStudio
                totalBalance={totalAccountBalance}
                monthlyIncome={monthAnalytics.totalIncome}
                monthlyExpense={monthAnalytics.totalExpense}
                makananExpense={monthAnalytics.makananExpense}
                jajanExpense={monthAnalytics.jajanExpense}
                dailyCalories={todayMacros.cal}
                dailyProtein={todayMacros.prot}
                dailyCarbs={todayMacros.carb}
                dailyFat={todayMacros.fat}
              />
            </div>
          )}

          {/* TAB 7: LAPORAN TELEGRAM & WHATSAPP */}
          {activeTab === 'reports' && (
            <ReportsIntegrationsView
              transactions={transactions}
              foodLogs={foodLogs}
              referenceDate={REFERENCE_TODAY}
              preference={reportPreference}
              onSavePreference={async (pref) => setReportPreference(pref)}
            />
          )}

          {/* TAB 8: PENGATURAN, PROFIL & PRIVASI DATA */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl space-y-6">
              <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                  Profil Pengguna &amp; Target Nutrisi Harian
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label htmlFor="target-cal" className="block text-neutral-500 mb-1">
                      Target Kalori Harian (kkal)
                    </label>
                    <input
                      id="target-cal"
                      type="number"
                      value={dailyCalorieTarget}
                      onChange={(e) => setDailyCalorieTarget(Number(e.target.value) || 2000)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="target-prot" className="block text-neutral-500 mb-1">
                      Target Protein Harian (gram)
                    </label>
                    <input
                      id="target-prot"
                      type="number"
                      value={dailyProteinTarget}
                      onChange={(e) => setDailyProteinTarget(Number(e.target.value) || 100)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl border border-rose-500/30 bg-white dark:bg-neutral-900 space-y-4">
                <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">
                  Kontrol Privasi &amp; Penghapusan Data Pribadi
                </h3>
                <p className="text-xs text-neutral-500">
                  Anda memiliki kendali penuh untuk menghapus seluruh riwayat transaksi, jurnal foto makanan, dan anggaran kapan saja.
                </p>
                <button
                  type="button"
                  onClick={handleClearAllUserData}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Seluruh Data Transaksi &amp; Jurnal
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Quick Add Floating Modal */}
      {quickAddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-add-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="quick-add-title" className="text-base font-bold text-neutral-900 dark:text-white">
                Catat Transaksi Cepat (Quick Add)
              </h2>
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                aria-label="Tutup Modal Quick Add"
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setQaType('expense')}
                className={`py-2 rounded-lg ${
                  qaType === 'expense' ? 'bg-rose-600 text-white' : 'text-neutral-500'
                }`}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => setQaType('income')}
                className={`py-2 rounded-lg ${
                  qaType === 'income' ? 'bg-emerald-600 text-white' : 'text-neutral-500'
                }`}
              >
                Pemasukan
              </button>
            </div>

            {qaError && (
              <div role="alert" className="p-2.5 rounded-lg bg-rose-500/10 text-rose-500 text-xs">
                {qaError}
              </div>
            )}

            <form onSubmit={handleQuickAddSubmit} className="space-y-3 text-xs">
              <div>
                <label htmlFor="qa-amount" className="block text-neutral-500 mb-1">
                  Nominal (Rp)
                </label>
                <input
                  id="qa-amount"
                  type="number"
                  required
                  min={1}
                  value={qaAmount}
                  onChange={(e) => setQaAmount(e.target.value)}
                  placeholder="25000"
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 font-mono text-base font-bold"
                />
              </div>

              {qaType === 'expense' && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="qa-cat" className="block text-neutral-500 mb-1">
                      Kategori
                    </label>
                    <select
                      id="qa-cat"
                      value={qaCategory}
                      onChange={(e) => {
                        const c = e.target.value;
                        setQaCategory(c);
                        const found = allCategories.find((x) => x.name === c);
                        if (found?.subcategories[0]) setQaSubcategory(found.subcategories[0]);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    >
                      {allCategories
                        .filter((c) => c.type === 'expense')
                        .map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="qa-subcat" className="block text-neutral-500 mb-1">
                      Subkategori
                    </label>
                    <select
                      id="qa-subcat"
                      value={qaSubcategory}
                      onChange={(e) => setQaSubcategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    >
                      {(
                        allCategories.find((c) => c.name === qaCategory)?.subcategories || [
                          'Makan siang',
                        ]
                      ).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="qa-desc" className="block text-neutral-500 mb-1">
                  Deskripsi Singkat
                </label>
                <input
                  id="qa-desc"
                  type="text"
                  required
                  value={qaDescription}
                  onChange={(e) => setQaDescription(e.target.value)}
                  placeholder="Contoh: Makan Siang Ayam Bakar"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition-colors"
              >
                Simpan Transaksi Sekarang
              </button>
            </form>
          </div>
        </div>
      )}

      {/* iOS PWA Install Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="max-w-sm w-full rounded-2xl bg-white dark:bg-neutral-900 p-6 border border-neutral-800 space-y-3 text-xs">
            <h3 className="text-base font-bold">Install MoneyScope di iOS</h3>
            <p className="text-neutral-400 leading-relaxed">
              1. Ketuk tombol <strong>Share</strong> di bilah bawah Safari.<br />
              2. Pilih <strong>Add to Home Screen</strong> untuk menginstal MoneyScope sebagai aplikasi penuh.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 rounded-lg bg-emerald-500 text-neutral-950 font-bold"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Mobile iOS 26 Liquid Glass Bottom Navigation Bar */}
      <MobileLiquidNavbar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onQuickAdd={() => setQuickAddOpen(true)}
      />
    </div>
  );
}
