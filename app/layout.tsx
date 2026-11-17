import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
});

export const viewport: Viewport = {
  themeColor: '#10B981',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'MoneyScope — AI Personal Finance & Nutrition Intelligence',
  description:
    'Platform manajemen keuangan pribadi dan intelijen nutrisi berbasis AI dengan pencatatan transaksi multi-akun, analitik waktu presisi, pengenalan makanan terverifikasi, dan laporan otomatis Telegram/WhatsApp.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MoneyScope',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/assets/aistudio/image_14a6645c.png',
  },
  openGraph: {
    title: 'MoneyScope — AI Personal Finance & Nutrition Intelligence',
    description:
      'Platform manajemen keuangan pribadi dan intelijen nutrisi berbasis AI dengan pencatatan transaksi multi-akun, analitik waktu presisi, pengenalan makanan terverifikasi, dan laporan otomatis Telegram/WhatsApp.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MoneyScope — AI Personal Finance & Nutrition Intelligence',
    description:
      'Platform manajemen keuangan pribadi dan intelijen nutrisi berbasis AI dengan pencatatan transaksi multi-akun, analitik waktu presisi, pengenalan makanan terverifikasi, dan laporan otomatis Telegram/WhatsApp.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`dark ${plusJakarta.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-sans antialiased bg-neutral-50 text-neutral-900 dark:bg-[#0B0F0E] dark:text-neutral-100 min-h-screen selection:bg-emerald-500/30"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
