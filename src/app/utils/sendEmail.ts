import config from '../config';

/**
 * Sends an email using Plunk API
 * @param to recipient email address
 * @param subject email subject
 * @param body email body (HTML)
 */
export const sendEmail = async (to: string, subject: string, body: string) => {
    try {
        const response = await fetch('https://api.useplunk.com/v1/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.plunk_secret_key}`,
            },
            body: JSON.stringify({
                to,
                subject,
                body,
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Plunk Email Error:', result);
            // We don't throw here to avoid breaking the main flow (e.g. order placement)
            // but we log it for debugging.
        }

        return result;
    } catch (error) {
        console.error('Plunk Email Request Failed:', error);
    }
};
