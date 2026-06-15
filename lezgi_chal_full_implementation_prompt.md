# Мастер-промпт для полной реализации Lezgi Ch'al

Назначение: этот файл можно дать AI-агенту, разработчику или использовать в Cursor/Codex/Claude как полное техническо-методическое задание на реализацию PWA для изучения лезгинского языка.

Дата: 2026-06-07

## Как использовать

Скопируй блок из раздела "Полный промпт" целиком в AI-агента. Перед запуском убедись, что в репозитории есть эти документы:

- `md/lezgi_chal_adaptive_learning_system.md`
- `md/language_learning_research_library.md`
- `md/lezgi_chal_full_implementation_prompt.md`

AI-агент должен сначала прочитать эти файлы и только потом менять код.

---

# Полный промпт

Ты — senior full-stack engineer, EdTech product architect, UX/UI-дизайнер образовательных продуктов и методист-лингвист. Твоя задача — реализовать PWA `Lezgi Ch'al` для изучения лезгинского языка с нуля.

Работай не как генератор случайных экранов, а как инженер образовательной системы. Продукт должен опираться на научно обоснованные принципы: spaced repetition, active recall, retrieval practice, desirable difficulties, interleaving, communicative/task-based learning, phonetic training, can-do progress, адаптивная диагностика ошибок.

## 0. Главные документы проекта

Перед любыми изменениями прочитай:

1. `md/lezgi_chal_adaptive_learning_system.md`
2. `md/language_learning_research_library.md`

Считай их методической и исследовательской базой проекта.

Если реализация противоречит этим документам, сначала объясни противоречие и предложи корректный вариант.

## 1. Нельзя делать

Не делай следующие ошибки:

1. Не превращай приложение в обычный словарь.
2. Не начинай путь пользователя с полной таблицы алфавита, падежей или грамматики.
3. Не делай геймификацию важнее реального обучения.
4. Не используй только multiple choice.
5. Не считай "прошел урок" доказательством знания.
6. Не выдумывай лезгинские слова, формы, падежи, произношение или примеры как проверенные.
7. Не смешивай литературную норму, диалекты и разговорные варианты без маркировки.
8. Не делай длинные уроки на 20-30 минут.
9. Не добавляй AI-чат как центральную функцию до того, как есть SRS, аудио, уроки и прогресс.
10. Не ломай существующую архитектуру проекта без необходимости.

## 2. Главная цель MVP

Создать рабочий PWA, где нулевой пользователь может:

- открыть главный экран "Сегодня";
- пройти первые короткие уроки;
- услышать аудио;
- повторить слова/фразы по SRS;
- видеть can-do прогресс;
- открыть словарь;
- тренировать слух;
- получать понятную обратную связь по ошибкам.

Главная метрика продукта:

> Пользователь может выполнить реальный коммуникативный сценарий без подсказки.

Не оптимизируй MVP под "много контента". Оптимизируй под правильную учебную петлю.

## 3. Сначала провести аудит репозитория

Перед реализацией:

1. Определи стек:
   - frontend framework;
   - backend, если есть;
   - storage;
   - routing;
   - styling;
   - test setup;
   - PWA setup.

2. Найди существующие модули:
   - dictionary;
   - practice;
   - lessons;
   - user progress;
   - audio;
   - data/content.

3. Составь короткий план интеграции:
   - что переиспользовать;
   - что добавить;
   - что не трогать;
   - где хранить учебные данные;
   - как не сломать текущий UI.

4. Если в проекте уже есть стилистика, следуй ей. Если нет — создай спокойный, современный, утилитарный интерфейс образовательного продукта.

## 4. Информационная архитектура приложения

Нужны разделы:

1. `Сегодня`
   - следующая миссия;
   - due-повторения;
   - короткая тренировка слуха;
   - can-do прогресс.

2. `Путь`
   - модули и уроки;
   - статус: locked / available / in progress / completed / review due;
   - уровни A0, A1.1, A1.2.

