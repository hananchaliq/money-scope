import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, accessToken, phoneNumberId, recipientPhone, messageText } = body as {
      action: 'test_connection' | 'send_report';
      accessToken?: string;
      phoneNumberId?: string;
      recipientPhone?: string;
      messageText?: string;
    };

    const resolvedToken = (accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
    const resolvedPhoneId = (phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();

    if (!resolvedToken || !resolvedPhoneId) {
      return NextResponse.json(
        {
          connected: false,
          error:
            'WhatsApp Business Cloud API membutuhkan Phone Number ID dan Permanent/Temporary Access Token resmi dari Meta for Developers.',
        },
        { status: 400 }
      );
    }

    // Verify phone number ID with Meta Graph API
    const verifyRes = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(resolvedPhoneId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${resolvedToken}`,
      },
      signal: AbortSignal.timeout(6000),
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || verifyData?.error) {
      return NextResponse.json(
        {
          connected: false,
          error: `Verifikasi WhatsApp Business Cloud API gagal: ${
            verifyData?.error?.message || 'Token atau Phone Number ID tidak valid.'
          }`,
        },
        { status: 401 }
      );
    }

    const displayPhone = verifyData.display_phone_number || resolvedPhoneId;

    if (action === 'test_connection') {
      return NextResponse.json({
        connected: true,
        displayPhone,
        message: `Terhubung ke WhatsApp Business Cloud API (${displayPhone}).`,
      });
    }

    if (!recipientPhone || !recipientPhone.trim()) {
      return NextResponse.json(
        {
          connected: true,
          displayPhone,
          error: 'Nomor WhatsApp penerima (format internasional, contoh: 62812xxxx) wajib diisi.',
        },
        { status: 400 }
      );
    }

    const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
    const sendRes = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(resolvedPhoneId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolvedToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: messageText || '📊 Laporan MoneyScope Anda telah siap.',
          },
        }),
        signal: AbortSignal.timeout(7000),
      }
    );

    const sendData = await sendRes.json();
    if (!sendRes.ok || sendData?.error) {
      return NextResponse.json(
        {
          connected: true,
          displayPhone,
          error: `Gagal mengirim pesan WhatsApp: ${
            sendData?.error?.message ||
            'Pastikan penerima berada dalam jendela percakapan 24 jam atau gunakan Template Message resmi.'
          }`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      connected: true,
      sent: true,
      displayPhone,
      message: `Laporan berhasil dikirim melalui WhatsApp Business Cloud API ke +${cleanPhone}.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Kesalahan jaringan ke Meta Graph API.';
    return NextResponse.json(
      {
        connected: false,
        error: `Gagal menghubungi WhatsApp Business Cloud API: ${msg}`,
      },
      { status: 500 }
    );
  }
}
