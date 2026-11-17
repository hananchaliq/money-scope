export type TransactionType = 'income' | 'expense' | 'transfer';

export type AccountType = 'cash' | 'bank' | 'ewallet' | 'investment';

export interface FinancialAccount {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  balance: number;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  amount: number;
  type: TransactionType;
  category: string;
  subcategory: string;
  description: string;
  transactionDate: string; // YYYY-MM-DD
  transactionTime: string; // HH:mm
  paymentMethod: string;
  accountId: string;
  toAccountId?: string;
  merchant?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDefinition {
  id: string;
  userId: string;
  name: string;
  type: 'income' | 'expense';
  group: string;
  subcategories: string[];
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetRecord {
  id: string;
  userId: string;
  name: string;
  category: string;
  subcategory?: string;
  limitAmount: number;
  period: 'weekly' | 'monthly' | 'custom';
  threshold50: boolean;
  threshold80: boolean;
  threshold100: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EstimationStatus =
  | 'verified_match'
  | 'estimated_portion'
  | 'uncertain_identification'
  | 'unavailable_data';

export interface VerifiedFoodItem {
  id: string;
  foodName: string;
  matchedDbId: string;
  matchedDbName: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  dataSource: string;
  confidenceScore: number; // 0 to 1
  estimationStatus: EstimationStatus;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drinks';
export type ConsumptionKind = 'makan_utama' | 'jajan';

export interface FoodLogRecord {
  id: string;
  userId: string;
  mealType: MealType;
  consumptionKind: ConsumptionKind;
  mealName: string;
  logDate: string; // YYYY-MM-DD
  logTime: string; // HH:mm
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  totalSodium: number;
  costAmount: number;
  linkedTransactionId?: string;
  items: VerifiedFoodItem[];
  itemsSummary: string;
  dataSourceSummary: string;
  createdAt: string;
  updatedAt: string;
}

export type AnalyticsPeriodKey =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'this_week'
  | 'last_week'
  | 'last_14_days'
  | 'first_2_weeks'
  | 'last_2_weeks'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'last_year'
  | 'custom';

export interface DateRangeWindow {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  previousStartDate: string;
  previousEndDate: string;
  label: string;
  periodKind: 'rolling' | 'calendar' | 'custom';
  description: string;
}

export interface SmartInsight {
  id: string;
  type: 'warning' | 'positive' | 'neutral';
  title: string;
  description: string;
  metricLabel: string;
}

export interface BudgetStatusSummary {
  budget: BudgetRecord;
  spent: number;
  remaining: number;
  percentageUsed: number;
  projectedSpend: number;
  alertLevel: 'normal' | 'warning_50' | 'warning_80' | 'reached_100' | 'exceeded';
}

export interface ReportPreference {
  userId: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'custom';
  telegramEnabled: boolean;
  whatsappEnabled: boolean;
  includeFinancial: boolean;
  includeNutrition: boolean;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  currency: string;
  timezone: string;
  dailyCalorieTarget: number;
  dailyProteinTarget: number;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPrivateInfo {
  userId: string;
  email: string;
  telegramChatId?: string;
  whatsappPhone?: string;
  updatedAt: string;
}

export const DEFAULT_CATEGORIES: Omit<CategoryDefinition, 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'cat-makanan',
    name: 'Makanan',
    type: 'expense',
    group: 'Makanan Utama',
    subcategories: ['Sarapan', 'Makan siang', 'Makan malam', 'Restoran', 'Fast food'],
    isSystem: true,
  },
  {
    id: 'cat-jajan',
    name: 'Jajan',
    type: 'expense',
    group: 'Konsumsi Ringan & Minuman',
    subcategories: ['Jajan', 'Camilan', 'Minuman', 'Kopi'],
    isSystem: true,
  },
  {
    id: 'cat-kebutuhan',
    name: 'Kebutuhan',
    type: 'expense',
    group: 'Kebutuhan Pokok',
    subcategories: ['Belanja', 'Transportasi', 'Pendidikan', 'Kesehatan', 'Tagihan', 'Kebutuhan pribadi'],
    isSystem: true,
  },
  {
    id: 'cat-hiburan',
    name: 'Hiburan',
    type: 'expense',
    group: 'Gaya Hidup',
    subcategories: ['Game', 'Entertainment', 'Subscription', 'Hobi'],
    isSystem: true,
  },
  {
    id: 'cat-lainnya',
    name: 'Lainnya',
    type: 'expense',
    group: 'Lain-lain',
    subcategories: ['Sedekah', 'Hadiah', 'Pengeluaran lainnya'],
    isSystem: true,
  },
  {
    id: 'cat-pemasukan',
    name: 'Pemasukan',
    type: 'income',
    group: 'Sumber Pendapatan',
    subcategories: ['Gaji', 'Uang saku', 'Freelance', 'Bisnis', 'Investasi', 'Hadiah', 'Pemasukan lainnya'],
    isSystem: true,
  },
];