3. `Повторение`
   - очередь SRS;
   - фильтры: слова, фразы, грамматика, звуки;
   - короткие сессии 3-5 минут.

4. `Слух`
   - фонетические контрасты;
   - listen-select;
   - same/different;
   - shadowing.

5. `Словарь`
   - поиск;
   - карточка слова;
   - аудио;
   - примеры;
   - статус освоения;
   - кнопка "тренировать".

6. `Справочник`
   - алфавит;
   - звуки;
   - базовые падежные роли;
   - эргативность;
   - локативная карта;
   - пометка: справочник не является стартом курса.

7. `Профиль`
   - streak;
   - can-do skills;
   - слабые места;
   - настройки.

## 5. Учебная модель данных

Реализуй или подготовь следующие сущности. Если в проекте уже есть аналогичные сущности, адаптируй их.

### 5.1. `LearningItem`

Единица обучения.

Типы:

- `word`
- `phrase`
- `grammar_pattern`
- `phonetic_contrast`
- `dialogue`
- `letter`
- `morphology_form`

Минимальная структура:

```ts
type LearningItemType =
  | "word"
  | "phrase"
  | "grammar_pattern"
  | "phonetic_contrast"
  | "dialogue"
  | "letter"
  | "morphology_form";

type LearningItem = {
  id: string;
  type: LearningItemType;
  level: "A0" | "A1.1" | "A1.2" | "A2";
  titleRu: string;
  textLezgi?: string;
  textRu?: string;
  literalRu?: string;
  audioIds: string[];
  lessonIds: string[];
  tags: string[];
  grammarTags: string[];
  phoneticTags: string[];
  frequencyRank?: number;
  prerequisites: string[];
  nativeVerified: boolean;
  reviewPriority: number;
  notes?: string;
};
```

Правило: если лезгинский текст не проверен носителем, `nativeVerified` должен быть `false`, а UI/данные не должны выдавать его как окончательно правильный учебный материал.

### 5.2. `Lesson`

```ts
type Lesson = {
  id: string;
  moduleId: string;
  level: "A0" | "A1.1" | "A1.2" | "A2";
  order: number;
  title: string;
  canDo: string[];
  estimatedMinutes: number;
  newItemIds: string[];
  reviewItemIds: string[];
  exerciseIds: string[];
  focus: {
    communication?: string;
    grammar?: string[];
    phonetics?: string[];
  };
  status?: "locked" | "available" | "in_progress" | "completed";
};
```

### 5.3. `Exercise`

```ts
type ExerciseType =
  | "listen_select"
  | "same_different_audio"
  | "meaning_choice"
  | "phrase_builder"
  | "type_answer"
  | "repeat_after_audio"
  | "morphology_tiles"
  | "case_role_select"
  | "mini_dialogue"
  | "active_recall_card";

type Exercise = {
  id: string;
  type: ExerciseType;
  itemIds: string[];
  promptRu: string;
  audioId?: string;
  options?: string[];
  correctAnswer?: string | string[];
  tiles?: string[];
  acceptedAnswers?: string[];
  hints?: string[];
  explanationRu?: string;
  errorTagsOnFail: ErrorTag[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  requiresNativeVerifiedContent: boolean;
};
```

### 5.4. `UserItemProgress`

```ts
type UserItemProgress = {
  userId: string;
  itemId: string;
  seenCount: number;
  correctCount: number;
  incorrectCount: number;
  lastSeenAt?: string;
  nextReviewAt?: string;
  stability: number;
  difficulty: number;
  mastery: number;
  lastModes: ExerciseType[];
  errorTags: ErrorTag[];
  avgLatencyMs?: number;
};
```

### 5.5. `Attempt`

```ts
type ErrorTag =
  | "phonetic_confusion"
  | "word_order"
  | "case_ergative"
  | "case_dative"
  | "case_genitive"
  | "case_locative"
  | "listening_missed_word"
  | "spelling"
  | "translation_direction"
  | "forgotten_word"
  | "too_slow"
  | "unknown";

type Attempt = {
  id: string;
  userId: string;
  exerciseId: string;
  itemIds: string[];
  exerciseType: ExerciseType;
  isCorrect: boolean;
  userAnswer?: string;
  latencyMs: number;
  hintUsed: boolean;
  attemptNumber: number;
  errorTags: ErrorTag[];
  createdAt: string;
};
```

