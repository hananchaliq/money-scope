'use client';

import React, { useState, useMemo } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Unplug,
  FileText,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import {
  AnalyticsPeriodKey,
  FoodLogRecord,
  ReportPreference,
  TransactionRecord,
} from '@/lib/types';
import { buildAutomatedReportMessage } from '@/lib/analytics-engine';

interface ReportsIntegrationsViewProps {
  transactions: TransactionRecord[];
  foodLogs: FoodLogRecord[];
  referenceDate: string;
  preference: ReportPreference;
  onSavePreference: (pref: ReportPreference) => Promise<void>;
}

export function ReportsIntegrationsView({
  transactions,
  foodLogs,
  referenceDate,
  preference,
  onSavePreference,
}: ReportsIntegrationsViewProps) {
  const [frequency, setFrequency] = useState<ReportPreference['frequency']>(preference.frequency);
  const [includeFinancial, setIncludeFinancial] = useState<boolean>(preference.includeFinancial);
  const [includeNutrition, setIncludeNutrition] = useState<boolean>(preference.includeNutrition);
  const [previewPeriod, setPreviewPeriod] = useState<AnalyticsPeriodKey>('this_month');

  // Telegram real connection state (Honest status: false until verified via API)
  const [telegramBotToken, setTelegramBotToken] = useState<string>('');
  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const [telegramConnectedBot, setTelegramConnectedBot] = useState<string | null>(null);
  const [telegramStatusMsg, setTelegramStatusMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState<boolean>(false);

  // WhatsApp Business Cloud API state (Honest status: false until verified via Meta Graph API)
  const [waAccessToken, setWaAccessToken] = useState<string>('');
  const [waPhoneNumberId, setWaPhoneNumberId] = useState<string>('');
  const [waRecipientPhone, setWaRecipientPhone] = useState<string>('');
  const [waConnectedDisplay, setWaConnectedDisplay] = useState<string | null>(null);
  const [waStatusMsg, setWaStatusMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [isTestingWa, setIsTestingWa] = useState<boolean>(false);

  const reportPreviewText = useMemo(
    () =>
      buildAutomatedReportMessage(transactions, foodLogs, referenceDate, {
        includeFinancial,
        includeNutrition,
        periodKey: previewPeriod,
      }),
    [transactions, foodLogs, referenceDate, includeFinancial, includeNutrition, previewPeriod]
  );

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramStatusMsg(null);
    try {
      const res = await fetch('/api/integrations/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_connection',
          botToken: telegramBotToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.connected) {
        setTelegramConnectedBot(null);
        setTelegramStatusMsg({
          type: 'err',
          text: data.error || 'Koneksi Telegram gagal.',
        });
        return;
      }
      setTelegramConnectedBot(data.botUsername);
      setTelegramStatusMsg({
        type: 'ok',
        text: data.message,
      });
    } catch {
      setTelegramConnectedBot(null);
      setTelegramStatusMsg({
        type: 'err',
        text: 'Gagal menghubungi endpoint Telegram.',
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleSendTelegramReport = async () => {
    setIsTestingTelegram(true);
    setTelegramStatusMsg(null);
    try {
      const res = await fetch('/api/integrations/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_report',
          botToken: telegramBotToken,
          chatId: telegramChatId,
          messageText: reportPreviewText,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.sent) {
        setTelegramStatusMsg({
          type: 'err',
          text: data.error || 'Gagal mengirim laporan ke Telegram.',
        });
        return;
      }
      setTelegramConnectedBot(data.botUsername);
      setTelegramStatusMsg({
        type: 'ok',
        text: data.message,
      });
    } catch {
      setTelegramStatusMsg({
        type: 'err',
        text: 'Kesalahan jaringan saat mengirim laporan Telegram.',
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleDisconnectTelegram = () => {
    setTelegramBotToken('');
    setTelegramChatId('');
    setTelegramConnectedBot(null);
    setTelegramStatusMsg({
      type: 'err',
      text: 'Integrasi Telegram telah diputuskan.',
    });
  };

  const handleTestWhatsApp = async () => {
    setIsTestingWa(true);
    setWaStatusMsg(null);
    try {
      const res = await fetch('/api/integrations/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_connection',
          accessToken: waAccessToken,
          phoneNumberId: waPhoneNumberId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.connected) {
        setWaConnectedDisplay(null);
        setWaStatusMsg({
          type: 'err',
          text: data.error || 'Koneksi WhatsApp Cloud API gagal.',
        });
        return;
      }
      setWaConnectedDisplay(data.displayPhone);
      setWaStatusMsg({
        type: 'ok',
        text: data.message,
      });
    } catch {
      setWaConnectedDisplay(null);
      setWaStatusMsg({
        type: 'err',
        text: 'Gagal menghubungi endpoint WhatsApp Cloud API.',
      });
    } finally {
      setIsTestingWa(false);
    }
  };

  const handleSendWhatsAppReport = async () => {
    setIsTestingWa(true);
    setWaStatusMsg(null);
    try {
      const res = await fetch('/api/integrations/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_report',
          accessToken: waAccessToken,
          phoneNumberId: waPhoneNumberId,
          recipientPhone: waRecipientPhone,
          messageText: reportPreviewText,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.sent) {
        setWaStatusMsg({
          type: 'err',
          text: data.error || 'Gagal mengirim pesan melalui WhatsApp Cloud API.',
        });
        return;
      }
      setWaConnectedDisplay(data.displayPhone);
      setWaStatusMsg({
        type: 'ok',
        text: data.message,
      });
    } catch {
      setWaStatusMsg({
        type: 'err',
        text: 'Kesalahan jaringan saat mengirim laporan WhatsApp.',
      });
    } finally {
      setIsTestingWa(false);
    }
  };

  const handleDisconnectWhatsApp = () => {
    setWaAccessToken('');
    setWaPhoneNumberId('');
    setWaRecipientPhone('');
    setWaConnectedDisplay(null);
    setWaStatusMsg({
      type: 'err',
      text: 'Integrasi WhatsApp Business Cloud API telah diputuskan.',
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Integration Channels & Schedule Config */}
      <div className="lg:col-span-7 space-y-6">
        {/* Schedule & Report Content Preferences */}
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
            Konfigurasi Jadwal &amp; Isi Laporan Berkala
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="report-freq" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Frekuensi Pengiriman Otomatis
              </label>
              <select
                id="report-freq"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ReportPreference['frequency'])}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
              >
                <option value="daily">Harian (Setiap 20:00 WIB)</option>
                <option value="weekly">Mingguan (Setiap Minggu Malam)</option>
                <option value="biweekly">Setiap 2 Minggu</option>
                <option value="monthly">Bulanan (Akhir Bulan)</option>
                <option value="quarterly">Setiap 3 Bulan (Kuartalan)</option>
                <option value="custom">Jadwal Kustom</option>
              </select>
            </div>
            <div>
              <label htmlFor="preview-period" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Periode Data untuk Laporan Saat Ini
              </label>
              <select
                id="preview-period"
                value={previewPeriod}
                onChange={(e) => setPreviewPeriod(e.target.value as AnalyticsPeriodKey)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
              >
                <option value="today">Hari Ini</option>
                <option value="last_7_days">7 Hari Terakhir</option>
                <option value="last_14_days">14 Hari Terakhir</option>
                <option value="this_month">Bulan Ini</option>
                <option value="last_month">Bulan Sebelumnya</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-200 cursor-pointer">
              <input
                type="checkbox"
                checked={includeFinancial}
                onChange={(e) => setIncludeFinancial(e.target.checked)}
                className="rounded accent-emerald-600"
              />
              <span>Sertakan Financial Report (Pemasukan, Pengeluaran, Makanan vs Jajan, Insight)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-200 cursor-pointer">
              <input
                type="checkbox"
                checked={includeNutrition}
                onChange={(e) => setIncludeNutrition(e.target.checked)}
                className="rounded accent-emerald-600"
              />
              <span>Sertakan Nutrition Report (Kalori, Protein, Karbo, Lemak, Frekuensi Makan)</span>
            </label>
          </div>

          <button
            type="button"
            onClick={() =>
              onSavePreference({
                ...preference,
                frequency,
                includeFinancial,
                includeNutrition,
                telegramEnabled: Boolean(telegramConnectedBot),
                whatsappEnabled: Boolean(waConnectedDisplay),
                updatedAt: new Date().toISOString(),
              })
            }
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
          >
            Simpan Preferensi Jadwal Laporan
          </button>
        </div>

        {/* Telegram Bot API Integration Card */}
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Telegram Bot API Integration
              </h3>
              <p className="text-xs text-neutral-500">
                Hubungkan bot Telegram resmi melalui @BotFather dan kirim laporan langsung ke Chat ID Anda.
              </p>
            </div>
            <span className="text-xs font-medium text-neutral-500">
              Status:{' '}
              {telegramConnectedBot ? (
                <strong className="text-emerald-600 dark:text-emerald-400">
                  Terhubung (@{telegramConnectedBot})
                </strong>
              ) : (
                <strong className="text-amber-600 dark:text-amber-400">Belum Terhubung</strong>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="tg-token" className="block text-xs text-neutral-500 mb-1">
                Telegram Bot Token (@BotFather)
              </label>
              <input
                id="tg-token"
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
              />
            </div>
            <div>
              <label htmlFor="tg-chatid" className="block text-xs text-neutral-500 mb-1">
                Telegram Chat ID Tujuan
              </label>
              <input
                id="tg-chatid"
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Contoh: 987654321"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
              />
            </div>
          </div>

          {telegramStatusMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                telegramStatusMsg.type === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30'
              }`}
            >
              {telegramStatusMsg.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{telegramStatusMsg.text}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isTestingTelegram}
              onClick={handleTestTelegram}
              className="px-3.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Test Connection
            </button>
            <button
              type="button"
              disabled={isTestingTelegram}
              onClick={handleSendTelegramReport}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              Send Now / Send Test Report
            </button>
            <button
              type="button"
              onClick={handleDisconnectTelegram}
              className="px-3.5 py-2 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Unplug className="w-3.5 h-3.5" />
              Disconnect Integration
            </button>
          </div>
        </div>

        {/* WhatsApp Business Cloud API Integration Card */}
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                WhatsApp Business Cloud API (Official Meta Graph API)
              </h3>
              <p className="text-xs text-neutral-500">
                Menggunakan endpoint resmi Meta Graph API v20.0. Membutuhkan nomor bisnis terdaftar, Phone Number ID, dan Access Token.
              </p>
            </div>
            <span className="text-xs font-medium text-neutral-500">
              Status:{' '}
              {waConnectedDisplay ? (
                <strong className="text-emerald-600 dark:text-emerald-400">
                  Terhubung ({waConnectedDisplay})
                </strong>
              ) : (
                <strong className="text-amber-600 dark:text-amber-400">Belum Terhubung</strong>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="wa-phone-id" className="block text-xs text-neutral-500 mb-1">
                Phone Number ID
              </label>
              <input
                id="wa-phone-id"
                type="text"
                value={waPhoneNumberId}
                onChange={(e) => setWaPhoneNumberId(e.target.value)}
                placeholder="109283746512345"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
              />
            </div>
            <div>
              <label htmlFor="wa-token" className="block text-xs text-neutral-500 mb-1">
                Meta Cloud Access Token
              </label>
              <input
                id="wa-token"
                type="password"
                value={waAccessToken}
                onChange={(e) => setWaAccessToken(e.target.value)}
                placeholder="EAAG..."
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
              />
            </div>
            <div>
              <label htmlFor="wa-recipient" className="block text-xs text-neutral-500 mb-1">
                Nomor Penerima (628...)
              </label>
              <input
                id="wa-recipient"
                type="text"
                value={waRecipientPhone}
                onChange={(e) => setWaRecipientPhone(e.target.value)}
                placeholder="6281234567890"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
              />
            </div>
          </div>

          {waStatusMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                waStatusMsg.type === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30'
              }`}
            >
              {waStatusMsg.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{waStatusMsg.text}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isTestingWa}
              onClick={handleTestWhatsApp}
              className="px-3.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Test Connection
            </button>
            <button
              type="button"
              disabled={isTestingWa}
              onClick={handleSendWhatsAppReport}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Send Now via WhatsApp Cloud
            </button>
            <button
              type="button"
              onClick={handleDisconnectWhatsApp}
              className="px-3.5 py-2 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Unplug className="w-3.5 h-3.5" />
              Disconnect Integration
            </button>
          </div>
        </div>
      </div>

      {/* Right: Live Report Preview sourced strictly from User Database */}
      <div className="lg:col-span-5 p-4 sm:p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121716] space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-500" />
          <h3 className="text-base font-bold text-neutral-900 dark:text-white">
            Pratinjau Pesan Laporan
          </h3>
        </div>
        <p className="text-xs text-neutral-500">
          Format pesan laporan yang akan dikirimkan ke Telegram atau WhatsApp Anda:
        </p>
        <pre className="p-4 rounded-2xl bg-neutral-950 text-emerald-300 font-mono text-xs whitespace-pre-wrap leading-relaxed border border-neutral-800 overflow-x-auto">
          {reportPreviewText}
        </pre>
      </div>
    </div>
  );
}
