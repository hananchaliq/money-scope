import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, botToken, chatId, messageText } = body as {
      action: 'test_connection' | 'send_report';
      botToken?: string;
      chatId?: string;
      messageText?: string;
    };

    const resolvedToken = (botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();

    if (!resolvedToken) {
      return NextResponse.json(
        {
          connected: false,
          error:
            'Telegram Bot Token belum dikonfigurasi. Buat bot melalui @BotFather di Telegram dan masukkan Bot Token untuk menghubungkan.',
        },
        { status: 400 }
      );
    }

    // Verify token via real Telegram Bot API getMe
    const getMeRes = await fetch(`https://api.telegram.org/bot${resolvedToken}/getMe`, {
      method: 'GET',
      signal: AbortSignal.timeout(6000),
    });
    const getMeData = await getMeRes.json();

    if (!getMeRes.ok || !getMeData?.ok) {
      return NextResponse.json(
        {
          connected: false,
          error: `Koneksi ke Telegram Bot API gagal: ${
            getMeData?.description || 'Token tidak valid atau ditolak oleh server Telegram.'
          }`,
        },
        { status: 401 }
      );
    }

    const botUsername = getMeData.result?.username || 'TelegramBot';

    if (action === 'test_connection') {
      return NextResponse.json({
        connected: true,
        botUsername,
        message: `Terhubung secara nyata ke Telegram Bot @${botUsername}.`,
      });
    }

    if (!chatId || !chatId.trim()) {
      return NextResponse.json(
        {
          connected: true,
          botUsername,
          error: 'Chat ID Telegram tujuan wajib diisi untuk mengirim laporan.',
        },
        { status: 400 }
      );
    }

    const sendRes = await fetch(`https://api.telegram.org/bot${resolvedToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: messageText || '📊 Laporan Uji Coba MoneyScope berhasil dikirim.',
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(7000),
    });

    const sendData = await sendRes.json();
    if (!sendRes.ok || !sendData?.ok) {
      return NextResponse.json(
        {
          connected: true,
          botUsername,
          error: `Gagal mengirim pesan ke Chat ID ${chatId}: ${
            sendData?.description || 'Pastikan Anda sudah menekan /start pada bot tersebut.'
          }`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      connected: true,
      sent: true,
      botUsername,
      messageId: sendData.result?.message_id,
      message: `Laporan berhasil dikirim ke Telegram (Chat ID: ${chatId}) melalui @${botUsername}.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Kesalahan jaringan ke server Telegram.';
    return NextResponse.json(
      {
        connected: false,
        error: `Gagal menghubungi Telegram Bot API: ${msg}`,
      },
      { status: 500 }
    );
  }
}