### 5.6. `AudioAsset`

```ts
type AudioAsset = {
  id: string;
  src: string;
  itemId: string;
  speakerId: string;
  speed: "slow" | "normal" | "natural";
  nativeVerified: boolean;
  transcript?: string;
};
```

### 5.7. `Speaker`

```ts
type Speaker = {
  id: string;
  displayName?: string;
  gender?: "female" | "male" | "other" | "unknown";
  ageGroup?: "child" | "teen" | "adult" | "elder";
  dialect?: string;
  notes?: string;
};
```

## 6. SRS и адаптивность

Реализуй базовый SRS для MVP. Не нужно сразу делать сложную ML-модель.

### 6.1. Интервалы MVP

Правила:

- ошибка: повторить через 1-5 минут;
- повторная ошибка: упростить задание и повторить в конце сессии;
- правильно с подсказкой: через 12-24 часа;
- правильно без подсказки: через 2-3 дня;
- уверенно после 3 дней: через 7 дней;
- уверенно после 7 дней: через 14-21 день;
- уверенно после 21 дня: через 45-60 дней.

### 6.2. Mastery score

Сделай функцию:

```ts
function calculateMastery(input: {
  recallAccuracy: number;
  intervalSuccess: number;
  productionSuccess: number;
  listeningSuccess: number;
  speedScore: number;
  transferSuccess: number;
}): number {
  return (
    0.35 * input.recallAccuracy +
    0.20 * input.intervalSuccess +
    0.15 * input.productionSuccess +
    0.10 * input.listeningSuccess +
    0.10 * input.speedScore +
    0.10 * input.transferSuccess
  );
}
```

Адаптируй к языку проекта, если TypeScript не используется.

### 6.3. Выбор следующего упражнения

Реализуй score-based selection:

```text
score(item) =
  due_weight
+ error_weight
+ curriculum_weight
+ forgetting_risk
+ diversity_bonus
- fatigue_penalty
```

Требования:

- due items всегда важнее новых;
- повторяющиеся ошибки должны возвращать related practice;
- грамматическая ошибка возвращает grammar pattern;
- фонетическая ошибка возвращает phonetic contrast;
- не давать один тип упражнения слишком много раз подряд.

### 6.4. Целевая сложность

Поддерживать 70-85% правильных ответов.

Если точность сессии ниже 60%:

- уменьшить сложность;
- вернуть подсказки;
- переключиться с production на recognition;
- повторить материал раньше.

Если точность выше 90%:

- убрать подсказки;
- добавить typing/speaking;
- увеличить интервал;
- смешать с другим паттерном.

## 7. Упражнения

Реализуй общий exercise engine, чтобы новые типы упражнений добавлялись данными, а не копированием логики.

### 7.1. `listen_select`

Пользователь слышит аудио и выбирает правильный вариант.

Нужно:

- кнопка replay;
- режим slow/normal, если есть;
- feedback;
- запись попытки.

### 7.2. `same_different_audio`

Пользователь слышит два аудио и выбирает "одинаково" или "разное".

Нужно для фонетики.

### 7.3. `meaning_choice`

Пользователь выбирает значение слова/фразы.

Использовать как легкий режим, не как основной.

### 7.4. `phrase_builder`

Пользователь собирает фразу из плиток.

Нужно:

- стабильная сетка;
- плитки не должны менять layout;
- feedback по порядку/лишним словам.

### 7.5. `type_answer`

Пользователь вводит ответ.

Нужно:

- accepted answers;
- мягкая проверка пробелов/регистра;
- объяснение ошибки.

### 7.6. `repeat_after_audio`

Пользователь слушает и повторяет.

MVP:

