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

        function getVersionedAudioUrl(audioPath) {
            const url = new URL(audioPath, window.location.href);
            if (url.pathname.endsWith('.wav')) {
                url.searchParams.set('v', AUDIO_ASSET_VERSION);
            }
            return url.toString();
        }

        function speakWord(text, audioPath) {
            if (audioPath) {
                const audio = new Audio(getVersionedAudioUrl(audioPath));
                audio.play().catch(err => {
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

        // Global state
        let WORDS = [];
        let GRAMMAR = [];
        const APP_VERSION = '2.1.0';
        const DEBUG = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.search.includes('debug=1');
        const log = (...args) => { if (DEBUG) console.log(...args); };
        const warn = (...args) => { if (DEBUG) console.warn(...args); };
        const ALPHABET_AUDIO_FILES = [
            'а', 'б', 'в', 'г', 'гъ', 'гь', 'д', 'е', 'ж', 'з', 'и', 'й',
            'к', 'к1', 'къ', 'кь', 'л', 'м', 'н', 'п', 'п1', 'р', 'с', 'т',
            'т1', 'у', 'уь', 'ф', 'х', 'хъ', 'хь', 'ц', 'ц1', 'ч', 'ч1',
            'ш', 'ы', 'э', 'ю', 'я'
        ];
        let SEARCH_INDEX = [];
        let currentTab = 'alphabet';
        const PAGE_SIZE = 20;
        let loadedCount = 0;
        let currentFilter = { search: '', category: 'all' };
        let practiceCategory = 'all';
        const SCHEMA_VERSION = 1;
        let deferredPrompt = null;
        let tabSwitchGuard = false;

        const NICE_CATEGORY_NAMES = {
            'анатомия': 'Анатомия', 'быт': 'Быт', 'война': 'Война', 'время': 'Время', 'глаголы': 'Глаголы',
            'еда': 'Еда', 'животные': 'Животные', 'здоровье': 'Здоровье', 'искусство': 'Искусство',
            'качество': 'Качество', 'люди': 'Люди', 'материалы': 'Материалы', 'мера': 'Мера',
            'места': 'Места', 'местоим.': 'Местоимения', 'наречия': 'Наречия', 'обучение': 'Обучение',
            'общее': 'Общее', 'общение': 'Общение', 'одежда': 'Одежда', 'ощущения': 'Ощущения',
            'понятия': 'Понятия', 'предметы': 'Предметы', 'природа': 'Природа', 'работа': 'Работа',
            'религия': 'Религия', 'семья': 'Семья', 'события': 'События', 'спорт': 'Спорт',
            'тело': 'Тело', 'торговля': 'Торговля', 'транспорт': 'Транспорт', 'фразы': 'Фразы',
            'цвета': 'Цвета', 'числа': 'Числа', 'эмоции': 'Эмоции'
        };

        // IndexedDB Helper to sync with Service Worker
        async function syncNotifToIDB(enabled) {
            return new Promise((resolve) => {
                const request = indexedDB.open('lezgi_db', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('config');
                request.onsuccess = () => {
                    const db = request.result;
                    const tx = db.transaction('config', 'readwrite');
                    tx.objectStore('config').put(enabled, 'notif_enabled');
                    tx.oncomplete = () => resolve();
                };
            });
        }

        function supportsNotifications() {
            return typeof window !== 'undefined' && 'Notification' in window;
        }

        async function registerPeriodicReminder() {
            if (!('serviceWorker' in navigator)) return false;
            try {
                const registration = await navigator.serviceWorker.ready;
                if (!('periodicSync' in registration)) return false;
                if (!('permissions' in navigator) || !navigator.permissions.query) return false;
                const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
                if (status.state !== 'granted') return false;
                await registration.periodicSync.register('daily-reminder', { minInterval: 12 * 60 * 60 * 1000 });
                return true;
            } catch (e) {
                warn('[PWA] Periodic sync unavailable', e);
                return false;
            }
        }

        function updateNotifUI() {
            const bell = document.getElementById('notif-bell-icon');
            const statusText = document.getElementById('notif-status-text');
            if (!bell || !statusText) return;

            if (!supportsNotifications()) {
                bell.className = 'fa-solid fa-bell-slash w-5 text-center text-slate-400 transition-colors duration-200';
                statusText.textContent = 'Не поддерживаются этим браузером';
                return;
            }

            if (Notification.permission === 'denied') {
                bell.className = 'fa-solid fa-bell-slash w-5 text-center text-red-600 transition-colors duration-200';
                statusText.textContent = 'Запрещено в настройках браузера';
                return;
            }

            const isEnabled = localStorage.getItem('lezgi_notif_enabled') === '1';

            if (isEnabled && Notification.permission === 'granted') {
                bell.className = 'fa-solid fa-bell w-5 text-center text-emerald-600 transition-colors duration-200';
                statusText.textContent = 'Включены (18:00 - 21:00)';
            } else {
                bell.className = 'fa-regular fa-bell w-5 text-center text-slate-400 transition-colors duration-200';
                statusText.textContent = 'Выключены';
            }
        }

        async function requestNotificationPermission() {
            if (!supportsNotifications()) {
                alert('Этот браузер не поддерживает уведомления.');
                updateNotifUI();
                return;
            }
            const permission = await Notification.requestPermission();
            localStorage.setItem('lezgi_notif_asked', '1');
            dismissNotifBanner();

            if (permission === 'granted') {
                localStorage.setItem('lezgi_notif_enabled', '1');
                await syncNotifToIDB('1');
                await registerPeriodicReminder();
            }
            updateNotifUI();
        }

        async function toggleNotifications() {
            if (!supportsNotifications()) {
                updateNotifUI();
                return;
            }
            if (Notification.permission === 'default') {
                await requestNotificationPermission();
            } else if (Notification.permission === 'granted') {
                const newState = localStorage.getItem('lezgi_notif_enabled') === '1' ? '0' : '1';
                localStorage.setItem('lezgi_notif_enabled', newState);
                await syncNotifToIDB(newState);
                if (newState === '1') await registerPeriodicReminder();
                updateNotifUI();
            }
        }

        function dismissNotifBanner() {
            const banner = document.getElementById('notif-banner');
            if (banner) banner.classList.add('hidden');
            localStorage.setItem('lezgi_notif_asked', '1');
        }

        let PROGRESS = {
            favorites: [],
            learned: [],
            stats: { quizzes: 0, scoreSum: 0 },
            srs: {}
        };

        let saveProgressTimeout = null;
        function saveProgress(immediate = false) {
            clearTimeout(saveProgressTimeout);
            const save = () => {
                localStorage.setItem('lezgi_progress', JSON.stringify(PROGRESS));
                updateStatsUI();
            };
            if (immediate) save();
            else saveProgressTimeout = setTimeout(save, 1500);
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') saveProgress(true);
        });

        function exportProgress() {
            const blob = new Blob([JSON.stringify(PROGRESS, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `lezgi-progress-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        }

        function validateProgressData(data) {
            if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
            if (!Array.isArray(data.favorites) || !Array.isArray(data.learned)) return false;
            if (!data.favorites.every(id => typeof id === 'string' && id.length <= 120)) return false;
            if (!data.learned.every(id => typeof id === 'string' && id.length <= 120)) return false;
            if (data.favorites.length > 10000 || data.learned.length > 10000) return false;

            if (data.stats !== undefined) {
                if (!data.stats || typeof data.stats !== 'object' || Array.isArray(data.stats)) return false;
                const { quizzes, scoreSum } = data.stats;
                if (typeof quizzes !== 'number' || typeof scoreSum !== 'number') return false;
                if (!Number.isFinite(quizzes) || !Number.isFinite(scoreSum)) return false;
                if (quizzes < 0 || scoreSum < 0 || quizzes > 100000 || scoreSum > 10000000) return false;
            }

            if (data.srs !== undefined) {
                if (!data.srs || typeof data.srs !== 'object' || Array.isArray(data.srs)) return false;
                if (Object.keys(data.srs).length > 20000) return false;
                for (const key in data.srs) {
                    if (typeof key !== 'string' || key.length > 120) return false;
                    const val = data.srs[key];
                    if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
                    const numeric = ['next', 'last', 'ivl', 'success', 'errors'];
                    for (const field of numeric) {
                        if (typeof val[field] !== 'number' || !Number.isFinite(val[field])) return false;
                    }
                    if (val.ease !== undefined && (typeof val.ease !== 'number' || !Number.isFinite(val.ease))) return false;
                    if (val.ivl < 0 || val.ivl > 3650 || val.success < 0 || val.errors < 0) return false;
                }
            }
            return true;
        }

        function knownWordIds() {
            return new Set((WORDS || []).map(w => w.id));
        }

        function normalizeProgress(data) {
            const def = { favorites: [], learned: [], stats: { quizzes: 0, scoreSum: 0 }, srs: {} };
            if (!data || typeof data !== 'object' || Array.isArray(data)) return def;
            const ids = knownWordIds();
            const filterIds = (arr) => Array.from(new Set((Array.isArray(arr) ? arr : [])
                .filter(id => typeof id === 'string' && id.length <= 120)
                .filter(id => ids.size === 0 || ids.has(id))));

            const srs = {};
            const rawSrs = (data.srs && typeof data.srs === 'object' && !Array.isArray(data.srs)) ? data.srs : {};
            for (const [id, card] of Object.entries(rawSrs)) {
                if (ids.size && !ids.has(id)) continue;
                if (!card || typeof card !== 'object' || Array.isArray(card)) continue;
                const next = Number(card.next || 0);
                const last = Number(card.last || 0);
                const ivl = Math.max(0, Math.min(3650, Number(card.ivl || 0)));
                const success = Math.max(0, Math.min(100000, Number(card.success || 0)));
                const errors = Math.max(0, Math.min(100000, Number(card.errors || 0)));
                const ease = Math.max(1.3, Math.min(3.2, Number(card.ease || 2.5)));
                if ([next, last, ivl, success, errors, ease].every(Number.isFinite)) {
                    srs[id] = { next, last, ivl, success, errors, ease };
                }
            }

            return {
                favorites: filterIds(data.favorites),
                learned: filterIds(data.learned),
                stats: {
                    quizzes: Math.max(0, Math.min(100000, Number(data.stats?.quizzes || 0))),
                    scoreSum: Math.max(0, Math.min(10000000, Number(data.stats?.scoreSum || 0)))
                },
                srs
            };
        }

        function importProgress(file) {
            if (!file) return;
            if (file.size > 512 * 1024) {
                alert('Файл прогресса слишком большой. Максимум — 512 КБ.');
                return;
            }
            if (!confirm('Вы уверены? Текущий прогресс будет полностью заменен данными из файла.')) return;
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!validateProgressData(data)) throw new Error('invalid progress schema');
                    PROGRESS = normalizeProgress(data);
                    saveProgress(true);
                    alert('Прогресс успешно импортирован и проверен.');
                    location.reload();
                } catch (err) {
                    alert('Ошибка: неверный файл прогресса или неподдерживаемая схема.');
                }
            };
            reader.onerror = () => alert('Не удалось прочитать файл прогресса.');
            reader.readAsText(file);
        }

        function loadProgress() {
            const saved = localStorage.getItem('lezgi_progress');
            if (saved) {
                try {
                    PROGRESS = normalizeProgress(JSON.parse(saved));
                } catch (e) { warn('Error loading progress', e); }
            }
            if (!PROGRESS) PROGRESS = normalizeProgress(null);
            updateStatsUI();
        }

        function updateStatsUI() {
            const learnedEl = document.getElementById('stats-learned');
            const inProgressEl = document.getElementById('stats-in-progress');
            const notStartedEl = document.getElementById('stats-not-started');

            const favsEl = document.getElementById('stats-favs');
            const quizEl = document.getElementById('stats-quizzes');
            const avgScoreEl = document.getElementById('stats-avg-score');

            let learnedCount = 0;
            let inProgressCount = 0;
            let notStartedCount = 0;

            if (WORDS && WORDS.length > 0) {
                WORDS.forEach(w => {
                    const srs = PROGRESS.srs[w.id];
                    if (!srs || srs.ivl === 0) {
                        notStartedCount++;
                    } else if (srs.ivl >= 3) {
                        learnedCount++;
                    } else {
                        inProgressCount++;
                    }
                });
            }

            if (learnedEl) learnedEl.textContent = learnedCount;
            if (inProgressEl) inProgressEl.textContent = inProgressCount;
            if (notStartedEl) notStartedEl.textContent = notStartedCount;

            if (favsEl) favsEl.textContent = PROGRESS.favorites.length;
            if (quizEl) quizEl.textContent = PROGRESS.stats.quizzes;

            if (avgScoreEl) {
                if (PROGRESS.stats.quizzes > 0) {
                    const avg = (PROGRESS.stats.scoreSum / PROGRESS.stats.quizzes).toFixed(1);
                    avgScoreEl.textContent = avg;
                } else {
                    avgScoreEl.textContent = '—';
                }
            }
            updateTodayUI();
        }

        const SRS_RATING = Object.freeze({ Again: 1, Hard: 2, Good: 3, Easy: 4 });

        function ensureSrsCard(wordId) {
            if (!PROGRESS.srs[wordId]) {
                PROGRESS.srs[wordId] = { next: 0, last: 0, ivl: 0, success: 0, errors: 0, ease: 2.5 };
            }
            const card = PROGRESS.srs[wordId];
            if (typeof card.ease !== 'number' || !Number.isFinite(card.ease)) card.ease = 2.5;
            card.ivl = Math.max(0, Number(card.ivl || 0));
            card.success = Math.max(0, Number(card.success || 0));
            card.errors = Math.max(0, Number(card.errors || 0));
            return card;
        }

        function reviewSrsCard(wordId, rating, now = Date.now()) {
            const card = ensureSrsCard(wordId);
            card.last = now;

            if (rating === SRS_RATING.Again) {
                card.errors += 1;
                card.success = 0;
                card.ease = Math.max(1.3, card.ease - 0.2);
                card.ivl = 0;
            } else if (rating === SRS_RATING.Hard) {
                card.errors += 1;
                card.ease = Math.max(1.3, card.ease - 0.15);
                card.ivl = Math.max(1, Math.round((card.ivl || 1) * 0.8));
            } else if (rating === SRS_RATING.Easy) {
                card.success += 1;
                card.ease = Math.min(3.2, card.ease + 0.1);
                if (card.ivl === 0) card.ivl = 2;
                else if (card.ivl === 1) card.ivl = 4;
                else card.ivl = Math.round(card.ivl * card.ease * 1.15);
            } else {
                card.success += 1;
                if (card.ivl === 0) card.ivl = 1;
                else if (card.ivl === 1) card.ivl = 3;
                else card.ivl = Math.round(card.ivl * card.ease);
            }

            card.ivl = Math.max(0, Math.min(card.ivl, 365));
            card.next = now + (card.ivl * 86400000);
            return card;
        }

        function getLearningSnapshot() {
            const now = Date.now();
            const words = WORDS || [];
            const due = words.filter(w => PROGRESS.srs[w.id] && PROGRESS.srs[w.id].next <= now && PROGRESS.srs[w.id].ivl > 0);
            const fresh = words.filter(w => !PROGRESS.srs[w.id] || PROGRESS.srs[w.id].ivl === 0);
            const weak = words.filter(w => {
                const card = PROGRESS.srs[w.id];
                return card && (card.errors > card.success || card.ease <= 1.8);
            });
            return { due, fresh, weak, total: words.length };
        }

        function updateTodayUI() {}

        function toggleFavorite(wordId, event) {
            if (event) event.stopPropagation();
            const idx = PROGRESS.favorites.indexOf(wordId);
            if (idx === -1) {
                PROGRESS.favorites.push(wordId);
            } else {
                PROGRESS.favorites.splice(idx, 1);
            }
            saveProgress();

            // Обновляем только счетчики и активные состояния без пересоздания списка
            refreshCategoryCounters();
            syncSelectedCategoryUI();

            renderWords();
            const modal = document.getElementById('word-modal');
            if (!modal.classList.contains('hidden')) {
                // If modal is open, we might need to refresh its favorite icon
                const favBtn = document.getElementById('modal-fav-btn');
                if (favBtn) {
                    const isFav = PROGRESS.favorites.includes(wordId);
                    favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-star ${isFav ? 'text-amber-400' : 'text-slate-300'}"></i>`;
                }
            }
        }

        // PWA Install
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
        });

        function installApp() {
            if (!deferredPrompt) {
                showInstallInstructions();
                return;
            }
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choice) => {
                if (choice.outcome === 'accepted') {
                    log('[PWA] Installed');
                }
                deferredPrompt = null;
            });
        }

        function showInstallInstructions() {
            const modal = document.getElementById('word-modal');
            const content = document.getElementById('modal-content');
            content.innerHTML = '';

            const wrap = document.createElement('div');
            wrap.className = 'px-6 pt-6 pb-8 text-center';

            const iconWrap = document.createElement('div');
            iconWrap.className = 'mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4';
            iconWrap.innerHTML = '<i class="fa-solid fa-mobile-alt text-emerald-600 text-3xl"></i>';

            const h3 = document.createElement('h3');
            h3.className = 'font-bold text-xl mb-2';
            h3.textContent = 'Установка';

            const p = document.createElement('p');
            p.className = 'text-sm text-slate-600 mb-6';
            p.textContent = 'Чтобы установить приложение на телефон:';

            const steps = document.createElement('div');
            steps.className = 'text-left bg-slate-50 rounded-2xl p-4 text-sm space-y-3';

            const createStep = (num, text) => {
                const div = document.createElement('div');
                div.className = 'flex gap-3';
                const n = document.createElement('div');
                n.className = 'font-mono text-emerald-600 w-5';
                n.textContent = num;
                const t = document.createElement('div');
                t.textContent = text;
                div.append(n, t);
                return div;
            };

            steps.append(
                createStep('1', 'Нажмите «Поделиться» внизу браузера'),
                createStep('2', 'Выберите «На экран «Домой»»'),
                createStep('3', 'Подтвердите установку')
            );

            wrap.append(iconWrap, h3, p, steps);

            const footer = document.createElement('div');
            footer.className = 'border-t p-4';
            const okBtn = document.createElement('button');
            okBtn.className = 'w-full py-3 bg-slate-100 active:bg-slate-200 font-semibold rounded-3xl text-sm';
            okBtn.textContent = 'Понятно';
            okBtn.addEventListener('click', closeModal);
            footer.appendChild(okBtn);

            content.append(wrap, footer);
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }


        function checkForUpdates() {
            const icon = document.getElementById('update-check-icon');
            const status = document.getElementById('update-status');
            if (!icon || !status) return;

            // Start spinning
            icon.classList.add('fa-spin');
            status.textContent = 'Проверка...';

            if (!navigator.onLine) {
                setTimeout(() => {
                    status.textContent = 'Оффлайн';
                    icon.classList.remove('fa-spin');
                }, 800);
                return;
            }

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistration().then(registration => {
                    if (registration) {
                        registration.update().then(() => {
                            log('[PWA] Manual update check completed');
                            setTimeout(() => {
                                if (registration.installing) {
                                    status.textContent = 'Загрузка...';
                                } else if (registration.waiting) {
                                    status.textContent = 'Есть обновление!';
                                    icon.classList.remove('fa-spin');
                                } else {
                                    status.textContent = 'Обновлено';
                                    icon.classList.remove('fa-spin');
                                }
                            }, 1000);
                        }).catch(err => {
                            warn('[PWA] SW update check failed', err);
                            status.textContent = 'Ошибка';
                            icon.classList.remove('fa-spin');
                        });
                    } else {
                        status.textContent = 'Ошибка PWA';
                        icon.classList.remove('fa-spin');
                    }
                }).catch(() => {
                    status.textContent = 'Ошибка';
                    icon.classList.remove('fa-spin');
                });
            } else {
                status.textContent = 'Не подд.';
                icon.classList.remove('fa-spin');
            }
        }

        function showUpdateReady() {
            const status = document.getElementById('update-status');
            if (status) status.textContent = 'Готово';
        }

        function registerSW() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    showUpdateReady();
                });

                navigator.serviceWorker.register('sw.js')
                    .then(async (registration) => {
                        log('[PWA] Service Worker registered');
                        if (registration.waiting) showUpdateReady();

                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            if (newWorker) {
                                newWorker.addEventListener('statechange', () => {
                                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) showUpdateReady();
                                });
                            }
                        });

                        if (supportsNotifications() && Notification.permission === 'granted' && localStorage.getItem('lezgi_notif_enabled') === '1') {
                            await registerPeriodicReminder();
                        }
                    })
                    .catch(err => warn('[PWA] SW registration failed', err));
            }

            const offlineBanner = document.getElementById('offline-banner');
            window.addEventListener('online', () => offlineBanner?.classList.add('hidden'));
            window.addEventListener('offline', () => offlineBanner?.classList.remove('hidden'));
            if (!navigator.onLine) offlineBanner?.classList.remove('hidden');
        }

        function normalizeLezgiSearch(value) {
            return String(value || '')
                .toLowerCase()
                .normalize('NFC')
                .replace(/ё/g, 'е')
                .replace(/[ӏӀI!ʼ’'`|]/g, '1')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function rebuildSearchIndex() {
            SEARCH_INDEX = (WORDS || []).map(word => ({
                id: word.id,
                text: normalizeLezgiSearch([word.lz, word.ru, word.cat, word.ex, ...(word.tags || [])].join(' '))
            }));
        }

        function getSearchResults(words, query) {
            const normalized = normalizeLezgiSearch(query);
            if (!normalized) return { results: words, hint: '' };

            if (!SEARCH_INDEX.length || SEARCH_INDEX.length !== WORDS.length) rebuildSearchIndex();
            const allowed = new Set(words.map(w => w.id));
            const matchedIds = new Set(SEARCH_INDEX
                .filter(item => allowed.has(item.id) && item.text.includes(normalized))
                .map(item => item.id));
            const primaryResults = words.filter(w => matchedIds.has(w.id));
            if (primaryResults.length > 0) return { results: primaryResults, hint: '' };

            const fallbackQuery = normalized
                .replace(/к[Ӏӏ1]/g, 'к1')
                .replace(/п[Ӏӏ1]/g, 'п1')
                .replace(/т[Ӏӏ1]/g, 'т1')
                .replace(/ц[Ӏӏ1]/g, 'ц1')
                .replace(/ч[Ӏӏ1]/g, 'ч1');
            if (fallbackQuery !== normalized) {
                const fallbackIds = new Set(SEARCH_INDEX
                    .filter(item => allowed.has(item.id) && item.text.includes(fallbackQuery))
                    .map(item => item.id));
                const fallbackResults = words.filter(w => fallbackIds.has(w.id));
                if (fallbackResults.length > 0) {
                    return { results: fallbackResults, hint: 'Показаны результаты с нормализацией кӀ/к1/кI и похожих символов' };
                }
            }

            return { results: [], hint: '' };
        }

        function initSearchBehavior() {
            const searchInput = document.getElementById('search-input');
            const searchClear = document.getElementById('search-clear');
            if (!searchInput) return;

            let debounceTimer = null;
            searchInput.addEventListener('input', () => {
                if (searchClear) {
                    searchClear.classList.toggle('hidden', searchInput.value.length === 0);
                }

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    currentFilter.search = searchInput.value;
                    renderWords();
                }, 250);
            });
        }

        // Embedded dictionary (full offline support)


        function showFatalLoadError(message) {
            const loadingEl = document.getElementById('words-loading');
            const grid = document.getElementById('words-grid');
            const box = document.createElement('div');
            box.className = 'col-span-full p-5 rounded-3xl bg-red-50 border border-red-100 text-red-700 text-sm leading-relaxed';
            box.textContent = message;
            if (loadingEl) {
                loadingEl.innerHTML = '';
                loadingEl.appendChild(box.cloneNode(true));
                loadingEl.classList.remove('hidden');
                loadingEl.style.display = 'block';
            }
            if (grid) {
                grid.innerHTML = '';
                grid.appendChild(box);
            }
        }

        async function loadJsonAsset(url, label) {
            const res = await fetch(url, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
            return res.json();
        }

        async function loadWords() {
            const loadingEl = document.getElementById('words-loading');
            try {
                WORDS = await loadJsonAsset('words.json', 'Словарь');
                rebuildSearchIndex();
                if (loadingEl) loadingEl.style.display = 'none';
            } catch (e) {
                warn('[LezgiMez] Could not load words.json', e);
                showFatalLoadError('Не удалось загрузить словарь. Проверьте подключение или очистите кэш приложения.');
                return false;
            }

            buildCategoryOptions();
            refreshCategoryCounters();
            syncSelectedCategoryUI();
            updatePracticeAvailability();
            updateVocabStats();
            renderAlphabet();
            renderWords();
            initSearchBehavior();
            updateStatsUI();
            return true;
        }

        function buildCategoryOptions() {
            let cats = [...new Set(WORDS.map(w => w.cat))];
            cats.sort((a, b) => (NICE_CATEGORY_NAMES[a] || a).localeCompare(NICE_CATEGORY_NAMES[b] || b, 'ru'));
            cats.unshift('all');

            const vocabPanel = document.getElementById('category-filter-panel').querySelector('.scroll-area') || document.getElementById('category-filter-panel');
            const pracPanel = document.getElementById('practice-category-panel').querySelector('.scroll-area') || document.getElementById('practice-category-panel');

            vocabPanel.innerHTML = '';
            pracPanel.innerHTML = '';

            const createOption = (val, display, type) => {
                const div = document.createElement('div');
                div.className = `dropdown-option flex justify-between items-center cursor-pointer text-sm p-3 hover:bg-slate-50`;
                if (val === 'favorites') div.className += ' border-b border-emerald-100 pb-2 mb-1.5';
                div.dataset.value = val;

                const name = document.createElement('span');
                name.className = val === 'favorites' ? 'opt-name flex items-center gap-2' : 'opt-name';
                if (val === 'favorites') {
                    const icon = document.createElement('i');
                    icon.className = 'fa-solid fa-star text-amber-400 text-sm';
                    const label = document.createElement('span');
                    label.textContent = display;
                    name.append(icon, label);
                } else {
                    name.textContent = display;
                }

                const count = document.createElement('span');
                count.className = 'count text-slate-400 text-sm';
                div.append(name, count);

                div.addEventListener('click', () => {
                    if (type === 'vocab') setVocabularyCategory(val, display);
                    else setPracticeCategory(val, display);
                });
                return div;
            };

            // Vocab options
            vocabPanel.appendChild(createOption('favorites', 'Избранное', 'vocab'));
            cats.forEach(cat => {
                const name = cat === 'all' ? 'Все' : (NICE_CATEGORY_NAMES[cat] || cat);
                vocabPanel.appendChild(createOption(cat, name, 'vocab'));
            });
            if (vocabPanel.firstElementChild) {
                vocabPanel.firstElementChild.style.borderTopLeftRadius = '1.5rem';
                vocabPanel.firstElementChild.style.borderTopRightRadius = '1.5rem';
            }
            if (vocabPanel.lastElementChild) {
                vocabPanel.lastElementChild.style.borderBottomLeftRadius = '1.5rem';
                vocabPanel.lastElementChild.style.borderBottomRightRadius = '1.5rem';
            }

            // Practice options
            cats.forEach(cat => {
                const name = cat === 'all' ? 'Все слова' : (NICE_CATEGORY_NAMES[cat] || cat);
                pracPanel.appendChild(createOption(cat, name, 'practice'));
            });
            if (pracPanel.firstElementChild) {
                pracPanel.firstElementChild.style.borderTopLeftRadius = '1.5rem';
                pracPanel.firstElementChild.style.borderTopRightRadius = '1.5rem';
            }
            if (pracPanel.lastElementChild) {
                pracPanel.lastElementChild.style.borderBottomLeftRadius = '1.5rem';
                pracPanel.lastElementChild.style.borderBottomRightRadius = '1.5rem';
            }
        }

        function refreshCategoryCounters() {
            const updatePanel = (panelId, getCount) => {
                const panel = document.getElementById(panelId);
                panel.querySelectorAll('.dropdown-option').forEach(opt => {
                    const val = opt.dataset.value;
                    const count = getCount(val);
                    opt.querySelector('.count').textContent = `(${count})`;
                });
            };

            updatePanel('category-filter-panel', (val) => {
                if (val === 'favorites') return PROGRESS.favorites.length;
                if (val === 'all') return WORDS.length;
                return WORDS.filter(w => w.cat === val).length;
            });

            updatePanel('practice-category-panel', (val) => {
                if (val === 'all') return WORDS.length;
                return WORDS.filter(w => w.cat === val).length;
            });
        }

        function syncSelectedCategoryUI() {
            const sync = (panelId, currentVal) => {
                const panel = document.getElementById(panelId);
                panel.querySelectorAll('.dropdown-option').forEach(opt => {
                    opt.classList.toggle('active', opt.dataset.value === currentVal);
                });
            };
            sync('category-filter-panel', currentFilter.category);
            sync('practice-category-panel', practiceCategory);
        }

        function setVocabularyCategory(val, display) {
            currentFilter.category = val;
            document.querySelector('#category-filter-wrapper .dropdown-value').textContent = display;
            closeDropdown('category-filter-wrapper');
            syncSelectedCategoryUI();
            renderWords();
        }

        function setPracticeCategory(val, display) {
            practiceCategory = val;
            const fullDisplay = val === 'all' ? `${display} (${WORDS.length})` : `${display} (${WORDS.filter(w => w.cat === val).length})`;
            document.querySelector('#practice-category-wrapper .dropdown-value').textContent = fullDisplay;
            closeDropdown('practice-category-wrapper');
            syncSelectedCategoryUI();
            updatePracticeAvailability();
        }

        function updatePracticeAvailability() {
            const cat = practiceCategory;
            const pool = cat === 'all' ? WORDS : WORDS.filter(w => w.cat === cat);
            const count = pool.length;

            const modes = [
                { id: 'prac-mode-flashcards', min: 3 },
                { id: 'prac-mode-pairs', min: 5 },
                { id: 'prac-mode-quiz', min: 8 },
                { id: 'prac-mode-odd', min: 8 },
                { id: 'prac-mode-srs', min: 3 }
            ];

            modes.forEach(mode => {
                const el = document.getElementById(mode.id);
                if (!el) return;

                const isAvailable = count >= mode.min;
                el.classList.toggle('opacity-40', !isAvailable);
                el.classList.toggle('pointer-events-none', !isAvailable);

                const infoText = el.querySelector('.text-sm');
                if (isAvailable) {
                    infoText.textContent = `Доступно слов: ${count}`;
                    infoText.classList.remove('text-red-500');
                } else {
                    infoText.dataset.orig = infoText.textContent;
                    infoText.textContent = `Нужно еще ${mode.min - count} слов (минимум ${mode.min})`;
                    infoText.classList.add('text-red-500');
                }
            });
        }

        function updateVocabStats() {
            const statsEl = document.getElementById('vocab-stats');
            const countEl = document.getElementById('words-count');
            if (typeof WORDS === 'undefined' || !WORDS || !WORDS.length) return;
            const catCount = [...new Set(WORDS.map(w => w.cat))].length;
            if (statsEl) statsEl.textContent = `${WORDS.length} слов • ${catCount} категорий`;
            if (countEl) countEl.textContent = WORDS.length.toLocaleString('ru-RU');
        }

        function toggleDropdown(wrapperId) {
            const wrapper = document.getElementById(wrapperId);
            const panel = wrapper.querySelector('.dropdown-panel');
            const trigger = wrapper.querySelector('.dropdown-trigger');
            const chevron = wrapper.querySelector('.fa-chevron-down');

            // Close all other dropdowns
            document.querySelectorAll('.dropdown-panel').forEach(p => {
                if (p !== panel) p.classList.add('hidden');
            });
            document.querySelectorAll('.fa-chevron-down').forEach(c => {
                if (c !== chevron) c.style.transform = '';
            });

            const isOpen = !panel.classList.contains('hidden');

            if (!isOpen) {
                // Opening
                panel.classList.remove('hidden');
                chevron.style.transform = 'rotate(180deg)';
            } else {
                // Closing
                panel.classList.add('hidden');
                chevron.style.transform = '';
            }
        }

        function closeDropdown(wrapperId) {
            const wrapper = document.getElementById(wrapperId);
            if (!wrapper) return;

            const panel = wrapper.querySelector('.dropdown-panel');
            const trigger = wrapper.querySelector('.dropdown-trigger');
            const chevron = wrapper.querySelector('.fa-chevron-down');

            if (panel) panel.classList.add('hidden');
            if (chevron) chevron.style.transform = '';
        }

        // Alphabet
        const ALPHABET_RAW = [
            { "letter": "А а", "ipa": "/a/" }, { "letter": "Б б", "ipa": "/b/" }, { "letter": "В в", "ipa": "/v/ ~ /w/" },
            { "letter": "Г г", "ipa": "/ɡ/" }, { "letter": "Гъ гъ", "ipa": "/ʁ/" },
            { "letter": "Гь гь", "ipa": "/h/" }, { "letter": "Д д", "ipa": "/d/" },
            { "letter": "Е е", "ipa": "/e/ ~ /je/" }, { "letter": "Ж ж", "ipa": "/ʒ/" }, { "letter": "З з", "ipa": "/z/" },
            { "letter": "И и", "ipa": "/i/" }, { "letter": "Й й", "ipa": "/j/" }, { "letter": "К к", "ipa": "/kʰ/ ~ /k/" },
            { "letter": "Къ къ", "ipa": "/q/" }, { "letter": "Кь кь", "ipa": "/q'/" }, { "letter": "КI кI", "ipa": "/k'/" },
            { "letter": "Л л", "ipa": "/l/" }, { "letter": "М м", "ipa": "/m/" },
            { "letter": "Н н", "ipa": "/n/" }, { "letter": "П п", "ipa": "/pʰ/ ~ /p/" }, { "letter": "ПI пI", "ipa": "/p'/" },
            { "letter": "Р р", "ipa": "/r/" }, { "letter": "С с", "ipa": "/s/" },
            { "letter": "Т т", "ipa": "/tʰ/ ~ /t/" }, { "letter": "ТI тI", "ipa": "/t'/" },
            { "letter": "У у", "ipa": "/u/" }, { "letter": "Уь уь", "ipa": "/y/" },
            { "letter": "Ф ф", "ipa": "/f/" }, { "letter": "Х х", "ipa": "/χ/" },
            { "letter": "Хъ хъ", "ipa": "/qʰ/" }, { "letter": "Хь хь", "ipa": "/x/" },
            { "letter": "Ц ц", "ipa": "/tsʰ/ ~ /ts/" }, { "letter": "ЦI цI", "ipa": "/ts'/" },
            { "letter": "Ч ч", "ipa": "/tʃʰ/ ~ /tʃ/" }, { "letter": "ЧI чI", "ipa": "/tʃ'/" },
            { "letter": "Ш ш", "ipa": "/ʃ/" }, { "letter": "Ъ ъ", "ipa": "/ʔ/" }, { "letter": "Ы ы", "ipa": "/ə/" },
            { "letter": "Э э", "ipa": "/e/" }, { "letter": "Ю ю", "ipa": "/ju/ ~ /y/" }, { "letter": "Я я", "ipa": "/ja/ ~ /æ/" }
        ];

        const ALPHABET = [];
        const seenLetters = new Set();

        ALPHABET_RAW.forEach(item => {
            if (!seenLetters.has(item.letter)) {
                ALPHABET.push(item);
                seenLetters.add(item.letter);
            }
        });

        function renderAlphabet() {
            const grid = document.getElementById('alphabet-grid');
            grid.innerHTML = '';

            ALPHABET.forEach((item, idx) => {
                const main = item.letter.split(' ')[0];

                const card = document.createElement('div');
                // Плитки теперь чисто белые, а фон экрана — светло-голубой
                card.className = `letter-card bg-white border border-slate-100 active:border-emerald-500 rounded-2xl h-24 flex items-center justify-center text-center cursor-pointer transition-all shadow-sm`;
                card.setAttribute('role', 'button');

                const mainEl = document.createElement('div');
                mainEl.className = 'font-bold text-emerald-900 leading-none';
                mainEl.style.fontSize = '2.75rem';
                mainEl.textContent = main;

                card.append(mainEl);
                card.addEventListener('click', () => {
                    card.style.transform = 'scale(0.95)';
                    setTimeout(() => card.style.transform = '', 120);
                    showAlphabetModal(item);
                });
                grid.appendChild(card);
            });

            staggerCards(grid);
        }

        function showAlphabetModal(item) {
            const modal = document.getElementById('word-modal');
            const content = document.getElementById('modal-content');
            content.innerHTML = '';

            const main = item.letter.split(' ')[0];
            const soundFile = main.toLowerCase().replace(/i/g, '1');

            // Все графемы алфавита (первая часть, например "К", "Къ", "Кь", "КI")
            const allGraphemes = ALPHABET.map(l => l.letter.split(' ')[0]);
            // Графемы, которые начинаются так же, но длиннее (например для "К" → "Къ", "Кь", "КI")
            const longerGraphemes = allGraphemes.filter(g =>
                g.toLowerCase().startsWith(main.toLowerCase()) && g.length > main.length
            );

            // Примеры: слова, начинающиеся ровно на эту графему, а не на составные
            const examples = WORDS.filter(w => {
                const lz = w.lz.toLowerCase();
                if (!lz.startsWith(main.toLowerCase())) return false;
                // Исключаем слова, начинающиеся с составной графемы (Къ, Кь, КI и т.д.)
                return !longerGraphemes.some(gg => lz.startsWith(gg.toLowerCase()));
            }).slice(0, 5);

            const body = document.createElement('div');
            body.className = 'px-6 pt-7 pb-5 flex flex-col flex-1 min-h-0 overflow-y-auto';

            const header = document.createElement('div');
            header.className = 'flex justify-between items-start';

            const left = document.createElement('div');
            const catSpan = document.createElement('div');
            catSpan.className = 'uppercase tracking-[1.5px] text-emerald-600 text-sm font-bold';
            catSpan.textContent = 'АЛФАВИТ';

            const h1 = document.createElement('div');
            h1.className = 'text-[56px] leading-none font-bold text-emerald-900 mt-2 lezgin-text';
            h1.textContent = item.letter;
            left.append(catSpan, h1);

            const right = document.createElement('div');
            const close = document.createElement('button');
            close.className = 'text-slate-300 active:text-slate-400 pt-2';
            close.innerHTML = '<i class="fa-solid fa-times text-3xl"></i>';
            close.addEventListener('click', closeModal);
            right.append(close);

            header.append(left, right);

            const info = document.createElement('div');
            info.className = 'mt-6 flex items-center justify-between bg-emerald-50/50 border border-emerald-100 rounded-3xl p-5';

            const ipaWrap = document.createElement('div');
            const ipaLabel = document.createElement('div');
            ipaLabel.className = 'text-[10.5px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1';
            ipaLabel.textContent = 'Межзвуки МФА';
            const ipaText = document.createElement('div');
            ipaText.className = 'text-2xl font-mono text-emerald-800 font-medium';
            ipaText.textContent = item.ipa;
            ipaWrap.append(ipaLabel, ipaText);

            const playBtn = document.createElement('button');
            playBtn.className = 'w-14 h-14 flex flex-shrink-0 items-center justify-center bg-emerald-500 text-white active:bg-emerald-600 rounded-full text-2xl transition-transform active:scale-95 shadow-sm';
            playBtn.innerHTML = '<i class="fa-solid fa-volume-up relative -left-0.5"></i>';
            playBtn.addEventListener('click', () => {
                speakWord(null, `audio/alphabet/${soundFile}.wav`);
            });

            if (item.letter === 'Ъ ъ') {
                info.append(ipaWrap);
                body.append(header, info);

                const descBox = document.createElement('div');
                descBox.className = 'mt-4 bg-slate-50 border border-slate-100 text-slate-700 p-4 rounded-3xl text-sm leading-relaxed shadow-sm';
                descBox.innerHTML = '<b>Ъ ъ</b> обозначает гортанную смычку. Это не самостоятельный звук, который можно просто прослушать. Он образуется резким смыканием голосовых связок (как пауза в слове «не-а»). В лезгинском языке он делает предшествующий звук более отрывистым или используется в заимствованных словах.';
                body.append(descBox);
            } else {
                info.append(ipaWrap, playBtn);
                body.append(header, info);
            }

            const exSection = document.createElement('div');
            exSection.className = 'mt-8 flex-1';
            const exHeader = document.createElement('div');
            exHeader.className = 'text-sm font-bold text-slate-400 uppercase tracking-wider mb-3';
            exHeader.textContent = 'Примеры слов';
            exSection.append(exHeader);

            if (examples.length > 0) {
                const exList = document.createElement('div');
                exList.className = 'flex flex-col gap-2';

                examples.forEach(w => {
                    const exCard = document.createElement('div');
                    exCard.className = 'bg-white border border-slate-100 rounded-2xl p-4 flex justify-between items-center cursor-pointer active:bg-slate-50 transition-colors shadow-sm';
                    exCard.addEventListener('click', () => showWordModal(w.id));

                    const lCol = document.createElement('div');
                    const lz = document.createElement('div');
                    lz.className = 'font-bold text-emerald-950 mb-0.5 text-lg';

                    const prefixLen = main.length;
                    const prefixStr = w.lz.substring(0, prefixLen);
                    const restStr = w.lz.substring(prefixLen);
                    lz.textContent = '';
                    const highlighted = document.createElement('span');
                    highlighted.className = 'text-emerald-600';
                    highlighted.textContent = prefixStr;
                    lz.append(highlighted, document.createTextNode(restStr));

                    const ru = document.createElement('div');
                    ru.className = 'text-sm text-slate-500';
                    ru.textContent = w.ru;
                    lCol.append(lz, ru);

                    const icon = document.createElement('i');
                    icon.className = 'fa-solid fa-chevron-right text-slate-300 text-sm';

                    exCard.append(lCol, icon);
                    exList.append(exCard);
                });
                exSection.append(exList);
            } else {
                const noEx = document.createElement('div');
                noEx.className = 'text-sm text-slate-400 italic text-center py-8 bg-slate-50 rounded-3xl border border-slate-100 border-dashed';
                noEx.textContent = 'На эту букву пока нет примеров в словаре';
                exSection.append(noEx);
            }
            body.append(exSection);

            content.append(body);
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        // Vocabulary
        const SHOW_VOCABULARY_IPA = false;
        function renderWords(skipAnimation, append) {
            const grid = document.getElementById('words-grid');
            const countEl = document.getElementById('results-count');
            const badge = document.getElementById('demo-badge');
            const hintEl = document.getElementById('search-hint');

            const isDemo = WORDS.length < 50;
            const hasSearch = currentFilter.search.trim().length > 0;
            let scopedWords = WORDS;

            if (badge) badge.classList.toggle('hidden', !isDemo);
            if (currentFilter.category === 'favorites') {
                scopedWords = scopedWords.filter(w => PROGRESS.favorites.includes(w.id));
            } else if (currentFilter.category !== 'all') {
                scopedWords = scopedWords.filter(w => w.cat === currentFilter.category);
            }

            const searchState = getSearchResults(scopedWords, currentFilter.search);
            const filtered = searchState.results;

            if (hintEl) {
                if (searchState.hint) {
                    hintEl.textContent = searchState.hint;
                    hintEl.classList.remove('hidden');
                } else {
                    hintEl.textContent = '';
                    hintEl.classList.add('hidden');
                }
            }

            if (countEl) countEl.textContent = filtered.length;

            if (!append) {
                loadedCount = PAGE_SIZE;
                grid.innerHTML = '';
            }
            const start = append ? loadedCount : 0;
            const pageWords = filtered.slice(start, start + PAGE_SIZE);
            if (append) {
                loadedCount += PAGE_SIZE;
            }
            log(`[renderWords] Current loadedCount: ${loadedCount}, Total filtered words: ${filtered.length}`);
            // loadedCount теперь всегда отражает количество загруженных элементов (20, 40, 60...)

            // Context Banner
            let contextBanner = document.getElementById('vocab-context');
            if (!contextBanner) {
                contextBanner = document.createElement('div');
                contextBanner.id = 'vocab-context';
                contextBanner.className = 'text-sm text-slate-600 bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 mb-4';
                grid.parentNode.insertBefore(contextBanner, grid);
            }

            contextBanner.textContent = '';
            if (currentFilter.category === 'favorites') {
                const b = document.createElement('strong');
                b.textContent = 'Ваш личный список.';
                contextBanner.append(b, ' Повторяйте эти слова регулярно. Прогресс сохраняется на устройстве.');
                contextBanner.style.display = 'block';
            } else if (currentFilter.category === 'all' && !hasSearch) {
                const b = document.createElement('strong');
                b.textContent = 'Весь словарь.';
                contextBanner.append(b, ' Листайте список, используйте поиск или фильтр по темам.');
                contextBanner.style.display = 'block';
            } else if (currentFilter.category !== 'all' && !hasSearch) {
                const wrapper = document.getElementById('category-filter-wrapper');
                const catName = wrapper.querySelector('.dropdown-value').textContent;
                contextBanner.append('Слова по теме ');
                const b = document.createElement('strong');
                b.textContent = `«${catName}»`;
                contextBanner.append(b, '. Учите слова в контексте одной темы для лучшего запоминания.');
                contextBanner.style.display = 'block';
            } else {
                contextBanner.style.display = 'none';
            }

            if (pageWords.length === 0) {
                if (currentFilter.category === 'favorites') {
                    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-100 rounded-3xl mt-2 shadow-sm">
                        <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fa-regular fa-star text-3xl text-slate-300"></i>
                        </div>
                        <h3 class="font-semibold text-slate-700 text-lg">Нет избранных слов</h3>
                        <p class="text-sm mt-1 px-6">Нажимайте на звездочку рядом со словом, чтобы добавить его сюда для повторения.</p>
                    </div>`;
                } else if (hasSearch) {
                    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-100 rounded-3xl mt-2 shadow-sm">
                        <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fa-solid fa-search text-3xl text-slate-300"></i>
                        </div>
                        <h3 class="font-semibold text-slate-700 text-lg">Ничего не найдено</h3>
                        <p class="text-sm mt-1 px-6">Попробуйте изменить запрос или поискать в другой категории.</p>
                    </div>`;
                } else {
                    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-100 rounded-3xl mt-2 shadow-sm">
                        <h3 class="font-semibold text-slate-700 text-lg">Пусто</h3>
                        <p class="text-sm mt-1 px-6">В этой категории пока нет слов.</p>
                    </div>`;
                }
                document.getElementById('pagination').innerHTML = '';
                return;
            }

            pageWords.forEach(word => {
                const isFav = PROGRESS.favorites.includes(word.id);
                const card = document.createElement('div');
                card.className = 'word-card bg-white border border-slate-100 active:border-emerald-200 rounded-3xl p-4 flex items-start gap-4 cursor-pointer relative';

                const content = document.createElement('div');
                content.className = 'flex-1 min-w-0';
                const lzWrap = document.createElement('div');
                lzWrap.className = 'lezgin-text text-emerald-950 font-bold mb-1';
                lzWrap.textContent = word.lz;

                const metaWrap = document.createElement('div');
                metaWrap.className = 'flex items-center gap-2 mt-1.5 flex-wrap';

                const cat = document.createElement('div');
                cat.className = 'text-[10px] text-slate-400 font-bold uppercase tracking-wider';
                cat.textContent = word.cat;

                metaWrap.append(cat);
                content.append(lzWrap, metaWrap);

                const right = document.createElement('div');
                right.className = 'text-right flex-shrink-0 flex flex-col items-end gap-2 max-w-[45%]';
                const ru = document.createElement('div');
                ru.className = 'text-sm px-3 py-1 bg-emerald-50 text-emerald-700 rounded-2xl font-medium block whitespace-normal text-right';
                ru.textContent = word.ru;

                const bottom = document.createElement('div');
                bottom.className = 'flex items-center gap-2';
                const fav = document.createElement('button');
                fav.className = 'p-1 -mr-1';
                fav.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFavorite(word.id);
                });
                const favIcon = document.createElement('i');
                favIcon.className = `fa-${isFav ? 'solid' : 'regular'} fa-star ${isFav ? 'text-amber-400' : 'text-slate-200'}`;
                fav.appendChild(favIcon);
                if (SHOW_VOCABULARY_IPA) {
                    const ipa = document.createElement('span');
                    ipa.className = 'ipa-text text-sm';
                    ipa.textContent = word.ipa || '—';
                    bottom.appendChild(ipa);
                }
                bottom.appendChild(fav);

                right.append(ru, bottom);
                card.append(content, right);
                card.addEventListener('click', () => showWordModal(word.id));
                grid.appendChild(card);
            });

            renderLoadMore(filtered.length);
            if (!skipAnimation && !append) staggerCards(grid);
        }
        function renderLoadMore(total) {
            const container = document.getElementById('pagination');
            container.innerHTML = '';
            log(`[renderLoadMore] Checking if button needed. Loaded: ${loadedCount}, Total: ${total}`);
            if (loadedCount >= total) {
                const done = document.createElement('div');
                done.className = 'text-sm text-slate-400 font-medium py-3 text-center';
                done.textContent = `Все слова загружены (${total})`;
                container.appendChild(done);
                return;
            }
            const nextBatch = Math.min(loadedCount + PAGE_SIZE, total);
            const btn = document.createElement('button');
            btn.className = 'px-6 py-3 text-sm font-semibold rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 active:bg-emerald-100 w-full';
            btn.textContent = `Загрузить ещё (${loadedCount + 1}–${nextBatch} из ${total})`;
            btn.onclick = () => renderWords(false, true);
            container.appendChild(btn);
        }

        function showWordModal(wordId) {
            const word = WORDS.find(w => w.id === wordId);
            if (!word) return;

            const modal = document.getElementById('word-modal');
            const content = document.getElementById('modal-content');

            content.innerHTML = '';
            const isFav = PROGRESS.favorites.includes(word.id);

            const body = document.createElement('div');
            body.className = 'px-6 pt-7 pb-5';

            const header = document.createElement('div');
            header.className = 'flex justify-between items-start';

            const left = document.createElement('div');
            const catRow = document.createElement('div');
            catRow.className = 'flex items-center gap-2';
            const catSpan = document.createElement('div');
            catSpan.className = 'uppercase tracking-[1.5px] text-emerald-600 text-sm font-bold';
            catSpan.textContent = word.cat;
            catRow.append(catSpan);
            const h1 = document.createElement('div');
            h1.className = 'text-[42px] leading-none font-bold text-emerald-900 mt-1 lezgin-text';
            h1.textContent = word.lz;
            left.append(catRow, h1);

            const right = document.createElement('div');
            right.className = 'flex items-center gap-3';
            const fav = document.createElement('button');
            fav.className = 'text-2xl transition-transform active:scale-125';
            fav.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-star ${isFav ? 'text-amber-400' : 'text-slate-300'}"></i>`;
            fav.addEventListener('click', () => { toggleFavorite(word.id); showWordModal(word.id); });
            const close = document.createElement('button');
            close.className = 'text-slate-300 active:text-slate-400';
            close.innerHTML = '<i class="fa-solid fa-times text-3xl"></i>';
            close.addEventListener('click', closeModal);
            right.append(fav, close);
            header.append(left, right);

            const info = document.createElement('div');
            info.className = 'mt-4';
            const ru = document.createElement('div');
            ru.className = 'text-3xl font-semibold';
            ru.textContent = word.ru;
            info.appendChild(ru);
            if (SHOW_VOCABULARY_IPA && word.ipa) {
                const ipa = document.createElement('div');
                ipa.className = 'mt-1 ipa-text';
                ipa.textContent = word.ipa;
                info.appendChild(ipa);
            }

            body.append(header, info);
            if (word.ex) {
                const ex = document.createElement('div');
                ex.className = 'mt-6 bg-emerald-50/40 border-l-4 border-emerald-400 rounded-r-2xl p-4 font-medium text-slate-800 text-base leading-relaxed';
                ex.textContent = word.ex;
                body.appendChild(ex);
            }

            const footer = document.createElement('div');
            footer.className = 'px-6 pb-6 flex gap-3';
            const add = document.createElement('button');
            add.className = 'flex-1 py-3.5 bg-emerald-50 active:bg-emerald-100/80 text-emerald-800 font-bold rounded-3xl flex items-center justify-center gap-x-2 text-sm border border-emerald-100/50 transition-colors shadow-sm';
            add.innerHTML = '<i class="fa-solid fa-plus text-emerald-600"></i><span>В практику</span>';
            add.addEventListener('click', () => { addToPractice(word.id); closeModal(); });

            const reportBtn = document.createElement('button');
            reportBtn.className = 'py-3.5 px-5 bg-rose-50 active:bg-rose-100 text-rose-600 font-bold rounded-3xl flex items-center justify-center gap-x-2 text-sm border border-rose-100/50 transition-colors shadow-sm';
            reportBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            reportBtn.title = 'Сообщить об ошибке';
            reportBtn.setAttribute('aria-label', 'Сообщить об ошибке в слове');
            reportBtn.addEventListener('click', () => {
                showReportForm(word);
            });

            footer.append(add, reportBtn);

            content.append(body, footer);
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function showReportForm(word) {
            const modal = document.getElementById('word-modal');
            const content = document.getElementById('modal-content');
            content.innerHTML = '';

            const wrap = document.createElement('div');
            wrap.className = 'px-6 pt-6 pb-6 text-center flex-1 flex flex-col min-h-0';

            const iconWrap = document.createElement('div');
            iconWrap.className = 'mx-auto w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4 flex-shrink-0';
            iconWrap.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-emerald-600 text-2xl"></i>';

            const h3 = document.createElement('h3');
            h3.className = 'font-bold text-xl mb-1 text-slate-800';
            h3.textContent = 'Сообщить об ошибке';

            const p = document.createElement('p');
            p.className = 'text-sm text-slate-500 mb-3';
            p.textContent = `В слове «${word.lz}» (${word.ru})`;

            const privacyNote = document.createElement('p');
            privacyNote.className = 'text-[11px] leading-relaxed text-slate-400 bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-3 text-left';
            privacyNote.textContent = 'Когда вы отправляете исправление, текст сообщения передаётся администратору проекта для проверки. Не отправляйте личные данные.';

            // Блок с подсказкой — примеры для заполнения
            const hintBox = document.createElement('div');
            hintBox.className = 'text-left mb-3 bg-slate-50 border border-slate-100 rounded-2xl p-3';
            hintBox.innerHTML = `
                <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Пример описания:</p>
                <p class="text-xs text-slate-500 leading-relaxed mb-2">
                    «Перевод неточный — слово <b class="text-slate-700">чӀал</b> означает не просто "язык", а "слово/речь". Правильнее: <b class="text-slate-700">речь, слово</b>»
                </p>
                <p class="text-xs text-slate-400 mb-2">Или выберите быстрый вариант:</p>
                <div class="flex flex-wrap gap-1.5" id="hint-chips"></div>
            `;

            const form = document.createElement('form');
            form.className = 'flex flex-col flex-1 min-h-0';

            const textarea = document.createElement('textarea');
            textarea.className = 'w-full flex-1 p-3 border border-slate-200 rounded-2xl bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all';
            textarea.placeholder = 'Опишите что не так и как должно быть правильно...';
            textarea.required = true;
            textarea.style.minHeight = '90px';

            form.appendChild(textarea);
            wrap.append(iconWrap, h3, p, privacyNote, hintBox, form);

            // Быстрые подсказки-чипы — заполняют поле одним нажатием
            const chips = [
                { label: '❌ Неправильный перевод', text: 'Неправильный перевод. Должно быть: ' },
                { label: '✏️ Опечатка', text: 'Опечатка в написании слова. Правильно: ' },
                { label: '📝 Нет примера', text: 'Нет примера использования. Предлагаю добавить: ' },
                { label: '🔊 Неверное ударение', text: 'Неверное ударение/транскрипция. Правильно: ' },
            ];
            // Ждем, пока элемент добавится в DOM
            setTimeout(() => {
                const chipsContainer = document.getElementById('hint-chips');
                if (!chipsContainer) return;
                chips.forEach(chip => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'text-[11px] px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-xl active:bg-emerald-50 active:border-emerald-200 active:text-emerald-700 transition-colors';
                    btn.textContent = chip.label;
                    btn.addEventListener('click', () => {
                        textarea.value = chip.text;
                        textarea.focus();
                        // Ставим курсор в конец
                        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
                    });
                    chipsContainer.appendChild(btn);
                });
            }, 0);

            const footer = document.createElement('div');
            footer.className = 'border-t p-4 flex gap-3 bg-white';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'flex-1 py-3 bg-slate-100 active:bg-slate-200 text-slate-600 font-semibold rounded-3xl text-sm transition-colors';
            cancelBtn.textContent = 'Отмена';
            cancelBtn.addEventListener('click', () => showWordModal(word.id)); // Возвращаемся к карточке слова

            const sendBtn = document.createElement('button');
            sendBtn.className = 'flex-1 py-3 bg-emerald-500 active:bg-emerald-600 text-white font-semibold rounded-3xl text-sm transition-colors flex justify-center items-center gap-2';
            sendBtn.innerHTML = '<span>Отправить</span>';

            sendBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const text = textarea.value.trim();
                if (!text) {
                    textarea.focus();
                    return;
                }
                if (text.length > 1000) {
                    alert('Описание слишком длинное. Максимум — 1000 символов.');
                    return;
                }

                sendBtn.disabled = true;
                sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Отправка...</span>';
                sendBtn.classList.add('opacity-70');

                const payload = {
                    wordId: String(word.id || '').slice(0, 120),
                    word: String(word.lz || '').slice(0, 120),
                    translation: String(word.ru || '').slice(0, 180),
                    message: text,
                    appVersion: APP_VERSION,
                    createdAt: new Date().toISOString()
                };

                try {
                    const endpoints = ['/api/report-word.php', '/api/report-word', '/.netlify/functions/report-word'];
                    let sent = false;
                    for (const endpoint of endpoints) {
                        try {
                            const response = await fetch(endpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            if (response.ok) {
                                sent = true;
                                break;
                            }
                        } catch (endpointError) {
                            warn('[Report] endpoint failed', endpoint, endpointError);
                        }
                    }

                    if (!sent) {
                        throw new Error('All endpoints failed');
                    }
                    showReportSuccess(word);
                } catch (err) {
                    warn('[Report] failed', err);
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = '<span>Отправить</span>';
                    sendBtn.classList.remove('opacity-70');
                    setTimeout(() => {
                        alert('Не удалось отправить жалобу. Попробуйте позже.');
                    }, 10);
                }
            });

            footer.append(cancelBtn, sendBtn);
            content.append(wrap, footer);
        }

        function showReportSuccess(word) {
            const content = document.getElementById('modal-content');
            content.innerHTML = '';

            const wrap = document.createElement('div');
            wrap.className = 'px-6 pt-10 pb-8 text-center';

            const iconWrap = document.createElement('div');
            iconWrap.className = 'mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5';
            iconWrap.innerHTML = '<i class="fa-solid fa-check text-emerald-600 text-4xl"></i>';

            const h3 = document.createElement('h3');
            h3.className = 'font-bold text-2xl mb-2 text-slate-800';
            h3.textContent = 'Спасибо!';

            const p = document.createElement('p');
            p.className = 'text-sm text-slate-500 mb-8 px-4 leading-relaxed';
            p.textContent = 'Отчет об ошибке успешно отправлен. Мы исправим это в ближайшем обновлении.';

            const okBtn = document.createElement('button');
            okBtn.className = 'w-full py-3.5 bg-slate-100 active:bg-slate-200 font-bold rounded-3xl text-sm transition-colors text-slate-700';
            okBtn.textContent = 'Вернуться к слову';
            okBtn.addEventListener('click', () => showWordModal(word.id));

            wrap.append(iconWrap, h3, p, okBtn);
            content.append(wrap);
        }

        function isElementVisible(element) {
            return element && !element.classList.contains('hidden');
        }

        function closeModal() {
            const modal = document.getElementById('word-modal');
            modal.classList.remove('flex');
            modal.classList.add('hidden');
            if (lastDialogTrigger && typeof lastDialogTrigger.focus === 'function') {
                lastDialogTrigger.focus({ preventScroll: true });
            }
        }

        // Tab switching
        const VALID_TABS = ['alphabet', 'vocabulary', 'practice', 'more'];
        const SEEN_SCREENS = new Set(); // чтобы анимация входа была только один раз
        let lastDialogTrigger = null;

        function switchTab(tab) {
            if (!tab || !VALID_TABS.includes(tab)) return;
            if (currentTab === tab) {
                document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
                return;
            }

            const prevTab = currentTab;
            currentTab = tab;

            tabSwitchGuard = true;
            history.replaceState(null, '', `#${tab}`);
            setTimeout(() => { tabSwitchGuard = false; }, 50);

            if (!localStorage.getItem('lezgi_notif_asked') && supportsNotifications() && Notification.permission === 'default') {
                document.getElementById('notif-banner')?.classList.remove('hidden');
            }

            const prevScreen = document.getElementById(`screen-${prevTab}`);
            const nextScreen = document.getElementById(`screen-${tab}`);
            const mainEl = document.querySelector('main');

            if (prevScreen) {
                prevScreen.classList.remove('active');
            }

            if (nextScreen) {
                nextScreen.classList.remove('active');
                const firstVisit = !SEEN_SCREENS.has(tab);
                if (firstVisit) {
                    SEEN_SCREENS.add(tab);
                    nextScreen.classList.add('entrance');
                    if (tab === 'practice') nextScreen.classList.add('fast');
                    void nextScreen.offsetHeight;
                } else {
                    nextScreen.classList.remove('entrance', 'fast');
                }
                nextScreen.classList.add('active');
                if (tab === 'vocabulary') renderWords(!firstVisit);
                if (tab === 'practice') hideGrammarList();
                document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
            }

            const nav = document.querySelector('.bottom-nav');
            if (tab === 'alphabet') {
                nav.classList.add('bg-[#121212]', 'md:bg-[#121212]', 'border-t-white/10');
                nav.classList.remove('bg-white', 'md:bg-slate-50', 'border-t-slate-100');
            } else {
                nav.classList.remove('bg-[#121212]', 'md:bg-[#121212]', 'border-t-white/10');
                nav.classList.add('bg-white', 'md:bg-slate-50', 'border-t-slate-100');
            }

            document.querySelectorAll('[id^="tab-"]').forEach(t => {
                t.classList.remove('active', 'text-emerald-600');
                t.classList.add('text-slate-500');
            });
            const tabBtn = document.getElementById(`tab-${tab}`);
            if (tabBtn) {
                tabBtn.classList.add('active', 'text-emerald-600');
                tabBtn.classList.remove('text-slate-500');
            }
        }

        // Grammar
        async function loadGrammar() {
            try {
                const res = await fetch('grammar.json');
                if (!res.ok) throw new Error('HTTP ' + res.status);
                GRAMMAR = await res.json();
                log(`[LezgiMez] Loaded ${GRAMMAR.length} grammar units`);
            } catch (e) {
                warn('[LezgiMez] Could not load grammar.json', e);
            } finally {
                const practiceGrammarView = document.getElementById('practice-grammar-view');
                if (practiceGrammarView && !practiceGrammarView.classList.contains('hidden')) {
                    renderGrammar();
                }
            }
        }

        function showGrammarList() {
            document.getElementById('practice-main-view').classList.add('hidden');
            document.getElementById('practice-grammar-view').classList.remove('hidden');
            renderGrammar();
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function hideGrammarList() {
            document.getElementById('practice-main-view').classList.remove('hidden');
            document.getElementById('practice-grammar-view').classList.add('hidden');
        }

        function grammarLevelLabel(level) {
            const map = { beginner: 'Начальный', intermediate: 'Средний', advanced: 'Продвинутый' };
            return map[level] || 'Урок';
        }

        function renderGrammar() {
            const grid = document.getElementById('grammar-units-grid');
            const stats = document.getElementById('grammar-stats');
            if (!grid) return;
            grid.innerHTML = '';

            if (GRAMMAR.length === 0) {
                grid.innerHTML = '<div class="text-center py-10 text-slate-400">Загрузка материалов...</div>';
                return;
            }

            if (stats) stats.textContent = `${GRAMMAR.length} уроков • основы и практика`;

            GRAMMAR.forEach(unit => {
                const card = document.createElement('div');
                card.className = 'bg-white border border-slate-100 active:border-emerald-200 rounded-3xl p-5 flex items-center justify-between cursor-pointer shadow-sm hover:shadow-md transition-all';

                const left = document.createElement('div');
                const id = document.createElement('div');
                id.className = 'text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1';
                id.textContent = `Юнит ${unit.id}`;
                const title = document.createElement('div');
                title.className = 'text-lg font-bold text-slate-800 leading-tight';
                title.textContent = unit.title;
                const meta = document.createElement('div');
                meta.className = 'mt-2 inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500';
                meta.textContent = grammarLevelLabel(unit.level);
                left.append(id, title, meta);

                const icon = document.createElement('div');
                icon.className = 'w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 flex-shrink-0 ml-4';
                icon.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';

                card.append(left, icon);
                card.addEventListener('click', () => showGrammarUnit(unit.id));
                grid.appendChild(card);
            });

            staggerCards(grid);
        }

        function showGrammarUnit(unitId) {
            const unit = GRAMMAR.find(u => u.id === unitId);
            if (!unit) return;

            const modal = document.getElementById('word-modal');
            const content = document.getElementById('modal-content');
            content.innerHTML = '';

            const topBar = document.createElement('div');
            topBar.className = 'flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0 relative z-10 w-full';
            topBar.innerHTML = `<div class="font-bold text-slate-800 text-lg">Теория</div>
                                <button id="modal-close-btn-grammar" class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
                                    <i class="fa-solid fa-times"></i>
                                </button>`;

            const body = document.createElement('div');
            body.className = 'px-6 py-6 overflow-y-auto flex-1 min-h-0 w-full';
            body.style.webkitOverflowScrolling = 'touch';

            const id = document.createElement('div');
            id.className = 'text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1';
            id.textContent = `Юнит ${unit.id}`;
            const title = document.createElement('h2');
            title.className = 'text-2xl font-bold text-slate-900 mb-6 leading-tight';
            title.textContent = unit.title;

            const theory = document.createElement('div');
            theory.className = 'grammar-content max-w-none text-slate-700 leading-relaxed';
            theory.innerHTML = simpleMarkdown(unit.content);

            body.append(id, title, theory);

            const footer = document.createElement('div');
            footer.className = 'p-4 bg-white border-t border-slate-100 flex flex-col shrink-0 w-full';

            const startBtn = document.createElement('button');
            startBtn.className = 'w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-colors';
            startBtn.innerHTML = '<i class="fa-solid fa-play"></i><span>Пройти упражнения</span>';
            startBtn.addEventListener('click', () => {
                closeModal();
                startGrammarQuiz(unit.id);
            });

            footer.append(startBtn);

            content.append(topBar, body, footer);

            document.getElementById('modal-close-btn-grammar').addEventListener('click', closeModal);

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function escapeHtml(text = '') {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function formatInlineMarkdown(text = '') {
            let html = escapeHtml(text);
            html = html.replace(/`([^`]+)`/g, '<code class="grammar-code">$1</code>');
            html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="grammar-strong">$1</strong>');
            html = html.replace(/\*([^*\n]+)\*/g, '<em class="grammar-em">$1</em>');

            if (html.includes('❌') && html.includes('✅')) {
                html = html.replace(/❌\s*Неправильно:\s*(.*?)\s*✅\s*Правильно:\s*(.*)/g, `
                    <div class="mt-3.5 flex flex-col gap-2.5 mb-1 w-full">
                        <div class="p-4 rounded-2xl grammar-wrong-card">
                            <div class="flex items-center gap-2 mb-1.5">
                                <i class="fa-solid fa-circle-xmark grammar-wrong text-sm"></i>
                                <span class="text-[11px] font-extrabold uppercase tracking-widest grammar-wrong">Неправильно</span>
                            </div>
                            <div class="text-[0.95rem] leading-relaxed opacity-90">$1</div>
                        </div>
                        <div class="p-4 rounded-2xl grammar-right-card">
                            <div class="flex items-center gap-2 mb-1.5">
                                <i class="fa-solid fa-circle-check grammar-right text-sm"></i>
                                <span class="text-[11px] font-extrabold uppercase tracking-widest grammar-right">Правильно</span>
                            </div>
                            <div class="text-[0.95rem] leading-relaxed opacity-90">$2</div>
                        </div>
                    </div>
                `);
            } else {
                html = html.replace(/❌\s*Неправильно:/g, '<span class="grammar-wrong font-bold">Неправильно:</span>');
                html = html.replace(/✅\s*Правильно:/g, '<span class="grammar-right font-bold">Правильно:</span>');
            }

            return html;
        }

        function renderListBlock(block, ordered = false) {
            const lines = block.split('\n').map(line => line.trimEnd()).filter(line => line.trim().length > 0);
            const marker = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
            const items = [];
            let current = null;

            function flushCurrent() {
                if (current !== null && current.trim()) items.push(current.trim());
                current = null;
            }

            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (marker.test(line)) {
                    flushCurrent();
                    current = line.replace(marker, '').trim();
                    continue;
                }

                if (ordered && /^[-*]\s+/.test(line) && current !== null) {
                    current += `\n${line}`;
                    continue;
                }

                if (current === null) current = line;
                else current += ` ${line}`;
            }
            flushCurrent();

            if (items.length === 0) return '';

            const tag = ordered ? 'ol' : 'ul';
            const isExamples = !ordered && items.every(item => item.includes(' — '));
            const cls = ordered ? 'grammar-ol' : (isExamples ? 'grammar-ul grammar-examples' : 'grammar-ul');

            const itemsHtml = items.map(item => {
                const parts = item.split(/\n(?=[-*]\s+)/).filter(Boolean);
                const main = parts.shift() || '';
                const mainHtml = formatInlineMarkdown(main);

                if (parts.length === 0) {
                    return `<li>${mainHtml}</li>`;
                }

                const subItems = parts
                    .map(part => part.replace(/^[-*]\s+/, '').trim())
                    .filter(Boolean)
                    .map(part => `<li>${formatInlineMarkdown(part)}</li>`)
                    .join('');

                return `<li>${mainHtml}<ul class="grammar-sublist">${subItems}</ul></li>`;
            }).join('');

            return `<${tag} class="${cls}">${itemsHtml}</${tag}>`;
        }

        function renderTableBlock(lines) {
            if (lines.length < 2) return '';

            const headerLine = lines[0];
            const headers = headerLine.split('|').map(cell => cell.trim()).filter(Boolean);

            let html = '<div class="grammar-table-wrapper"><table class="grammar-table"><thead><tr>';
            for (let th of headers) {
                html += `<th>${formatInlineMarkdown(th)}</th>`;
            }
            html += '</tr></thead><tbody>';

            for (let j = 2; j < lines.length; j++) {
                const rowLine = lines[j];
                const cells = rowLine.split('|').map(cell => cell.trim()).filter(Boolean);
                if (cells.length === 0) continue;
                html += '<tr>';
                for (let td of cells) {
                    html += `<td>${formatInlineMarkdown(td)}</td>`;
                }
                html += '</tr>';
            }

            html += '</tbody></table></div>';
            return html;
        }

        function renderMarkdownBlock(block) {
            if (/^###\s+/.test(block)) {
                return `<h3 class="grammar-h3">${formatInlineMarkdown(block.replace(/^###\s+/, '').trim())}</h3>`;
            }

            if (/^\*\*Для чего этот урок:\*\*/i.test(block) || /^\*\*Зачем этот юнит:\*\*/i.test(block)) {
                return `<div class="grammar-lead">${formatInlineMarkdown(block)}</div>`;
            }

            if (/^\*\*Обрати внимание:\*\*/i.test(block)) {
                return `<div class="grammar-note">${formatInlineMarkdown(block)}</div>`;
            }

            if (/^\*\*Резюме раздела/i.test(block)) {
                return `<div class="grammar-summary">${formatInlineMarkdown(block)}</div>`;
            }

            if (/^\*См\. также:/i.test(block)) {
                return `<div class="grammar-see">${formatInlineMarkdown(block)}</div>`;
            }

            if (/^\d+\.\s+/.test(block)) {
                return renderListBlock(block, true);
            }

            if (/^[-*]\s+/.test(block)) {
                return renderListBlock(block, false);
            }

            return `<p class="grammar-p">${formatInlineMarkdown(block).replace(/\n/g, '<br>')}</p>`;
        }

        function simpleMarkdown(md) {
            if (!md) return '';
            const normalized = String(md).replace(/\r\n/g, '\n').trim();
            if (!normalized) return '';
            const lines = normalized.split('\n');
            const rendered = [];
            const paragraphLines = [];

            function flushParagraph() {
                if (paragraphLines.length === 0) return;
                rendered.push(renderMarkdownBlock(paragraphLines.join('\n').trim()));
                paragraphLines.length = 0;
            }

            let i = 0;
            while (i < lines.length) {
                const rawLine = lines[i];
                const line = rawLine.trim();

                if (!line) {
                    flushParagraph();
                    i++;
                    continue;
                }

                if (/^###\s+/.test(line)) {
                    flushParagraph();
                    rendered.push(renderMarkdownBlock(line));
                    i++;
                    continue;
                }

                if (line.startsWith('|')) {
                    flushParagraph();
                    const tableLines = [];
                    while (i < lines.length && lines[i].trim().startsWith('|')) {
                        tableLines.push(lines[i].trim());
                        i++;
                    }
                    rendered.push(renderTableBlock(tableLines));
                    continue;
                }

                if (/^\d+\.\s+/.test(line)) {
                    flushParagraph();
                    const listLines = [];
                    while (i < lines.length) {
                        const current = lines[i].trim();
                        if (!current) break;
                        if (/^\d+\.\s+/.test(current) || /^[-*]\s+/.test(current)) {
                            listLines.push(current);
                            i++;
                            continue;
                        }
                        if (listLines.length > 0) {
                            listLines.push(current);
                            i++;
                            continue;
                        }
                        break;
                    }
                    rendered.push(renderListBlock(listLines.join('\n'), true));
                    continue;
                }

                if (/^[-*]\s+/.test(line)) {
                    flushParagraph();
                    const listLines = [];
                    while (i < lines.length) {
                        const current = lines[i].trim();
                        if (!current) break;
                        if (/^[-*]\s+/.test(current)) {
                            listLines.push(current);
                            i++;
                            continue;
                        }
                        if (listLines.length > 0) {
                            listLines.push(current);
                            i++;
                            continue;
                        }
                        break;
                    }
                    rendered.push(renderListBlock(listLines.join('\n'), false));
                    continue;
                }

                paragraphLines.push(line);
                i++;
            }

            flushParagraph();
            return rendered.join('');
        }

        function startGrammarQuiz(unitId) {
            const unit = GRAMMAR.find(u => u.id === unitId);
            if (!unit || !unit.exercises || unit.exercises.length === 0) return;

            practiceState = {
                exercises: unit.exercises,
                idx: 0,
                score: 0,
                mode: 'grammar',
                unitTitle: unit.title
            };
            showGrammarQuestion();
        }

        function showGrammarQuestion() {
            const modal = document.getElementById('practice-modal');
            const content = document.getElementById('practice-content');
            const q = practiceState.exercises[practiceState.idx];
            content.innerHTML = '';

            const progress = Math.round((practiceState.idx / practiceState.exercises.length) * 100);

            const header = document.createElement('div');
            header.className = 'flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0 relative z-10 w-full sticky top-0';
            const hTitle = document.createElement('div');
            hTitle.className = 'font-bold text-slate-800 text-lg truncate mr-4';
            hTitle.textContent = practiceState.unitTitle;
            const close = document.createElement('button');
            close.className = 'w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 rounded-full transition-all';
            close.innerHTML = '<i class="fa-solid fa-times"></i>';
            close.addEventListener('click', endPractice);
            header.append(hTitle, close);

            const body = document.createElement('div');
            body.className = 'p-6';

            const qNum = document.createElement('div');
            qNum.className = 'text-emerald-600 text-xs font-bold uppercase tracking-wider mb-4';
            qNum.textContent = `Вопрос ${practiceState.idx + 1} из ${practiceState.exercises.length}`;

            const qText = document.createElement('div');
            qText.className = 'text-xl font-bold text-slate-800 mb-8 leading-tight';
            qText.textContent = q.question;

            const optsWrap = document.createElement('div');
            optsWrap.className = 'space-y-3';

            Object.entries(q.options).forEach(([key, val]) => {
                const b = document.createElement('button');
                b.className = 'w-full text-left px-5 py-4 border-2 border-slate-100 rounded-2xl flex items-center gap-4 transition-all bg-white';

                const keyCircle = document.createElement('div');
                keyCircle.className = 'w-8 h-8 rounded-full border-2 border-slate-100 flex items-center justify-center font-bold text-slate-400 flex-shrink-0';
                keyCircle.textContent = key;

                const valText = document.createElement('div');
                valText.className = 'font-medium text-slate-700';
                valText.textContent = val;

                b.append(keyCircle, valText);
                b.addEventListener('click', () => checkGrammarAnswer(key, q.correct, q.explanation, b));
                optsWrap.appendChild(b);
            });

            const progWrap = document.createElement('div');
            progWrap.className = 'mt-10';
            const progBg = document.createElement('div');
            progBg.className = 'h-1 bg-emerald-100 rounded-full overflow-hidden';
            const progBar = document.createElement('div');
            progBar.className = 'h-1 bg-emerald-600 transition-all';
            progBar.style.width = `${progress}%`;
            progBg.appendChild(progBar);
            progWrap.appendChild(progBg);

            body.append(qNum, qText, optsWrap, progWrap);
            content.append(header, body);

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function checkGrammarAnswer(selected, correct, explanation, btn) {
            const allBtns = btn.parentElement.querySelectorAll('button');
            allBtns.forEach(b => b.disabled = true);

            const isCorrect = selected === correct;
            if (isCorrect) { practiceState.score++; vibrateSuccess(); }
            else { vibrateError(); }

            btn.classList.add(isCorrect ? '!border-emerald-500' : '!border-red-300', isCorrect ? '!bg-emerald-50' : '!bg-red-50');
            const circle = btn.querySelector('div');
            circle.classList.replace('border-slate-100', isCorrect ? 'border-emerald-500' : 'border-red-300');
            circle.classList.replace('text-slate-400', isCorrect ? 'text-emerald-600' : 'text-red-500');
            if (isCorrect) circle.innerHTML = '<i class="fa-solid fa-check"></i>';
            else circle.innerHTML = '<i class="fa-solid fa-times"></i>';

            if (!isCorrect) {
                allBtns.forEach(b => {
                    const key = b.querySelector('div').textContent;
                    if (key === correct) {
                        b.classList.add('!border-emerald-500', '!bg-emerald-50');
                        b.querySelector('div').classList.replace('border-slate-100', 'border-emerald-500');
                        b.querySelector('div').classList.replace('text-slate-400', 'text-emerald-600');
                        b.querySelector('div').innerHTML = '<i class="fa-solid fa-check"></i>';
                    }
                });
            }

            // Show explanation
            const expl = document.createElement('div');
            expl.className = `mt-6 p-4 rounded-2xl text-sm leading-relaxed animate-fade-in ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`;
            expl.textContent = '';
            const resultStrong = document.createElement('strong');
            resultStrong.textContent = isCorrect ? 'Верно!' : 'Не совсем...';
            expl.append(resultStrong, document.createElement('br'), document.createTextNode(explanation));
            btn.parentElement.appendChild(expl);

            const nextBtn = document.createElement('button');
            nextBtn.className = 'mt-6 w-full py-4 bg-slate-800 text-white font-bold rounded-2xl shadow-lg';
            nextBtn.textContent = (practiceState.idx + 1 === practiceState.exercises.length) ? 'Завершить' : 'Дальше';
            nextBtn.addEventListener('click', () => {
                practiceState.idx++;
                if (practiceState.idx >= practiceState.exercises.length) {
                    practiceState.words = practiceState.exercises; // For results calculation
                    showResults();
                } else {
                    showGrammarQuestion();
                }
            });
            btn.parentElement.appendChild(nextBtn);
        }

        // Practice
        const SHOW_PRACTICE_IPA = false;
        let practiceState = { words: [], idx: 0, score: 0, mode: '' };
        function startFlashcards() {
            const pool = practiceCategory === 'all' ? WORDS : WORDS.filter(w => w.cat === practiceCategory);
            const now = Date.now();
            // Получаем ВСЕ просроченные (сортируем от самых старых)
            let due = pool.filter(w => PROGRESS.srs[w.id] && PROGRESS.srs[w.id].next <= now && PROGRESS.srs[w.id].ivl > 0)
                .sort((a, b) => PROGRESS.srs[a.id].next - PROGRESS.srs[b.id].next);
            let unknown = shuffle(pool.filter(w => !PROGRESS.srs[w.id] || PROGRESS.srs[w.id].ivl === 0));

            const targetSessionSize = 25; // Увеличим размер сессии для удобства

            let initialWords = due.slice(0, targetSessionSize);
            // Добавляем новые/ошибочные слова только если просроченных недостаточно
            if (initialWords.length < targetSessionSize) {
                initialWords.push(...unknown.slice(0, targetSessionSize - initialWords.length));
            }

            // Если итоговая очередь слишком мала, прерываем
            if (initialWords.length < 3) {
                return alert('Вам пока нечего повторять в этой категории! Возвращайтесь позже.');
            }

            // Deduplicate just in case
            initialWords = Array.from(new Set(initialWords.map(w => w.id))).map(id => initialWords.find(w => w.id === id));

            practiceState = {
                words: initialWords,
                queue: [...initialWords],
                learnedInSession: new Set(),
                mistakesInSession: new Set(),
                seenInSession: new Set(),
                score: 0,
                mode: 'flashcards',
                attempts: 0
            };
            showFlashcard();
        }

        let flashcardKeydownHandler = null;

        function showFlashcard() {
            const modal = document.getElementById('practice-modal');
            const content = document.getElementById('practice-content');
            content.innerHTML = '';

            const MAX_ATTEMPTS = practiceState.words.length * 3;
            if (practiceState.queue.length === 0 || practiceState.attempts >= MAX_ATTEMPTS) {
                // practiceState.score already holds the correct count of words marked 'easy' on the first try
                showResults();
                return;
            }

            const w = practiceState.queue[0];
            const total = practiceState.words.length;
            const learned = practiceState.learnedInSession.size;
            const progress = Math.round((learned / total) * 100);

            const header = document.createElement('div');
            header.className = 'flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0 relative z-10 w-full sticky top-0';
            const hTitle = document.createElement('div');
            hTitle.className = 'font-bold text-slate-800 text-lg';
            hTitle.textContent = `Карточки ${learned}/${total}`;
            const close = document.createElement('button');
            close.className = 'w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 rounded-full transition-all';
            close.innerHTML = '<i class="fa-solid fa-times"></i>';
            close.addEventListener('click', endPractice);
            header.append(hTitle, close);

            const body = document.createElement('div');
            body.className = 'p-6 flex flex-col items-center';

            const flip = document.createElement('div');
            flip.className = 'flip-card w-full max-w-[300px]';
            flip.id = 'flip-card';
            const inner = document.createElement('div');
            inner.className = 'flip-card-inner bg-white border border-emerald-100 rounded-3xl';

            const front = document.createElement('div');
            front.className = 'flip-card-front flex flex-col justify-center items-center p-8 text-center';
            const fTop = document.createElement('div');
            fTop.className = 'text-emerald-600 text-sm tracking-widest mb-4';
            fTop.textContent = 'ЛЕЗГИНСКИЙ';
            const fWord = document.createElement('div');
            fWord.className = 'text-5xl font-bold text-emerald-900 lezgin-text';
            fWord.textContent = w.lz;
            front.append(fTop, fWord);
            if (SHOW_PRACTICE_IPA && w.ipa) {
                const ipa = document.createElement('div');
                ipa.className = 'mt-2 text-emerald-700 opacity-70 text-base ipa-text';
                ipa.textContent = w.ipa;
                front.appendChild(ipa);
            }

            const back = document.createElement('div');
            back.className = 'flip-card-back flex flex-col justify-center items-center p-8 bg-emerald-50 text-center rounded-3xl border border-emerald-100';
            const bTop = document.createElement('div');
            bTop.className = 'text-emerald-600 text-sm tracking-widest mb-4';
            bTop.textContent = 'ПЕРЕВОД';
            const bWord = document.createElement('div');
            bWord.className = 'text-4xl font-semibold text-emerald-900';
            bWord.textContent = w.ru;
            back.append(bTop, bWord);
            if (w.ex) {
                const ex = document.createElement('div');
                ex.className = 'mt-4 text-base text-slate-600 italic';
                ex.textContent = w.ex;
                back.appendChild(ex);
            }

            inner.append(front, back);
            flip.appendChild(inner);
            flip.addEventListener('click', () => flip.classList.toggle('flipped'));

            const actions = document.createElement('div');
            actions.className = 'flex gap-2 mt-8 w-full max-w-[300px]';

            const createBtn = (cls, icon, txt, mode) => {
                const b = document.createElement('button');
                b.className = `flex-1 py-4 font-bold rounded-2xl text-xs uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${cls}`;
                b.innerHTML = `<i class="fa-solid ${icon} text-xl"></i><span>${txt}</span>`;
                b.addEventListener('click', () => markCard(mode));
                return b;
            };

            actions.append(
                createBtn('border-2 border-red-100 text-red-600', 'fa-times', 'Не знаю', 'wrong'),
                createBtn('border-2 border-amber-100 text-amber-600', 'fa-rotate-right', 'Повторить', 'hard'),
                createBtn('bg-emerald-600 text-white', 'fa-check', 'Изучено', 'easy')
            );

            const progWrap = document.createElement('div');
            progWrap.className = 'w-full max-w-[300px] mt-8 text-center';
            const progBg = document.createElement('div');
            progBg.className = 'h-1 bg-emerald-100 rounded-full overflow-hidden';
            const progBar = document.createElement('div');
            progBar.className = 'h-1 bg-emerald-600 transition-all';
            progBar.style.width = `${progress}%`;
            progBg.appendChild(progBar);
            const queueInfo = document.createElement('div');
            queueInfo.className = 'text-xs text-slate-400 mt-2 font-medium';
            queueInfo.textContent = `Слов в очереди: ${practiceState.queue.length}`;
            progWrap.append(progBg, queueInfo);

            body.append(flip, actions, progWrap);
            content.append(header, body);

            modal.classList.remove('hidden');
            modal.classList.add('flex');

            if (flashcardKeydownHandler) {
                document.removeEventListener('keydown', flashcardKeydownHandler);
            }
            flashcardKeydownHandler = (e) => {
                if (e.key === 'Escape') {
                    endPractice();
                    return;
                }
                const isFlashcard = document.getElementById('flip-card');
                if (isFlashcard) {
                    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); document.getElementById('flip-card')?.classList.toggle('flipped'); }
                    if (e.key === '1') markCard('wrong');
                    if (e.key === '2') markCard('hard');
                    if (e.key === '3') markCard('easy');
                }
            };
            document.addEventListener('keydown', flashcardKeydownHandler);
        }
        function markCard(status) {
            const w = practiceState.queue.shift();
            if (!w) {
                showResults();
                return;
            }

            practiceState.attempts = (practiceState.attempts || 0) + 1;
            const isFirstSeen = !practiceState.seenInSession.has(w.id);
            practiceState.seenInSession.add(w.id);

            if (status === 'easy') {
                vibrateSuccess();
                practiceState.learnedInSession.add(w.id);
                reviewSrsCard(w.id, isFirstSeen ? SRS_RATING.Easy : SRS_RATING.Good);
                if (isFirstSeen) practiceState.score++;
                if (!PROGRESS.learned.includes(w.id)) PROGRESS.learned.push(w.id);
            } else if (status === 'hard') {
                practiceState.mistakesInSession.add(w.id);
                practiceState.queue.push(w);
                reviewSrsCard(w.id, SRS_RATING.Hard);
            } else {
                vibrateError();
                practiceState.mistakesInSession.add(w.id);
                practiceState.queue.push(w);
                reviewSrsCard(w.id, SRS_RATING.Again);
                const idx = PROGRESS.learned.indexOf(w.id);
                if (idx > -1) PROGRESS.learned.splice(idx, 1);
            }

            saveProgress();
            updateTodayUI();
            showFlashcard();
        }
        function startQuiz() {
            const pool = practiceCategory === 'all' ? WORDS : WORDS.filter(w => w.cat === practiceCategory);

            practiceState = {
                words: shuffle([...pool]).slice(0, 10),
                idx: 0,
                score: 0,
                mode: 'quiz'
            };
            showQuizQuestion();
        }
        function showQuizQuestion() {
            const modal = document.getElementById('practice-modal');
            const content = document.getElementById('practice-content');
            const w = practiceState.words[practiceState.idx];
            content.innerHTML = ''; // Очищаем контент

            const progress = Math.round((practiceState.idx / practiceState.words.length) * 100);
            const allRu = WORDS.map(x => x.ru);
            let opts = [w.ru];
            while (opts.length < 4) {
                const r = allRu[Math.floor(Math.random() * allRu.length)];
                if (!opts.includes(r)) opts.push(r);
            }
            shuffle(opts);

            const header = document.createElement('div');
            header.className = 'flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0 relative z-10 w-full sticky top-0';
            const hTitle = document.createElement('div');
            hTitle.className = 'font-bold text-slate-800 text-lg';
            hTitle.textContent = `Тест ${practiceState.idx + 1}/${practiceState.words.length}`;
            const close = document.createElement('button');
            close.className = 'w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 rounded-full transition-all';
            close.innerHTML = '<i class="fa-solid fa-times"></i>';
            close.addEventListener('click', endPractice);
            header.append(hTitle, close);

            const body = document.createElement('div');
            body.className = 'p-6';
            const qWrap = document.createElement('div');
            qWrap.className = 'text-center mb-8';
            const qTop = document.createElement('div');
            qTop.className = 'text-sm text-emerald-600 tracking-widest';
            qTop.textContent = 'ЧТО ЗНАЧИТ';
            const qWord = document.createElement('div');
            qWord.className = 'text-[42px] font-bold text-emerald-900 lezgin-text mt-3';
            qWord.textContent = w.lz;
            qWrap.append(qTop, qWord);

            const optsWrap = document.createElement('div');
            optsWrap.className = 'space-y-3';
            opts.forEach(opt => {
                const b = document.createElement('button');
                b.className = 'quiz-btn w-full text-left px-5 py-4 border border-slate-200 active:border-emerald-300 rounded-3xl flex items-center justify-between transition-colors';
                const span = document.createElement('span');
                span.className = 'font-medium';
                span.textContent = opt;
                const icon = document.createElement('i');
                icon.className = 'fa-solid fa-chevron-right text-emerald-300';
                b.appendChild(span);
                b.appendChild(icon);
                b.addEventListener('click', () => checkAnswer(opt, w.ru, b));
                optsWrap.appendChild(b);
            });

            const progWrap = document.createElement('div');
            progWrap.className = 'mt-8';
            const progBg = document.createElement('div');
            progBg.className = 'h-1 bg-emerald-100 rounded-full overflow-hidden';
            const progBar = document.createElement('div');
            progBar.className = 'h-1 bg-emerald-600 transition-all';
            progBar.style.width = `${progress}%`;
            progBg.appendChild(progBar);
            progWrap.appendChild(progBg);

            body.append(qWrap, optsWrap, progWrap);
            content.append(header, body);

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        function checkAnswer(selected, correct, btn) {
            btn.parentElement.classList.add('pointer-events-none');
            const allBtns = btn.parentElement.querySelectorAll('button');
            allBtns.forEach(b => b.disabled = true);

            if (selected === correct) {
                vibrateSuccess();
                practiceState.score++;
                btn.classList.add('!border-emerald-500', '!bg-emerald-50', 'text-emerald-700');

                const word = practiceState.words[practiceState.idx];
                reviewSrsCard(word.id, SRS_RATING.Good);
                if (!PROGRESS.learned.includes(word.id)) {
                    PROGRESS.learned.push(word.id);
                }
            } else {
                vibrateError();
                btn.classList.add('!border-red-300', '!bg-red-50', 'text-red-600');
                allBtns.forEach(b => {
                    if (b.textContent.trim() === correct) {
                        b.classList.add('!border-emerald-500', '!bg-emerald-50', 'text-emerald-700');
                    }
                });

                const word = practiceState.words[practiceState.idx];
                reviewSrsCard(word.id, SRS_RATING.Again);
                const learnedIdx = PROGRESS.learned.indexOf(word.id);
                if (learnedIdx > -1) PROGRESS.learned.splice(learnedIdx, 1);
            }

            saveProgress();
            updateTodayUI();

            setTimeout(() => {
                practiceState.idx++;
                if (practiceState.idx >= practiceState.words.length) {
                    showResults();
                } else {
                    showQuizQuestion();
                }
            }, 1500);
        }
        function createCelebrationParticle() {
            const emojis = ['🎉', '✨', '🌟', '🏆', '👏', '🥳', '💯'];
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            const el = document.createElement('div');
            el.className = 'fixed pointer-events-none text-3xl select-none z-[9999]';
            el.textContent = emoji;

            const startX = Math.random() * 100;
            el.style.left = `${startX}%`;
            el.style.bottom = `-50px`;
            el.style.opacity = '1';

            const duration = 2 + Math.random() * 2;
            const delay = Math.random() * 0.5;
            const size = 20 + Math.random() * 25;

            el.style.fontSize = `${size}px`;
            el.style.transition = `transform ${duration}s cubic-bezier(0.1, 0.8, 0.3, 1), opacity ${duration}s ease-out`;
            el.style.transitionDelay = `${delay}s`;

            document.body.appendChild(el);

            requestAnimationFrame(() => {
                const endY = window.innerHeight + 100;
                const endXMove = (Math.random() - 0.5) * 200;
                el.style.transform = `translate(${endXMove}px, -${endY}px) rotate(${Math.random() * 360}deg)`;
                el.style.opacity = '0';
            });

            setTimeout(() => {
                el.remove();
            }, (duration + delay) * 1000 + 100);
        }

        function showResults() {
            vibrateComplete();
            const modal = document.getElementById('practice-modal');
            const content = document.getElementById('practice-content');
            content.innerHTML = '';

            const total = practiceState.words.length;
            const pct = Math.round((practiceState.score / total) * 100);

            PROGRESS.stats.quizzes++;
            PROGRESS.stats.scoreSum += pct;
            saveProgress();

            const resWrap = document.createElement('div');
            resWrap.className = 'px-8 pt-10 pb-8 text-center flex flex-col items-center justify-center animate-fade-in';

            if (pct === 100) {
                const cupWrap = document.createElement('div');
                cupWrap.className = 'w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 border border-amber-200/50 shadow-md relative';
                cupWrap.innerHTML = '<i class="fa-solid fa-trophy text-5xl text-amber-500 animate-pulse"></i><span class="absolute -top-1 -right-1 text-2xl">🎉</span>';

                const title = document.createElement('h2');
                title.className = 'text-2xl font-extrabold text-emerald-850 tracking-tight leading-tight';
                title.textContent = 'Отличная работа!';

                const sub = document.createElement('p');
                sub.className = 'text-slate-500 text-sm mt-2 mb-6 max-w-[280px]';
                sub.textContent = 'Вы блестяще справились со всеми заданиями на 100%! Лезгинский язык гордится вами!';

                resWrap.append(cupWrap, title, sub);

                for (let i = 0; i < 35; i++) {
                    createCelebrationParticle();
                }
            } else {
                const scoreCircle = document.createElement('div');
                scoreCircle.className = `w-24 h-24 rounded-full flex items-center justify-center mb-6 border font-bold text-3xl shadow-sm ${pct >= 70 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`;
                scoreCircle.textContent = `${pct}%`;

                const title = document.createElement('h2');
                title.className = 'text-xl font-extrabold text-slate-800 tracking-tight leading-tight';
                title.textContent = pct >= 70 ? 'Хороший результат!' : 'Продолжайте учиться!';

                const sub = document.createElement('p');
                sub.className = 'text-slate-500 text-sm mt-2 mb-6 max-w-[280px]';
                sub.textContent = pct >= 70 ? 'Отличный шаг к уверенному владению языком. Повторите ещё раз, чтобы закрепить результат!' : 'Ничего страшного! Ошибки — это часть обучения. Попробуйте ещё раз!';

                resWrap.append(scoreCircle, title, sub);
            }

            const info = document.createElement('div');
            info.className = 'text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100/60 px-4 py-1.5 rounded-full';
            info.textContent = `Результат: ${practiceState.score} из ${total}`;

            const actions = document.createElement('div');
            actions.className = 'mt-9 flex gap-3 w-full';
            const close = document.createElement('button');
            close.className = 'flex-1 py-4 border border-slate-200 active:bg-slate-50 font-semibold rounded-3xl text-sm transition-colors';
            close.textContent = 'Закрыть';
            close.addEventListener('click', endPractice);
            const again = document.createElement('button');
            again.className = 'flex-1 py-4 bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-3xl text-sm transition-colors shadow-md shadow-emerald-100';
            again.textContent = 'Ещё раз';
            again.addEventListener('click', restartPractice);
            actions.append(close, again);

            resWrap.append(info, actions);
            content.appendChild(resWrap);
        }
        function restartPractice() {
            if (practiceState.mode === 'flashcards') startFlashcards();
            else if (practiceState.mode === 'pairs') startPairs();
            else if (practiceState.mode === 'oddWord') startOddWord();
            else if (practiceState.mode === 'grammar') startGrammarExercises(GRAMMAR.find(u => u.id === practiceState.unitId) || GRAMMAR[0]);
            else startQuiz();
        }

        function endPractice() {
            const modal = document.getElementById('practice-modal');
            modal.classList.remove('flex');
            modal.classList.add('hidden');
            if (flashcardKeydownHandler) {
                document.removeEventListener('keydown', flashcardKeydownHandler);
                flashcardKeydownHandler = null;
            }
            renderWords(); // Refresh dictionary list
        }
        function startPairs() {
            const pool = practiceCategory === 'all' ? WORDS : WORDS.filter(w => w.cat === practiceCategory);

            const selectedWords = shuffle([...pool]).slice(0, 5);

            practiceState = {
                words: selectedWords,
                leftItems: shuffle(selectedWords.map(w => ({ id: w.id, text: w.lz, type: 'lz' }))),
                rightItems: shuffle(selectedWords.map(w => ({ id: w.id, text: w.ru, type: 'ru' }))),
                selectedLeft: null,
                selectedRight: null,
                matchedIds: [],
                score: 0,
                mode: 'pairs'
            };
            showPairsGame();
        }
        function showPairsGame() {
            const modal = document.getElementById('practice-modal');
            const content = document.getElementById('practice-content');
            content.innerHTML = '';

            const progress = Math.round((practiceState.matchedIds.length / practiceState.words.length) * 100);

            const header = document.createElement('div');
            header.className = 'flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0 relative z-10 w-full sticky top-0';
            const hTitle = document.createElement('div');
            hTitle.className = 'font-bold text-slate-800 text-lg';
            hTitle.textContent = `Пары ${practiceState.matchedIds.length}/${practiceState.words.length}`;
            const close = document.createElement('button');
            close.className = 'w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 rounded-full transition-all';
            close.innerHTML = '<i class="fa-solid fa-times"></i>';
            close.addEventListener('click', endPractice);
            header.append(hTitle, close);

            const body = document.createElement('div');
            body.className = 'p-6 flex flex-col h-full';

            const grid = document.createElement('div');
            grid.className = 'flex gap-4 flex-1';

            const createCol = (items, side, selId) => {
                const col = document.createElement('div');
                col.className = 'flex-1 flex flex-col gap-3';
                items.forEach(item => {
                    const b = document.createElement('button');
                    b.className = 'flex-1 min-h-[56px] px-3 py-2 border-2 rounded-2xl text-sm transition-all break-words';
                    b.id = `pair-${side}-${item.id}`;
                    b.textContent = item.text;
                    if (practiceState.matchedIds.includes(item.id)) {
                        b.classList.add('opacity-0', 'pointer-events-none');
                    } else if (selId === item.id) {
                        b.classList.add('border-emerald-500', 'bg-emerald-50');
                    } else {
                        b.classList.add('border-slate-200', 'bg-white');
                    }
                    b.addEventListener('click', () => selectPairItem(side, item.id));
                    col.appendChild(b);
                });
                return col;
            };

            grid.appendChild(createCol(practiceState.leftItems, 'left', practiceState.selectedLeft));
            grid.appendChild(createCol(practiceState.rightItems, 'right', practiceState.selectedRight));

            const progWrap = document.createElement('div');
            progWrap.className = 'mt-8 mb-2';
            const progBg = document.createElement('div');
            progBg.className = 'h-1 bg-emerald-100 rounded-full overflow-hidden';
            const progBar = document.createElement('div');
            progBar.className = 'h-1 bg-emerald-600 transition-all';
            progBar.style.width = `${progress}%`;
            progBg.appendChild(progBar);
            progWrap.appendChild(progBg);

            body.append(grid, progWrap);
            content.append(header, body);

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        function selectPairItem(side, id) {
            const leftTrigger = `pair-left-${id}`;
            const rightTrigger = `pair-right-${id}`;

            if (side === 'left') {
                if (practiceState.selectedLeft === id) practiceState.selectedLeft = null;
                else practiceState.selectedLeft = id;
            } else {
                if (practiceState.selectedRight === id) practiceState.selectedRight = null;
                else practiceState.selectedRight = id;
            }

            showPairsGame();

            if (practiceState.selectedLeft && practiceState.selectedRight) {
                const leftBtn = document.getElementById('pair-left-' + practiceState.selectedLeft);
                const rightBtn = document.getElementById('pair-right-' + practiceState.selectedRight);
                const isMatch = practiceState.selectedLeft === practiceState.selectedRight;

                if (isMatch) {
                    leftBtn.classList.replace('border-emerald-500', 'border-green-500');
                    leftBtn.classList.add('bg-green-100', 'text-green-800');
                    rightBtn.classList.replace('border-emerald-500', 'border-green-500');
                    rightBtn.classList.add('bg-green-100', 'text-green-800');

                    practiceState.score++;
                    const matchedId = practiceState.selectedLeft;

                    if (!PROGRESS.learned.includes(matchedId)) {
                        PROGRESS.learned.push(matchedId);
                    }

                    practiceState.selectedLeft = null;
                    practiceState.selectedRight = null;

                    // Плавное исчезновение через 0.5 секунды
                    setTimeout(() => {
                        leftBtn.classList.add('opacity-0', 'transition-opacity', 'duration-500', 'ease-out');
                        rightBtn.classList.add('opacity-0', 'transition-opacity', 'duration-500', 'ease-out');
                    }, 500);

                    // Перерисовка игры после окончания анимации исчезновения (1 секунда суммарно)
                    setTimeout(() => {
                        practiceState.matchedIds.push(matchedId);

                        reviewSrsCard(matchedId, SRS_RATING.Good);

                        saveProgress();

                        if (practiceState.matchedIds.length === practiceState.words.length) {
                            showResults();
                        } else {
                            showPairsGame();
                        }
                    }, 1000);
                } else {
                    vibrateError();
                    leftBtn.classList.replace('border-emerald-500', 'border-red-500');
                    leftBtn.classList.replace('bg-emerald-50', 'bg-red-50');
                    leftBtn.classList.replace('text-emerald-700', 'text-red-700');
                    rightBtn.classList.replace('border-emerald-500', 'border-red-500');
                    rightBtn.classList.replace('bg-emerald-50', 'bg-red-50');
                    rightBtn.classList.replace('text-emerald-700', 'text-red-700');

                    leftBtn.style.animation = 'shake 0.4s';
                    rightBtn.style.animation = 'shake 0.4s';
                    reviewSrsCard(practiceState.selectedLeft, SRS_RATING.Hard);
                    reviewSrsCard(practiceState.selectedRight, SRS_RATING.Hard);
                    saveProgress();
                    updateTodayUI();

                    practiceState.selectedLeft = null;
                    practiceState.selectedRight = null;

                    setTimeout(() => {
                        showPairsGame();
                    }, 500);
                }
            }
        }
        function startOddWord() {
            const allCats = [...new Set(WORDS.map(w => w.cat))]; // Используем WORDS

            practiceState = {
                questions: [],
                idx: 0,
                score: 0,
                mode: 'oddWord'
            };

            for (let i = 0; i < 10; i++) {
                let targetCat = practiceCategory === 'all' ? allCats[Math.floor(Math.random() * allCats.length)] : practiceCategory; // Используем state
                let targetWords = WORDS.filter(w => w.cat === targetCat); // Используем WORDS

                if (targetWords.length < 3) {
                    const validCats = allCats.filter(c => WORDS.filter(w => w.cat === c).length >= 3); // Используем WORDS
                    targetCat = validCats[Math.floor(Math.random() * validCats.length)]; // Используем WORDS
                    targetWords = WORDS.filter(w => w.cat === targetCat); // Используем WORDS
                }

                const correctWords = shuffle([...targetWords]).slice(0, 3);
                const otherCats = allCats.filter(c => c !== targetCat);
                const oddCat = otherCats[Math.floor(Math.random() * otherCats.length)];
                const oddWord = shuffle(WORDS.filter(w => w.cat === oddCat))[0];

                const options = shuffle([...correctWords, oddWord]);

                practiceState.questions.push({
                    options: options,
                    oddWordId: oddWord.id,
                    cat: targetCat
                });
            }

            showOddWordQuestion();
        }
        function showOddWordQuestion() {
            const modal = document.getElementById('practice-modal');
            const content = document.getElementById('practice-content');
            const q = practiceState.questions[practiceState.idx];
            content.innerHTML = '';

            const progress = Math.round((practiceState.idx / practiceState.questions.length) * 100);

            const header = document.createElement('div');
            header.className = 'flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0 relative z-10 w-full sticky top-0';
            const hTitle = document.createElement('div');
            hTitle.className = 'font-bold text-slate-800 text-lg';
            hTitle.textContent = `Лишнее слово ${practiceState.idx + 1}/${practiceState.questions.length}`;
            const close = document.createElement('button');
            close.className = 'w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 rounded-full transition-all';
            close.innerHTML = '<i class="fa-solid fa-times"></i>';
            close.addEventListener('click', endPractice);
            header.append(hTitle, close);

            const body = document.createElement('div');
            body.className = 'p-6';
            const qWrap = document.createElement('div');
            qWrap.className = 'grid grid-cols-1 gap-3';
            q.options.forEach(opt => {
                const b = document.createElement('button');
                b.className = 'odd-btn w-full text-left px-5 py-4 border-2 border-slate-100 rounded-3xl flex items-center justify-between transition-all bg-white';
                b.dataset.id = opt.id;

                const textWrap = document.createElement('div');
                const lzDiv = document.createElement('div');
                lzDiv.className = 'font-bold lezgin-text text-xl text-emerald-900';
                lzDiv.textContent = opt.lz;
                const ruDiv = document.createElement('div');
                ruDiv.className = 'text-sm text-slate-400 mt-0.5';
                ruDiv.textContent = opt.ru;
                textWrap.appendChild(lzDiv);
                textWrap.appendChild(ruDiv);

                const icon = document.createElement('i');
                icon.className = 'fa-regular fa-circle text-slate-200 text-xl';

                b.appendChild(textWrap);
                b.appendChild(icon);
                b.addEventListener('click', () => checkOddWord(opt.id, b));
                qWrap.appendChild(b);
            });

            const progWrap = document.createElement('div');
            progWrap.className = 'mt-10';
            const progBg = document.createElement('div');
            progBg.className = 'h-1 bg-emerald-100 rounded-full overflow-hidden';
            const progBar = document.createElement('div');
            progBar.className = 'h-1 bg-emerald-600 transition-all';
            progBar.style.width = `${progress}%`;
            progBg.appendChild(progBar);
            progWrap.appendChild(progBg);

            body.append(qWrap, progWrap);
            content.append(header, body);

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        function checkOddWord(selectedId, btn) {
            btn.parentElement.classList.add('pointer-events-none');
            const q = practiceState.questions[practiceState.idx];
            const allBtns = btn.parentElement.querySelectorAll('button');
            allBtns.forEach(b => b.disabled = true);

            if (selectedId === q.oddWordId) {
                practiceState.score++;
                btn.classList.add('!border-emerald-500', '!bg-emerald-50');
                btn.querySelector('i').className = 'fa-solid fa-check-circle text-emerald-500 text-xl';

                const word = WORDS.find(w => w.id === selectedId);
                if (word) {
                    reviewSrsCard(word.id, SRS_RATING.Good);
                    if (!PROGRESS.learned.includes(word.id)) {
                        PROGRESS.learned.push(word.id);
                    }
                }
            } else {
                vibrateError();
                reviewSrsCard(selectedId, SRS_RATING.Hard);
                btn.classList.add('!border-red-300', '!bg-red-50');
                btn.querySelector('i').className = 'fa-solid fa-times-circle text-red-400 text-xl';

                allBtns.forEach(b => {
                    if (b.dataset.id === q.oddWordId) {
                        b.classList.add('!border-emerald-500', '!bg-emerald-50');
                        b.querySelector('i').className = 'fa-solid fa-check-circle text-emerald-500 text-xl';
                    }
                });
            }

            saveProgress();
            updateTodayUI();

            setTimeout(() => {
                practiceState.idx++;
                if (practiceState.idx >= practiceState.questions.length) {
                    practiceState.words = practiceState.questions;
                    showResults();
                } else {
                    showOddWordQuestion();
                }
            }, 1500);
        }

        function addToPractice(wordId) {
            const word = WORDS.find(w => w.id === wordId); // Используем WORDS
            if (!word) return;

            let unknown = WORDS.filter(w => w.id !== wordId && !PROGRESS.learned.includes(w.id)); // Используем WORDS, PROGRESS.learned
            if (unknown.length < 9) {
                // Fill up with already learned words if necessary
                const learned = shuffle(WORDS.filter(w => w.id !== wordId && PROGRESS.learned.includes(w.id))); // Используем WORDS, PROGRESS.learned
                unknown.push(...learned.slice(0, 9 - unknown.length));
            }

            const others = shuffle(unknown).slice(0, 9);
            const initialWords = [word, ...others];

            practiceState = {
                words: initialWords,
                queue: [...initialWords],
                learnedInSession: new Set(),
                mistakesInSession: new Set(),
                seenInSession: new Set(),
                score: 0,
                mode: 'flashcards',
                attempts: 0,
                totalMistakes: 0
            };
            showFlashcard();
        }

        // =============== ТЁМНАЯ ТЕМА ===============
        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            updateThemeUI();
        }

        function initTheme() {
            const saved = localStorage.getItem('lezgi_theme');
            if (saved) {
                applyTheme(saved);
            } else {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
                applyTheme(prefersDark.matches ? 'dark' : 'light');
            }

            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem('lezgi_theme')) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }

        function toggleTheme() {
            const html = document.documentElement;
            const isDark = html.getAttribute('data-theme') === 'dark';
            const newTheme = isDark ? 'light' : 'dark';
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('lezgi_theme', newTheme);
            updateThemeUI();
        }

        function updateThemeUI() {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const icon = document.getElementById('theme-icon');
            const label = document.getElementById('theme-label');
            if (icon) {
                icon.className = `fa-solid fa-${isDark ? 'sun' : 'moon'} w-5 text-emerald-600 text-center`;
            }
            if (label) {
                label.textContent = isDark ? 'Тёмная тема' : 'Светлая тема';
            }
        }

        function hideLoader() {
            const loader = document.getElementById('app-loader');
            document.body.classList.remove('loading');
            if (!loader) return;
            loader.classList.add('fade-out');
            setTimeout(() => loader.remove(), 550);
        }

        async function startPreloading() {
            const loaderStatus = document.getElementById('loader-status');
            const loaderProgress = document.getElementById('loader-progress-fill');
            const loaderPercent = document.getElementById('loader-percent');
            const loaderStep1 = document.getElementById('loader-step-words');
            const loaderStep2 = document.getElementById('loader-step-grammar');
            const loaderStep3 = document.getElementById('loader-step-audio');
            const skipBtn = document.getElementById('loader-skip-btn');

            const assets = [
                { type: 'json', key: 'words', url: 'words.json', label: 'База слов' },
                { type: 'json', key: 'grammar', url: 'grammar.json', label: 'Грамматика' }
            ];

            ALPHABET_AUDIO_FILES.forEach(letter => {
                const path = `audio/alphabet/${letter}.wav`;
                const url = getVersionedAudioUrl(path);
                assets.push({ type: 'audio', key: `audio-${letter}`, url: url, label: `Звук "${letter.toUpperCase()}"` });
            });

            const total = assets.length;
            let loadedCount = 0;
            let preloadedFinished = false;

            const updateProgress = () => {
                if (preloadedFinished) return;
                loadedCount++;
                const percentage = Math.round((loadedCount / total) * 100);
                if (loaderProgress) loaderProgress.style.width = `${percentage}%`;
                if (loaderPercent) loaderPercent.textContent = `${percentage}%`;
            };

            const loadAsset = async (asset) => {
                if (preloadedFinished) return;
                try {
                    if (asset.key === 'words') {
                        if (loaderStep1) loaderStep1.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-emerald-500 mr-3 text-base"></i>Загрузка слов...';
                        const res = await fetch(asset.url);
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        WORDS = await res.json();
                        if (loaderStep1) loaderStep1.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-500 mr-3 text-base"></i>Словарь и перевод загружены';
                        const loadingEl = document.getElementById('words-loading');
                        if (loadingEl) loadingEl.style.display = 'none';
                    } else if (asset.key === 'grammar') {
                        if (loaderStep2) loaderStep2.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-emerald-500 mr-3 text-base"></i>Загрузка грамматики...';
                        const res = await fetch(asset.url);
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        GRAMMAR = await res.json();
                        if (loaderStep2) loaderStep2.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-500 mr-3 text-base"></i>Грамматический справочник загружен';
                    } else if (asset.type === 'audio') {
                        if (loaderStatus) loaderStatus.textContent = `Загрузка: ${asset.label}...`;
                        const res = await fetch(asset.url);
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        await res.arrayBuffer();
                    }
                } catch (e) {
                    warn(`[Preloader] Failed to load asset: ${asset.url}`, e);
                    if (asset.key === 'words') {
                        if (loaderStep1) loaderStep1.innerHTML = '<i class="fa-solid fa-circle-exclamation text-red-500 mr-3 text-base"></i>Словарь не загрузился';
                    } else if (asset.key === 'grammar') {
                        if (loaderStep2) loaderStep2.innerHTML = '<i class="fa-solid fa-circle-exclamation text-amber-500 mr-3 text-base"></i>Грамматика временно недоступна';
                    }
                } finally {
                    updateProgress();
                }
            };

            // Set up UI indicators at startup
            if (loaderStep3) loaderStep3.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-emerald-500 mr-3 text-base"></i>Подготовка озвучки...';

            // Execution queue with concurrency 6
            const queue = [...assets];
            const activePromises = [];
            const concurrency = 6;

            const next = async () => {
                if (queue.length === 0 || preloadedFinished) return;
                const asset = queue.shift();

                // Show a clean audio progress check halfway
                if (asset.type === 'audio' && loaderStep3) {
                    const audioLoaded = loadedCount - 2; // Subtract words and grammar
                    const audioTotal = ALPHABET_AUDIO_FILES.length;
                    loaderStep3.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-emerald-500 mr-3 text-base"></i>Озвучка букв: ${Math.max(0, audioLoaded)}/${audioTotal}`;
                }

                await loadAsset(asset);
                return next();
            };

            const enterApp = () => {
                if (preloadedFinished) return;
                preloadedFinished = true;

                // Handle missing words/grammar gracefully (e.g. if skipped early or failed)
                if (!WORDS || WORDS.length === 0) {
                    showFatalLoadError('Не удалось загрузить словарь. Проверьте подключение или очистите кэш приложения.');
                    hideLoader();
                    return;
                }
                if (!Array.isArray(GRAMMAR)) GRAMMAR = [];
                rebuildSearchIndex();

                // Render everything
                buildCategoryOptions();
                refreshCategoryCounters();
                syncSelectedCategoryUI();
                updatePracticeAvailability();
                updateVocabStats();
                renderAlphabet();
                renderWords();
                initSearchBehavior();
                updateStatsUI();

                const alphabetCountEl = document.getElementById('alphabet-count');
                if (alphabetCountEl) alphabetCountEl.textContent = ALPHABET.length;

                const practiceGrammarView = document.getElementById('practice-grammar-view');
                if (practiceGrammarView && !practiceGrammarView.classList.contains('hidden')) {
                    renderGrammar();
                }

                hideLoader();
            };

            if (skipBtn) {
                skipBtn.addEventListener('click', enterApp);
            }

            // Start worker queue
            for (let i = 0; i < Math.min(concurrency, assets.length); i++) {
                activePromises.push(next());
            }
            await Promise.all(activePromises);

            if (preloadedFinished) return;

            // Finalizing UI
            if (loaderStep3) loaderStep3.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-500 mr-3 text-base"></i>Все файлы озвучки кэшированы';
            if (loaderStatus) loaderStatus.textContent = 'Готово к запуску!';
            if (loaderProgress) loaderProgress.style.width = '100%';
            if (loaderPercent) loaderPercent.textContent = '100%';

            // Smooth transition into the app
            setTimeout(() => {
                enterApp();
            }, 600);
        }

        // Init everything
        function init() {
            // Prevent desktop zooming
            document.addEventListener('wheel', function(e) {
                if (e.ctrlKey) {
                    e.preventDefault();
                }
            }, { passive: false });

            document.addEventListener('keydown', function(e) {
                if (e.ctrlKey && (e.key === '=' || e.key === '-' || e.key === '0' || e.key === '+' || e.code === 'NumpadAdd' || e.code === 'NumpadSubtract')) {
                    e.preventDefault();
                }
            });

            registerSW();

            // Tabs
            document.querySelectorAll('[data-tab]').forEach(btn => {
                btn.addEventListener('click', () => switchTab(btn.dataset.tab));
            });

            // Search
            const sc = document.getElementById('search-clear');
            if (sc) sc.addEventListener('click', () => {
                const i = document.getElementById('search-input');
                i.value = '';
                i.dispatchEvent(new Event('input'));
            });

            // Dropdowns
            document.getElementById('category-filter-trigger')?.addEventListener('click', () => toggleDropdown('category-filter-wrapper'));
            document.getElementById('practice-category-trigger')?.addEventListener('click', () => toggleDropdown('practice-category-wrapper'));

            // Practice modes
            document.getElementById('prac-mode-grammar')?.addEventListener('click', showGrammarList);
            document.getElementById('grammar-back-btn')?.addEventListener('click', hideGrammarList);

            document.getElementById('prac-mode-flashcards')?.addEventListener('click', startFlashcards);
            document.getElementById('prac-mode-quiz')?.addEventListener('click', startQuiz);
            document.getElementById('prac-mode-pairs')?.addEventListener('click', startPairs);
            document.getElementById('prac-mode-odd')?.addEventListener('click', startOddWord);
            document.getElementById('prac-mode-srs')?.addEventListener('click', startFlashcards); // SRS mode also uses flashcards

            // Modals backdrops
            document.getElementById('word-modal')?.addEventListener('click', (e) => { if (e.target.id === 'word-modal') closeModal(); });
            document.getElementById('practice-modal')?.addEventListener('click', (e) => { if (e.target.id === 'practice-modal') endPractice(); });
            document.addEventListener('click', (e) => {
                const trigger = e.target.closest('button, [role="button"], a, input, textarea, select');
                if (trigger) lastDialogTrigger = trigger;
            }, true);

            // Notif banner
            document.getElementById('notif-banner-actions')?.addEventListener('click', (e) => {
                const a = e.target.dataset.action;
                if (a === 'enable') requestNotificationPermission();
                if (a === 'dismiss') dismissNotifBanner();
            });
            document.getElementById('notif-card')?.addEventListener('click', toggleNotifications);
            document.getElementById('update-check-row')?.addEventListener('click', checkForUpdates);

            // Progress management
            document.getElementById('export-btn')?.addEventListener('click', exportProgress);
            document.getElementById('import-input')?.addEventListener('change', (e) => importProgress(e.target.files[0]));
            document.getElementById('add-to-home-btn')?.addEventListener('click', showInstallInstructions);
            document.getElementById('theme-toggle-card')?.addEventListener('click', toggleTheme);

            // Initial data load and UI render
            initTheme();
            loadProgress();
            startPreloading();

            updateNotifUI();
            initKeyboard();
            const alphabetCountEl = document.getElementById('alphabet-count');
            if (alphabetCountEl) alphabetCountEl.textContent = ALPHABET.length; // Динамически устанавливаем количество букв

            // Handle initial tab and hash changes
            const hash = window.location.hash.replace('#', '');
            if (VALID_TABS.includes(hash)) switchTab(hash);
            else switchTab('alphabet');


            window.addEventListener('hashchange', () => {
                if (tabSwitchGuard) return;
                const h = window.location.hash.replace('#', '');
                if (h && VALID_TABS.includes(h)) switchTab(h);
            });
        }

        // Keyboard shortcuts
        function initKeyboard() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const wordModal = document.getElementById('word-modal');
                    const practiceModal = document.getElementById('practice-modal');
                    if (isElementVisible(wordModal)) {
                        e.preventDefault();
                        closeModal();
                        return;
                    }
                    if (isElementVisible(practiceModal)) {
                        e.preventDefault();
                        endPractice();
                        return;
                    }
                }

                if ((e.metaKey || e.ctrlKey) && e.key === '/') {
                    e.preventDefault();
                    switchTab('vocabulary');
                    setTimeout(() => document.getElementById('search-input')?.focus(), 300);
                }
            });
        }


        document.addEventListener('DOMContentLoaded', init);