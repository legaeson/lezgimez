const MAX_MESSAGE_LENGTH = 1000;

function clean(value, max = 200) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max).trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const wordId = clean(body.wordId, 120);
  const word = clean(body.word, 120);
  const translation = clean(body.translation, 180);
  const message = clean(body.message, MAX_MESSAGE_LENGTH);
  const appVersion = clean(body.appVersion, 40);

  if (!wordId || !message || message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(503).json({ error: 'Report backend is not configured' });

  const text = [
    'Новая жалоба в словаре LezgiMez',
    `Слово: ${word}`,
    `Перевод: ${translation}`,
    `ID: ${wordId}`,
    `Версия: ${appVersion || 'unknown'}`,
    `Описание: ${message}`
  ].join('\n');

  const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });

  if (!tg.ok) return res.status(502).json({ error: 'Telegram failed' });
  return res.status(200).json({ ok: true });
}