- запись голоса, если доступно в браузере;
- playback пользовательской записи;
- кнопка "записать снова";
- без ложной автоматической оценки, если нет надежной модели.

### 7.7. `morphology_tiles`

Пользователь собирает форму из основы и суффикса/частей.

Нужно:

- визуально разделить основу и грамматический элемент;
- подсказка "кому?", "кто сделал?", "где?", "куда?";
- explanation after answer.

### 7.8. `case_role_select`

Пользователь выбирает роль слова в фразе:

- кто делает;
- что/кого;
- кому/куда;
- чей;
- где;
- откуда.

Важно: для новичка использовать роли, а термины "эргатив/датив" раскрывать постепенно.

### 7.9. `mini_dialogue`

Короткий сценарий из 3-7 реплик.

Нужно:

- цель;
- реплики приложения;
- ответ пользователя;
- итог: "Теперь ты можешь ...".

### 7.10. `active_recall_card`

Показывает prompt, затем пользователь пытается вспомнить до раскрытия ответа.

Нужно:

- кнопки "вспомнил", "почти", "не вспомнил";
- nextReviewAt обновляется по самооценке и/или ответу.

## 8. Первый учебный путь

Создай структуру первых 10 уроков A0. Если нет проверенного лезгинского контента, используй placeholder-объекты с `nativeVerified: false` и понятными ID. Не выдавай placeholder как окончательный контент.

Уроки:

1. Приветствие.
2. Я не понимаю.
3. Вежливость.
4. Семья.
5. Еда и вода.
6. Где.
7. Куда.
8. Простые действия.
9. Кто что сделал.
10. Первый разговор.

Каждый урок:

- 5-8 минут;
- 3-5 новых единиц;
- хотя бы 1 аудио-задание;
- хотя бы 1 active recall;
- хотя бы 1 production task;
- новые элементы попадают в SRS.

## 9. Словарь

Реализуй dictionary view.

Карточка слова/фразы должна показывать:

- лезгинский текст;
- русский перевод;
- буквальный перевод, если есть;
- аудио;
- часть речи/тип;
- уровень;
- теги;
- примеры;
- грамматические формы, если есть;
- статус освоения;
- `nativeVerified` badge;
- кнопка "тренировать".

Если контент не проверен:

- показать "требует проверки носителем" в dev/admin режиме;
- для обычного пользователя лучше не показывать непроверенный контент как учебный, если продукт уже публичный.

## 10. Справочник

Справочник должен быть доступен, но не заменять курс.

Разделы:

1. Алфавит и звуки.
2. Как тренировать слух.
3. Роли в предложении.
4. Абсолютив, эргатив, датив, генитив.
5. Пространственные значения.
6. Почему лезгинский не обязан быть похожим на русский.

Пиши объяснения коротко и через примеры.

Не показывай новичку огромную таблицу без контекста.

## 11. UX/UI требования

Стиль:

- спокойный;
- современный;
- образовательный;
- не детский, если приложение ориентировано на взрослых;
- поддерживает быстрые сессии с телефона.

Главный экран:

- первая кнопка: "Продолжить";
- вторая зона: "Повторить сегодня";
- третья зона: "Слух";
- четвертая зона: can-do прогресс.

Компоненты:

- кнопки крупные, удобные для touch;
- аудио-кнопка с иконкой;
- progress без визуального шума;
- не использовать карточки внутри карточек;
- не перегружать экран текстом;
- все состояния: loading, empty, error, completed.

Accessibility:

- keyboard navigation;
- focus states;
- ARIA для audio controls и interactive exercises;
- достаточный contrast;
- не полагаться только на цвет для правильности/ошибки.

Responsive:

- mobile-first;
- desktop layout не должен быть растянутой мобильной колонкой;
- lesson player должен быть удобен на 360px ширины.

## 12. PWA требования

Если проект уже PWA — проверь и дополни. Если нет — добавь:

- manifest;
- service worker или framework-native PWA setup;
- installable app;
- offline shell;
- cached static assets;
- graceful offline state;
- local progress storage, если backend отсутствует.

MVP может быть local-first.

