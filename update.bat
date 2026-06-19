@echo off
chcp 65001 > nul
echo ==================================================
echo   LezgiMez — Обновление и сборка проекта
echo ==================================================
echo.

echo [1/4] Слияние учебных модулей...
node merge_modules.cjs
if %errorlevel% neq 0 (
    echo.
    echo ❌ ОШИБКА при слиянии модулей! Процесс остановлен.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/4] Запуск автоматических тестов и валидации слов...
call npm test
if %errorlevel% neq 0 (
    echo.
    echo ❌ ОШИБКА: Тесты не пройдены! Пожалуйста, исправьте ошибки перед коммитом.
    pause
    exit /b %errorlevel%
)

echo.
echo [3/4] Создание продакшн-сборки (экспорт в папку dist)...
call npm run export
if %errorlevel% neq 0 (
    echo.
    echo ❌ ОШИБКА экспорта проекта!
    pause
    exit /b %errorlevel%
)

echo.
echo [4/4] Отправка изменений в Git-репозиторий...
git add -A

echo Введите комментарий к изменениям (commit message) [или нажмите Enter для значения по умолчанию]:
set /p commit_msg="> "
if "%commit_msg%"=="" (
    set commit_msg="Обновление контента и сборки проекта"
)

git commit -m "%commit_msg%"
if %errorlevel% neq 0 (
    echo.
    echo ℹ️ Нет изменений для фиксации в Git.
) else (
    echo Отправка изменений на GitHub...
    git push origin main
    if %errorlevel% neq 0 (
        echo.
        echo ❌ ОШИБКА: Не удалось отправить изменения на GitHub! Проверьте подключение к интернету.
        pause
        exit /b %errorlevel%
    )
)

echo.
echo ==================================================
echo ✅ Проект успешно обновлен, собран и отправлен на GitHub!
echo ==================================================
pause
