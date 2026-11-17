import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'MoneyScope — AI Personal Finance & Nutrition Intelligence',
    short_name: 'MoneyScope',
    description:
      'Platform manajemen keuangan pribadi dan intelijen nutrisi berbasis AI dengan analitik waktu, pengenalan makanan terverifikasi, dan laporan otomatis.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B0F0E',
    theme_color: '#10B981',
    icons: [
      {
        src: '/icon.svg',
        sizes: '192x192 512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/assets/aistudio/image_14a6645c.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/assets/aistudio/image_17e1c553.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