Если есть backend/auth:

- сохраняй прогресс на сервер;
- синхронизацию делать осторожно;
- offline queue для attempts можно оставить на следующий этап.

## 13. Аналитика

Даже без внешнего аналитического сервиса реализуй внутренний event log abstraction.

События:

- `lesson_started`
- `lesson_completed`
- `exercise_started`
- `exercise_answered`
- `answer_correct`
- `answer_incorrect`
- `hint_used`
- `audio_played`
- `audio_replayed`
- `speech_recorded`
- `review_scheduled`
- `review_completed`
- `item_mastery_changed`
- `error_tag_added`
- `session_ended`

Сделай функцию `trackEvent(event)` или аналог.

В MVP можно писать в local storage / IndexedDB / console in dev.

## 14. Контент и seed data

Создай структуру данных так, чтобы контент можно было редактировать отдельно от компонентов.

Предпочтительно:

- `src/data/learningItems.*`
- `src/data/lessons.*`
- `src/data/exercises.*`
- `src/data/audioAssets.*`
- или аналогичная папка, если в проекте другая архитектура.

Для placeholder контента:

- использовать явные ID;
- `nativeVerified: false`;
- комментарий/поле `notes: "Placeholder. Requires native speaker review."`.

Не выдумывать много лезгинского текста.

Лучше создать рабочую систему с 3-5 демонстрационными verified-like mock items, чем заполнить курс фальшивым языком.

## 15. Тесты

Покрыть минимум:

1. SRS interval calculation.
2. Mastery calculation.
3. Exercise answer checking.
4. Review queue selection.
5. User progress update after correct/incorrect answer.
6. Rendering empty states.

Если есть Playwright или браузерный тест:

- открыть главный экран;
- пройти один demo lesson;
- ответить на упражнение;
- проверить, что progress обновился;
- открыть review и увидеть due item.

Если тестовой инфраструктуры нет:

- добавить минимальные unit tests, совместимые со стеком;
- или создать отдельный pure module с тестами.

## 16. Реализационные фазы

Не пытайся сделать все хаотично. Выполняй по фазам.

### Фаза 1: Архитектурный фундамент

Сделать:

- типы/модели данных;
- seed content structure;
- progress storage;
- SRS utilities;
- event tracking abstraction.

Acceptance:

- тесты SRS проходят;
- данные уроков и items можно импортировать;
- progress обновляется после attempt.

### Фаза 2: Учебный player

Сделать:

- lesson player;
- exercise renderer;
- 4-5 типов упражнений:
  - listen_select;
  - meaning_choice;
  - phrase_builder;
  - active_recall_card;
  - repeat_after_audio или mock mode.

Acceptance:

- можно пройти демо-урок;
- ошибки записываются;
- nextReviewAt обновляется.

### Фаза 3: Главные экраны

Сделать:

- Today;
- Path;
- Review;
- Dictionary;
- Listening;
- Reference;
- Profile.

Acceptance:

- пользователь видит следующий урок;
- видит due review;
- может открыть словарь;
- может начать слуховую тренировку.

### Фаза 4: Фонетика и грамматика

Сделать:

- phonetic contrast data;
- same/different exercise;
- case role select;
- morphology tiles;
- reference pages for roles/cases.

Acceptance:

- фонетическая ошибка возвращает phonetic practice;
- грамматическая ошибка возвращает related pattern.

### Фаза 5: PWA и polish

Сделать:

- manifest/service worker;
- offline shell;
- responsive QA;
- accessibility pass;
- loading/error states;
- documentation.

Acceptance:

- app installable;
- basic shell works offline;
- mobile viewport usable.

## 17. Приоритеты, если времени мало

P0:

- data models;
- SRS;
- Today screen;
- Lesson player;
- Review session;
- Dictionary card;
- 5 exercise types;
- progress persistence.

P1:

- Listening module;
- Reference;
- morphology/case exercises;
- PWA offline;
- tests.

P2:

- voice recording;
- analytics dashboard;
- multi-speaker audio;
- author/content admin.

