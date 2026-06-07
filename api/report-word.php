<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = file_get_contents('php://input');
$payload = json_decode($input, true);

if (!$payload) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

function clean($value, $max = 200) {
    if (!is_string($value)) $value = (string)$value;
    $value = preg_replace('/[\x00-\x1F\x7F]/', ' ', $value);
    return trim(mb_substr($value, 0, $max));
}

$wordId = clean($payload['wordId'] ?? '', 120);
$word = clean($payload['word'] ?? '', 120);
$translation = clean($payload['translation'] ?? '', 180);
$message = clean($payload['message'] ?? '', 1000);
$appVersion = clean($payload['appVersion'] ?? '', 40);

if (empty($wordId) || empty($message)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

// These tokens will be replaced during the GitHub Actions deployment
$token = '{{TELEGRAM_BOT_TOKEN}}';
$chatId = '{{TELEGRAM_CHAT_ID}}';

if ($token === '{{TELEGRAM_BOT_TOKEN}}' || empty($token)) {
    http_response_code(503);
    echo json_encode(['error' => 'Report backend is not configured']);
    exit;
}

$text = implode("\n", [
    'Новая жалоба в словаре LezgiMez',
    "Слово: $word",
    "Перевод: $translation",
    "ID: $wordId",
    "Версия: " . ($appVersion ?: 'unknown'),
    "Описание: $message"
]);

$tgUrl = "https://api.telegram.org/bot{$token}/sendMessage";
$data = json_encode(['chat_id' => $chatId, 'text' => $text]);

$options = [
    'http' => [
        'header'  => "Content-Type: application/json\r\n",
        'method'  => 'POST',
        'content' => $data,
        'ignore_errors' => true,
    ]
];
$context = stream_context_create($options);
$result = file_get_contents($tgUrl, false, $context);

if ($result === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Telegram failed']);
    exit;
}

echo json_encode(['ok' => true]);
