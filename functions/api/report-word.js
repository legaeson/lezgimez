const MAX_MESSAGE_LENGTH = 1000;

function clean(value, max = 200) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max).trim();
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const wordId = clean(body.wordId, 120);
  const word = clean(body.word, 120);
  const translation = clean(body.translation, 180);
  const message = clean(body.message, MAX_MESSAGE_LENGTH);
  const appVersion = clean(body.appVersion, 40);

  if (!wordId || !message || message.length > MAX_MESSAGE_LENGTH) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const token = context.env.TELEGRAM_BOT_TOKEN;
  const chatId = context.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    return new Response(JSON.stringify({ error: 'Report backend is not configured' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  const text = [
    'Новая жалоба в словаре LezgiMez',
    `Слово: ${word}`,
    `Перевод: ${translation}`,
    `ID: ${wordId}`,
    `Версия: ${appVersion || 'unknown'}`,
    `Описание: ${message}`
  ].join('\n');

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });

    if (!tg.ok) {
      return new Response(JSON.stringify({ error: 'Telegram failed' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