P3:

- AI conversation;
- pronunciation scoring;
- social/family mode;
- teacher dashboard.

## 18. Правила по лезгинскому контенту

Контент должен иметь статус:

- `nativeVerified: true` — проверено носителем/редактором;
- `nativeVerified: false` — placeholder или требует проверки.

Если ты не уверен в форме:

- не делай вид, что уверен;
- пометь как placeholder;
- создай техническую структуру;
- оставь TODO для носителя.

Для каждого учебного примера желательно хранить:

- текст;
- перевод;
- буквальный перевод;
- аудио;
- источник или автор;
- проверяющий носитель;
- диалект/норма;
- дата проверки.

## 19. Definition of Done для MVP

MVP готов, если:

1. Пользователь может открыть приложение.
2. Есть главный экран "Сегодня".
3. Есть путь минимум из 10 A0-уроков как структура.
4. Есть минимум один полностью проходимый demo lesson.
5. Есть SRS review queue.
6. Есть progress по learning items.
7. Есть словарь.
8. Есть минимум 5 типов упражнений.
9. Есть понятная обратная связь по ошибкам.
10. Есть сохранение прогресса локально или на сервере.
11. Есть тесты ключевой логики.
12. Есть PWA manifest или задача на его подключение, если стек не позволяет сделать сразу.
13. Непроверенный лезгинский контент не выдается за проверенный.

## 20. Итоговый отчет после реализации

В конце работы напиши:

- какие файлы изменены;
- какие функции добавлены;
- как работает SRS;
- где лежат данные уроков;
- как добавить новый урок;
- какие тесты запускались;
- что осталось проверить с носителем;
- какие риски остались.

## 21. Начинай работу

Теперь:

1. Прочитай проект и документы.
2. Определи стек и текущую архитектуру.
3. Составь краткий план.
4. Реализуй фазу 1.
5. Проверь тестами.
6. Продолжай фазы, пока MVP не будет рабочим.

Не останавливайся на предложении плана, если можешь реализовать. Если встречаешь блокер, сначала попробуй решить его самостоятельно. Если нужен внешний ресурс или контент носителя, явно пометь это как блокер контента, но продолжай техническую реализацию.

---

## Короткий вариант промпта

Если нужен компактный промпт:

```text
Реализуй PWA Lezgi Ch'al по документам md/lezgi_chal_adaptive_learning_system.md и md/language_learning_research_library.md. Сначала аудируй репозиторий и стек. Затем создай учебную архитектуру: LearningItem, Lesson, Exercise, UserItemProgress, Attempt, AudioAsset, SRS, mastery score, review queue, lesson player, Today screen, Path, Review, Listening, Dictionary, Reference, Profile. Сохраняй прогресс, записывай ошибки с error tags, не выдавай непроверенный лезгинский контент за проверенный. Сделай 10 A0 уроков как структуру, минимум один полностью проходимый demo lesson, 5 типов упражнений, тесты SRS/progress/exercise checking и PWA baseline. Следуй принципам active recall, spaced repetition, interleaving, phonetic training, can-do progress. После реализации отчитайся по файлам, тестам, рискам и TODO для носителя.
```

## Дополнительный промпт для создания контента

Использовать только после технической реализации.

```text
Создай контент-план для первых 10 уроков A0 Lezgi Ch'al. Не выдумывай непроверенные лезгинские формы. Для каждого урока укажи can-do цель, русские фразы-заготовки, типы упражнений, нужные learning items, аудио, грамматические/фонетические теги и список того, что должен проверить носитель. Все непроверенные формы помечай nativeVerified: false.
```

## Дополнительный промпт для носителя/редактора

```text
Проверь учебный контент Lezgi Ch'al. Для каждой фразы укажи: корректна ли форма, литературная норма или диалект, естественность для живой речи, буквальный перевод, возможные варианты, произношение, ударение/сложные звуки, можно ли использовать в уроке для новичков. Не исправляй только орфографию; оцени естественность и педагогическую пригодность.
```

