
        function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]] } return arr }

        // Анимация — однократный fade-in-up через inline style (не оставляет классов)
        function staggerCards(container) {
            const children = container.children;
            for (let i = 0; i < children.length; i++) {
                const el = children[i];
                const delay = Math.min(i, 14) * 0.015;
                el.style.animation = `fade-in-up 0.3s ease-out ${delay}s both`;
                el.addEventListener('animationend', function handler() {
                    el.style.animation = '';
                    el.removeEventListener('animationend', handler);
                }, { once: true });
            }
        }



        const AUDIO_ASSET_VERSION = '2026-05-27-2';
        const PRELOADED_AUDIO = {};
        const AUDIO_PLAYER = new Audio();

        function getVersionedAudioUrl(audioPath) {
            const url = new URL(audioPath, window.location.href);
            if (url.pathname.endsWith('.mp3')) {
                url.searchParams.set('v', AUDIO_ASSET_VERSION);
            }
            return url.toString();
        }

        function speakWord(text, audioPath) {
            if (audioPath) {
                const versionedUrl = getVersionedAudioUrl(audioPath);
                const cachedUrl = PRELOADED_AUDIO[versionedUrl] || versionedUrl;
                AUDIO_PLAYER.src = cachedUrl;
                AUDIO_PLAYER.play().catch(err => {
                    warn("Файл не найден, используем синтезатор:", err);
                    if (text) runFallbackSpeech(text);
                });
                return;
            }
            if (text) runFallbackSpeech(text);
        }

        function runFallbackSpeech(text) {
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'ru-RU';
            speechSynthesis.speak(utter);
        }

        function vibrateError() {
            if (!navigator.vibrate) return;
            navigator.vibrate([50, 30, 50]);
        }
        function vibrateSuccess() {
            if (!navigator.vibrate) return;
            navigator.vibrate(15);
        }
        function vibrateComplete() {
            if (!navigator.vibrate) return;
            navigator.vibrate([20, 20, 20]);
        }
