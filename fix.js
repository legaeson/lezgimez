const fs = require('fs');

let content = fs.readFileSync('index.html', 'utf8');

const startMatch = '        // ---- CLASSIFYING ----';
const endMatch = '        // ==================== COURSE RESULTS ====================';

const startIndex = content.indexOf(startMatch);
const endIndex = content.indexOf(endMatch);

if (startIndex === -1 || endIndex === -1) {
  console.error('Match not found', startIndex, endIndex);
  process.exit(1);
}

const newCode = `        // ---- CLASSIFYING ----
        function renderCourseClassifying(body, ex) {
            const wrap = document.createElement('div');
            wrap.className = 'flex flex-col h-full justify-between';

            const topSection = document.createElement('div');
            
            const prompt = document.createElement('div');
            prompt.className = 'text-lg font-bold text-slate-800 mb-6 text-center px-4';
            prompt.textContent = ex.prompt || 'К какой категории относится?';
            topSection.appendChild(prompt);

            const shuffledItems = shuffle([...ex.items]);
            let currentIndex = 0;
            let madeMistake = false;

            const itemContainer = document.createElement('div');
            itemContainer.className = 'flex justify-center items-center py-8 mb-6 px-4';
            topSection.appendChild(itemContainer);

            wrap.appendChild(topSection);

            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'flex flex-col gap-3 pb-4 px-4';
            wrap.appendChild(buttonsContainer);

            function renderCurrentItem() {
                itemContainer.innerHTML = '';
                buttonsContainer.innerHTML = '';

                if (currentIndex >= shuffledItems.length) {
                    const doneMsg = document.createElement('div');
                    doneMsg.className = 'text-2xl font-bold text-emerald-600 animate-bounce text-center';
                    doneMsg.textContent = 'Отлично!';
                    itemContainer.appendChild(doneMsg);
                    setTimeout(() => courseNextExercise(!madeMistake), 1000);
                    return;
                }

                const item = shuffledItems[currentIndex];

                const card = document.createElement('div');
                card.className = 'px-8 py-10 bg-white border-2 border-slate-200 rounded-3xl text-2xl font-bold text-slate-800 shadow-sm text-center w-full max-w-sm';
                card.textContent = item.text;
                itemContainer.appendChild(card);

                ex.categories.forEach((cat, ci) => {
                    const btn = document.createElement('button');
                    btn.className = 'w-full py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-700 active:scale-95 transition-all shadow-sm';
                    btn.textContent = cat;
                    btn.addEventListener('click', () => {
                        const allBtns = buttonsContainer.querySelectorAll('button');
                        allBtns.forEach(b => b.disabled = true);

                        if (item.category === ci) {
                            btn.className = 'w-full py-4 bg-emerald-500 border-2 border-emerald-600 rounded-2xl text-base font-bold text-white transition-all shadow-sm';
                            card.className = 'px-8 py-10 bg-emerald-50 border-2 border-emerald-300 rounded-3xl text-2xl font-bold text-emerald-700 shadow-sm transition-all scale-105 text-center w-full max-w-sm';
                            
                            setTimeout(() => {
                                currentIndex++;
                                renderCurrentItem();
                            }, 600);
                        } else {
                            madeMistake = true;
                            btn.className = 'w-full py-4 bg-red-500 border-2 border-red-600 rounded-2xl text-base font-bold text-white animate-shake transition-all shadow-sm';
                            card.className = 'px-8 py-10 bg-red-50 border-2 border-red-300 rounded-3xl text-2xl font-bold text-red-700 shadow-sm transition-all text-center w-full max-w-sm animate-shake';
                            
                            setTimeout(() => {
                                allBtns.forEach(b => b.disabled = false);
                                btn.className = 'w-full py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-700 active:scale-95 transition-all shadow-sm';
                                card.className = 'px-8 py-10 bg-white border-2 border-slate-200 rounded-3xl text-2xl font-bold text-slate-800 shadow-sm text-center w-full max-w-sm';
                            }, 800);
                        }
                    });
                    buttonsContainer.appendChild(btn);
                });
                
                const progressText = document.createElement('div');
                progressText.className = 'text-sm font-semibold text-slate-400 text-center mt-4 mb-2';
                progressText.textContent = \`\${currentIndex + 1} / \${shuffledItems.length}\`;
                buttonsContainer.appendChild(progressText);
            }

            renderCurrentItem();
            body.appendChild(wrap);
        }

`;

content = content.substring(0, startIndex) + newCode + content.substring(endIndex);
fs.writeFileSync('index.html', content);
console.log('Replacement successful!');
