const https = require('https');

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { message } = JSON.parse(event.body);
        if (!message || message.trim() === '') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Пустое сообщение' }) };
        }

        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!token || !chatId) {
            console.error('Missing telegram config');
            return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
        }

        const text = `🔔 Новое анонимное сообщение из LezgiMez:\n\n${message}`;

        return new Promise((resolve, reject) => {
            const data = JSON.stringify({ chat_id: chatId, text: text });
            const options = {
                hostname: 'api.telegram.org',
                path: `/bot${token}/sendMessage`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let chunks = [];
                res.on('data', (d) => chunks.push(d));
                res.on('end', () => {
                    const responseBody = Buffer.concat(chunks).toString();
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({
                            statusCode: 200,
                            body: JSON.stringify({ success: true })
                        });
                    } else {
                        console.error('Telegram error:', responseBody);
                        resolve({
                            statusCode: 502,
                            body: JSON.stringify({ error: 'Failed to send to Telegram' })
                        });
                    }
                });
            });

            req.on('error', (e) => {
                console.error(e);
                resolve({
                    statusCode: 500,
                    body: JSON.stringify({ error: e.message })
                });
            });

            req.write(data);
            req.end();
        });

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
