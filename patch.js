const fs = require('fs');
let html = fs.readFileSync('public/admin.html', 'utf8');

// Remover a lógica antiga baseada em speechSynthesis para evitar bloqueio e delay na fila global do navegador
const regexSocketOn = /socket\.on\('character:speak', \(data\) => \{[\s\S]*?\}\);\s*socket\.on\('character:stop', \(\) => \{[\s\S]*?\}\);/g;

const newSocketLogic = `
        socket.on('character:speak', (data) => {
            if (window.currentAdminTtsTimer) clearInterval(window.currentAdminTtsTimer);
            if (currentTtsAudio) { currentTtsAudio.pause(); currentTtsAudio = null; }

            if (data.imageUrl) { ttsImg.src = data.imageUrl; } 
            else { ttsImg.src = "https://cdn-icons-png.flaticon.com/512/4712/4712010.png"; }

            ttsContainer.style.left = ''; ttsContainer.style.right = ''; ttsContainer.style.top = ''; ttsContainer.style.bottom = ''; ttsContainer.style.transform = '';
            
            if (data.subtitleColor) {
                document.documentElement.style.setProperty('--tts-active-color', data.subtitleColor);
            }

            if (data.position === 'left') {
                ttsContainer.style.setProperty('--tts-hidden-top', 'auto'); ttsContainer.style.setProperty('--tts-hidden-bottom', '-400px'); ttsContainer.style.setProperty('--tts-hidden-left', '20px'); ttsContainer.style.setProperty('--tts-hidden-right', 'auto'); ttsContainer.style.setProperty('--tts-hidden-transform', 'none');
                ttsContainer.style.setProperty('--tts-show-top', 'auto'); ttsContainer.style.setProperty('--tts-show-bottom', '20px'); ttsContainer.style.setProperty('--tts-show-left', '20px'); ttsContainer.style.setProperty('--tts-show-right', 'auto'); ttsContainer.style.setProperty('--tts-show-transform', 'none');
                ttsImg.style.transform = 'scaleX(-1)';
            } else if (data.position === 'custom') {
                const cx = data.customX !== undefined ? data.customX : 80;
                const cy = data.customY !== undefined ? data.customY : 80;
                ttsContainer.style.setProperty('--tts-hidden-top', '150%'); ttsContainer.style.setProperty('--tts-hidden-bottom', 'auto'); ttsContainer.style.setProperty('--tts-hidden-left', cx + '%'); ttsContainer.style.setProperty('--tts-hidden-right', 'auto'); ttsContainer.style.setProperty('--tts-hidden-transform', 'translate(-50%, -50%)');
                ttsContainer.style.setProperty('--tts-show-top', cy + '%'); ttsContainer.style.setProperty('--tts-show-bottom', 'auto'); ttsContainer.style.setProperty('--tts-show-left', cx + '%'); ttsContainer.style.setProperty('--tts-show-right', 'auto'); ttsContainer.style.setProperty('--tts-show-transform', 'translate(-50%, -50%)');
                ttsImg.style.transform = data.customFlip ? 'scaleX(-1)' : 'scaleX(1)';
            } else {
                ttsContainer.style.setProperty('--tts-hidden-top', 'auto'); ttsContainer.style.setProperty('--tts-hidden-bottom', '-400px'); ttsContainer.style.setProperty('--tts-hidden-left', 'auto'); ttsContainer.style.setProperty('--tts-hidden-right', '20px'); ttsContainer.style.setProperty('--tts-hidden-transform', 'none');
                ttsContainer.style.setProperty('--tts-show-top', 'auto'); ttsContainer.style.setProperty('--tts-show-bottom', '20px'); ttsContainer.style.setProperty('--tts-show-left', 'auto'); ttsContainer.style.setProperty('--tts-show-right', '20px'); ttsContainer.style.setProperty('--tts-show-transform', 'none');
                ttsImg.style.transform = 'scaleX(1)';
            }

            ttsContainer.classList.add('show');

            const hasText = !!data.text;
            const hasAudio = !!data.audioUrl;
            const behavior = data.audioBehavior || 'simultaneous';

            const hideCharacter = () => {
                ttsContainer.classList.remove('show');
                ttsSubtitle.innerHTML = '';
            };

            const speakText = (onFinish) => {
                if (!hasText) { if (onFinish) onFinish(); return; }
                
                const regex = /\\S+/g; let match; const words = [];
                while ((match = regex.exec(data.text)) !== null) { words.push({ text: match[0], startIndex: match.index }); }

                let currentWordIndex = -1; let currentChunkStartIndex = -1;
                
                window.currentAdminTtsTimer = setInterval(() => {
                    currentWordIndex++;
                    if (currentWordIndex >= words.length) {
                        clearInterval(window.currentAdminTtsTimer);
                        setTimeout(() => {
                            ttsSubtitle.innerHTML = '';
                            if (onFinish) onFinish();
                        }, 500);
                        return;
                    }

                    const chunkStartIndex = Math.floor(currentWordIndex / 3) * 3;
                    if (chunkStartIndex !== currentChunkStartIndex) {
                        currentChunkStartIndex = chunkStartIndex;
                        ttsSubtitle.innerHTML = '';
                        for (let i = chunkStartIndex; i < chunkStartIndex + 3 && i < words.length; i++) {
                            const span = document.createElement('span');
                            span.innerText = words[i].text + ' '; span.id = 'tts-admin-word-' + i; span.className = 'tts-word-hidden';
                            ttsSubtitle.appendChild(span);
                        }
                    }
                    for (let i = chunkStartIndex; i < chunkStartIndex + 3 && i < words.length; i++) {
                        const span = document.getElementById('tts-admin-word-' + i);
                        if (span) {
                            if (i < currentWordIndex) span.className = 'tts-word-visible';
                            else if (i === currentWordIndex) span.className = 'tts-word-active';
                            else span.className = 'tts-word-hidden';
                        }
                    }
                }, 400); // 400ms por palavra simulando leitura sem usar engine real
            };

            const playAudio = (onFinish) => {
                if (!hasAudio) { if (onFinish) onFinish(); return; }
                currentTtsAudio = new Audio(data.audioUrl);
                currentTtsAudio.volume = 0; // MUTED for admin preview
                currentTtsAudio.onended = () => { currentTtsAudio = null; if (onFinish) onFinish(); };
                currentTtsAudio.onerror = () => { currentTtsAudio = null; if (onFinish) onFinish(); };
                currentTtsAudio.play().catch(e => { currentTtsAudio = null; if (onFinish) onFinish(); });
            };

            if (behavior === 'audio_only' || (!hasText && hasAudio)) playAudio(hideCharacter);
            else if (!hasAudio) speakText(hideCharacter);
            else if (behavior === 'audio_before') playAudio(() => speakText(hideCharacter));
            else if (behavior === 'audio_after') speakText(() => playAudio(hideCharacter));
            else {
                let finishedCount = 0;
                const checkDone = () => { finishedCount++; if (finishedCount === 2) hideCharacter(); };
                speakText(checkDone); playAudio(checkDone);
            }
        });

        socket.on('character:stop', () => {
            if (window.currentAdminTtsTimer) clearInterval(window.currentAdminTtsTimer);
            if (currentTtsAudio) { currentTtsAudio.pause(); currentTtsAudio = null; }
            ttsContainer.classList.remove('show');
            if (ttsSubtitle) ttsSubtitle.innerHTML = '';
        });`;

html = html.replace(regexSocketOn, newSocketLogic);
fs.writeFileSync('public/admin.html', html);
console.log('Script updated without speechSynthesis.');
