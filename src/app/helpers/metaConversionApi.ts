import crypto from 'crypto';

const hashField = (value?: string) => {
    if (!value) return undefined;
    return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
};

type TPurchaseEventParams = {
    pixelId?: string;
    accessToken?: string;
    email?: string;
    phone?: string;
    value: number;
    currency?: string;
    eventSourceUrl?: string;
};

// Minimal, fire-and-forget server-side "Purchase" event to Meta's Conversions
// API. No retry queue / dead-letter handling — a failed call here must never
// block or fail an order. Silently no-ops if the settings module hasn't been
// configured with a pixel ID + access token yet.
export const sendPurchaseConversionEvent = async (params: TPurchaseEventParams) => {
    const { pixelId, accessToken, email, phone, value, currency = 'BDT', eventSourceUrl } = params;

    if (!pixelId || !accessToken) return;

    try {
        const userData: Record<string, string[]> = {};
        const hashedEmail = hashField(email);
        const hashedPhone = hashField(phone);
        if (hashedEmail) userData.em = [hashedEmail];
        if (hashedPhone) userData.ph = [hashedPhone];

        const body = {
            data: [
                {
                    event_name: 'Purchase',
                    event_time: Math.floor(Date.now() / 1000),
                    action_source: 'website',
                    event_source_url: eventSourceUrl,
                    user_data: userData,
                    custom_data: {
                        currency,
                        value,
                    },
                },
            ],
        };

        const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            console.error('Facebook Conversion API returned an error (non-blocking):', res.status, text);
        }
    } catch (err) {
        console.error('Facebook Conversion API call failed (non-blocking):', err);
    }
};
