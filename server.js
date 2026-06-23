const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const mediaDbPath = path.join(__dirname, 'media_db.json');
let mediaList = [];

function loadMediaDb() {
    if (fs.existsSync(mediaDbPath)) {
        try {
            mediaList = JSON.parse(fs.readFileSync(mediaDbPath, 'utf8'));
        } catch(e) {
            mediaList = [];
        }
    } else {
        mediaList = [];
        saveMediaDb();
    }
}

function saveMediaDb() {
    fs.writeFileSync(mediaDbPath, JSON.stringify(mediaList, null, 2));
}

loadMediaDb();

// Configuração e limpeza da pasta de Uploads ao iniciar o servidor
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
} else {
    // Limpa arquivos antigos para não acumular lixo (exceto favoritados)
    const files = fs.readdirSync(uploadsDir);
    const favoritedUrls = mediaList.filter(m => m.pinned).map(m => m.url.split('?')[0]);

    for (const file of files) {
        const fileUrl = '/uploads/' + encodeURIComponent(file);
        if (!favoritedUrls.includes(fileUrl)) {
            try { fs.unlinkSync(path.join(uploadsDir, file)); } catch(e) {}
        }
    }
}

// Configuração da pasta de Uploads de Áudio (persistente)
const audioUploadsDir = path.join(__dirname, 'public', 'audio_uploads');
if (!fs.existsSync(audioUploadsDir)) {
    fs.mkdirSync(audioUploadsDir, { recursive: true });
}

// Diretório temporário para áudios gerados pelo RVC
const rvcTempDir = path.join(__dirname, 'public', 'rvc_temp');
if (!fs.existsSync(rvcTempDir)) {
    fs.mkdirSync(rvcTempDir, { recursive: true });
} else {
    // Apaga os áudios RVC antigos ao iniciar o servidor
    const files = fs.readdirSync(rvcTempDir);
    for (const file of files) {
        try { fs.unlinkSync(path.join(rvcTempDir, file)); } catch(e) {}
    }
}

// Configuração do Multer para salvar os arquivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        // Preserva o nome original e converte a codificação corretamente para UTF-8
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, originalName);
    }
});
const upload = multer({ storage: storage });

// Configuração do Multer para os áudios
const audioStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, audioUploadsDir)
    },
    filename: function (req, file, cb) {
        // Preserva o nome original e converte a codificação corretamente para UTF-8
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, originalName);
    }
});
const uploadAudio = multer({ storage: audioStorage });

// Endpoint para receber arquivos via Drag & Drop
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    // Retorna a URL pública do arquivo
    // Adiciona timestamp na query string para forçar o recarregamento caso faça upload de um arquivo com o mesmo nome
    res.json({ url: '/uploads/' + encodeURIComponent(req.file.filename) + '?v=' + Date.now() });
});

// Novo endpoint para receber arquivos de áudio
app.post('/upload-audio', uploadAudio.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    // Retorna a URL pública do arquivo codificando espaços e caracteres especiais
    res.json({ url: '/audio_uploads/' + encodeURIComponent(req.file.filename) });
});

app.use(express.json()); // Necessário para ler o body das requisições POST com JSON

const audioDbPath = path.join(__dirname, 'audio_db.json');
let audioList = [];
const defaultSounds = [
    { id: 'def-1', name: "Ta Da!", icon: "🎉", url: "https://www.myinstants.com/media/sounds/tada.mp3", pinned: false },
    { id: 'def-2', name: "Triste", icon: "🎺", url: "https://www.myinstants.com/media/sounds/sad-trombone.mp3", pinned: false },
    { id: 'def-3', name: "Grilos", icon: "🦗", url: "https://www.myinstants.com/media/sounds/crickets.mp3", pinned: false },
    { id: 'def-4', name: "Errou", icon: "❌", url: "https://www.myinstants.com/media/sounds/errooou.mp3", pinned: false },
    { id: 'def-5', name: "Vine Boom", icon: "💥", url: "https://www.myinstants.com/media/sounds/vine-boom.mp3", pinned: false }
];

function loadAudioDb() {
    if (fs.existsSync(audioDbPath)) {
        try {
            audioList = JSON.parse(fs.readFileSync(audioDbPath, 'utf8'));
        } catch(e) {
            audioList = [...defaultSounds];
        }
    } else {
        audioList = [...defaultSounds];
        saveAudioDb();
    }
}

function saveAudioDb() {
    fs.writeFileSync(audioDbPath, JSON.stringify(audioList, null, 2));
}

loadAudioDb();

// Endpoint para listar os áudios e sincronizar com uploads físicos
app.get('/api/audio-list', (req, res) => {
    try {
        const files = fs.readdirSync(audioUploadsDir);
        const audioFiles = files.filter(f => f.match(/\.(mp3|wav|ogg|aac|m4a)$/i));
        const fileUrls = audioFiles.map(f => '/audio_uploads/' + encodeURIComponent(f));
        
        // Adiciona novos arquivos à lista se não existirem
        fileUrls.forEach(url => {
            if (!audioList.find(a => a.url === url)) {
                const filename = decodeURIComponent(url.split('/').pop());
                const nameWithoutExt = filename.replace(/\.[^/.]+$/, ""); // Remove extensão
                const shortName = nameWithoutExt.length > 25 ? nameWithoutExt.substring(0, 22) + '...' : nameWithoutExt;
                audioList.push({
                    id: 'up-' + Date.now() + Math.random().toString(36).substring(2,9),
                    name: shortName,
                    icon: "🎵",
                    url: url,
                    pinned: false
                });
            }
        });

        // Remover da audioList os arquivos de upload que não existem mais fisicamente
        audioList = audioList.filter(a => {
            if (a.url.startsWith('/audio_uploads/')) {
                return fileUrls.includes(a.url);
            }
            if (a.url.startsWith('/uploads/')) {
                return false; // Remove áudios antigos temporários caso tenham sobrado do sistema antigo
            }
            return true; // mantém URLs externas
        });

        saveAudioDb();
    } catch(e) {
        console.error("Erro ao sincronizar uploads de áudio:", e);
    }
    
    // Sort logic: pinned first, then preserve existing order
    const pinned = audioList.filter(a => a.pinned);
    const unpinned = audioList.filter(a => !a.pinned);
    res.json([...pinned, ...unpinned]);
});

// Atualizar propriedades de um áudio
app.post('/api/audio-update/:id', (req, res) => {
    const id = req.params.id;
    const { name, icon, pinned, trimStart, trimEnd, volume } = req.body;
    
    const audio = audioList.find(a => a.id === id);
    if (audio) {
        if (name !== undefined) audio.name = name;
        if (icon !== undefined) audio.icon = icon;
        if (pinned !== undefined) audio.pinned = pinned;
        if (trimStart !== undefined) audio.trimStart = trimStart;
        if (trimEnd !== undefined) audio.trimEnd = trimEnd;
        if (volume !== undefined) audio.volume = volume;
        saveAudioDb();
        res.json({ success: true, audio });
    } else {
        res.status(404).json({ error: 'Áudio não encontrado' });
    }
});

// Excluir um áudio
app.post('/api/audio-delete/:id', (req, res) => {
    const id = req.params.id;
    const audioIndex = audioList.findIndex(a => a.id === id);
    
    if (audioIndex !== -1) {
        const audio = audioList[audioIndex];
        audioList.splice(audioIndex, 1);
        
        // Se for um arquivo local de upload, apaga do disco permanentemente
        if (audio.url.startsWith('/audio_uploads/')) {
            const filename = decodeURIComponent(audio.url.split('/').pop());
            const filepath = path.join(audioUploadsDir, filename);
            try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); } catch(e) {}
        }
        
        saveAudioDb();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Áudio não encontrado' });
    }
});

// Reordenar a lista
app.post('/api/audio-reorder', (req, res) => {
    const { orderIds } = req.body; // array de IDs na nova ordem
    if (Array.isArray(orderIds)) {
        const newList = [];
        orderIds.forEach(id => {
            const audio = audioList.find(a => a.id === id);
            if (audio) newList.push(audio);
        });
        
        // Se ficou faltando algum, adiciona no final
        audioList.forEach(audio => {
            if (!newList.find(a => a.id === audio.id)) {
                newList.push(audio);
            }
        });
        
        audioList = newList;
        saveAudioDb();
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Formato de orderIds inválido' });
    }
});

// ======================= MEDIA API =======================

// Endpoint para listar as mídias e sincronizar com uploads físicos
app.get('/api/media-list', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        const mediaFiles = files.filter(f => f.match(/\.(png|jpe?g|gif|webp|mp4|webm)$/i));
        const fileUrls = mediaFiles.map(f => '/uploads/' + encodeURIComponent(f));
        
        // Adiciona novos arquivos à lista se não existirem
        fileUrls.forEach(url => {
            const baseUrls = mediaList.map(m => m.url.split('?')[0]);
            if (!baseUrls.includes(url)) {
                const filename = decodeURIComponent(url.split('/').pop());
                const nameWithoutExt = filename.replace(/\.[^/.]+$/, ""); // Remove extensão
                const shortName = nameWithoutExt.length > 25 ? nameWithoutExt.substring(0, 22) + '...' : nameWithoutExt;
                mediaList.push({
                    id: 'med-' + Date.now() + Math.random().toString(36).substring(2,9),
                    name: shortName,
                    url: url,
                    pinned: false
                });
            }
        });

        // Remover da mediaList os arquivos de upload que não existem mais fisicamente
        mediaList = mediaList.filter(m => {
            if (m.url.startsWith('/uploads/')) {
                const baseUrl = m.url.split('?')[0];
                return fileUrls.includes(baseUrl);
            }
            return true; // mantém URLs externas
        });

        saveMediaDb();
    } catch(e) {
        console.error("Erro ao sincronizar uploads de mídia:", e);
    }
    
    // Sort logic: pinned first, then preserve existing order
    const pinned = mediaList.filter(m => m.pinned);
    const unpinned = mediaList.filter(m => !m.pinned);
    res.json([...pinned, ...unpinned]);
});

// Atualizar propriedades de uma mídia
app.post('/api/media-update/:id', (req, res) => {
    const id = req.params.id;
    const { name, pinned } = req.body;
    
    const media = mediaList.find(m => m.id === id);
    if (media) {
        if (name !== undefined) media.name = name;
        if (pinned !== undefined) media.pinned = pinned;
        saveMediaDb();
        res.json({ success: true, media });
    } else {
        res.status(404).json({ error: 'Mídia não encontrada' });
    }
});

// Excluir uma mídia
app.post('/api/media-delete/:id', (req, res) => {
    const id = req.params.id;
    const mediaIndex = mediaList.findIndex(m => m.id === id);
    
    if (mediaIndex !== -1) {
        const media = mediaList[mediaIndex];
        mediaList.splice(mediaIndex, 1);
        
        // Se for um arquivo local de upload, apaga do disco permanentemente
        if (media.url.startsWith('/uploads/')) {
            const filename = decodeURIComponent(media.url.split('?')[0].split('/').pop());
            const filepath = path.join(uploadsDir, filename);
            try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); } catch(e) {}
        }
        
        saveMediaDb();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Mídia não encontrada' });
    }
});

// Reordenar a lista de mídia
app.post('/api/media-reorder', (req, res) => {
    const { orderIds } = req.body; // array de IDs na nova ordem
    if (Array.isArray(orderIds)) {
        const newList = [];
        orderIds.forEach(id => {
            const media = mediaList.find(m => m.id === id);
            if (media) newList.push(media);
        });
        
        // Se ficou faltando algum, adiciona no final
        mediaList.forEach(media => {
            if (!newList.find(m => m.id === media.id)) {
                newList.push(media);
            }
        });
        
        mediaList = newList;
        saveMediaDb();
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Formato de orderIds inválido' });
    }
});

// Adicionar mídia à biblioteca (por ex., via URL externa)
app.post('/api/media-add', (req, res) => {
    const { url, name } = req.body;
    if (url) {
        const newMedia = {
            id: 'med-' + Date.now() + Math.random().toString(36).substring(2,9),
            name: name || 'Mídia Externa',
            url: url,
            pinned: true
        };
        mediaList.push(newMedia);
        saveMediaDb();
        res.json({ success: true, media: newMedia });
    } else {
        res.status(400).json({ error: 'URL inválida' });
    }
});

// ======================= TTS API =======================

const ttsDbPath = path.join(__dirname, 'tts_db.json');
let ttsList = [];

function loadTtsDb() {
    if (fs.existsSync(ttsDbPath)) {
        try {
            ttsList = JSON.parse(fs.readFileSync(ttsDbPath, 'utf8'));
        } catch(e) {
            ttsList = [];
        }
    } else {
        ttsList = [];
        saveTtsDb();
    }
}

function saveTtsDb() {
    fs.writeFileSync(ttsDbPath, JSON.stringify(ttsList, null, 2));
}

loadTtsDb();

app.get('/api/tts-list', (req, res) => {
    // Sort logic: pinned first, then preserve existing order
    const pinned = ttsList.filter(t => t.pinned);
    const unpinned = ttsList.filter(t => !t.pinned);
    res.json([...pinned, ...unpinned]);
});

app.post('/api/tts-add', (req, res) => {
    const { name, imageUrl, audioUrl, subtitleColor, position, customFlip, customX, customY, audioBehavior, pinned, animation, rvcModel, rvcPitch, rvcMethod } = req.body;
    const newTts = {
        id: 'tts-' + Date.now() + Math.random().toString(36).substring(2,9),
        name: name || 'Novo Personagem',
        imageUrl: imageUrl || '',
        audioUrl: audioUrl || '',
        subtitleColor: subtitleColor || '#ffd700',
        position: position || 'right',
        customFlip: customFlip || false,
        customX: customX !== undefined ? customX : 80.0,
        customY: customY !== undefined ? customY : 80.0,
        audioBehavior: audioBehavior || 'simultaneous',
        animation: animation || 'none',
        pinned: pinned || false,
        rvcModel: rvcModel || '',
        rvcPitch: rvcPitch !== undefined ? rvcPitch : 0,
        rvcMethod: rvcMethod || 'rmvpe'
    };
    ttsList.push(newTts);
    saveTtsDb();
    res.json({ success: true, tts: newTts });
});

app.post('/api/tts-update/:id', (req, res) => {
    const id = req.params.id;
    const tts = ttsList.find(t => t.id === id);
    if (tts) {
        Object.assign(tts, req.body);
        saveTtsDb();
        res.json({ success: true, tts });
    } else {
        res.status(404).json({ error: 'Personagem não encontrado' });
    }
});

app.post('/api/tts-delete/:id', (req, res) => {
    const id = req.params.id;
    const index = ttsList.findIndex(t => t.id === id);
    if (index !== -1) {
        ttsList.splice(index, 1);
        saveTtsDb();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Personagem não encontrado' });
    }
});

app.post('/api/tts-reorder', (req, res) => {
    const { orderIds } = req.body;
    if (Array.isArray(orderIds)) {
        const newList = [];
        orderIds.forEach(id => {
            const tts = ttsList.find(t => t.id === id);
            if (tts) newList.push(tts);
        });
        ttsList.forEach(tts => {
            if (!newList.find(t => t.id === tts.id)) {
                newList.push(tts);
            }
        });
        ttsList = newList;
        saveTtsDb();
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Formato de orderIds inválido' });
    }
});

// ========================================================
// IA TTS PIPELINE (RVC + Piper)
// ========================================================
app.get('/api/voices', (req, res) => {
    try {
        const rvcDir = path.join(__dirname, 'tts', 'modelos_rvc');
        if (!fs.existsSync(rvcDir)) {
            return res.json([]);
        }
        
        const models = [];
        const items = fs.readdirSync(rvcDir, { withFileTypes: true });
        
        for (const item of items) {
            if (item.isFile() && item.name.endsWith('.pth')) {
                models.push(item.name);
            } else if (item.isDirectory()) {
                const subDir = path.join(rvcDir, item.name);
                const subItems = fs.readdirSync(subDir);
                for (const subItem of subItems) {
                    if (subItem.endsWith('.pth')) {
                        models.push(`${item.name}/${subItem}`);
                    }
                }
            }
        }
        res.json(models);
    } catch(e) {
        console.error('Erro ao ler modelos RVC:', e);
        res.status(500).json({ error: 'Erro ao ler modelos' });
    }
});

function callRvcMicroservice(inputPath, outputPath, modelPath, pitch, method) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            input_path: inputPath,
            output_path: outputPath,
            model_path: modelPath,
            pitch: pitch,
            method: method || 'rmvpe'
        });

        const options = {
            hostname: 'localhost',
            port: 5050,
            path: '/converter',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode === 200) {
                        console.log(`✅ RVC concluído em ${json.tempo_segundos}s`);
                        resolve();
                    } else {
                        reject(`Erro do microserviço RVC: ${json.erro || data}`);
                    }
                } catch (e) {
                    reject(`Resposta inválida do microserviço RVC: ${data}`);
                }
            });
        });

        req.on('error', (e) => {
            if (e.code === 'ECONNREFUSED') {
                reject('Microserviço RVC não está rodando. Inicie o servidor_rvc.py antes de usar esta função.');
            } else {
                reject(`Erro de conexão com o microserviço RVC: ${e.message}`);
            }
        });

        req.write(payload);
        req.end();
    });
}

function generateRVCAudio(text, model, pitch, method) {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const piperOutPath = path.join(__dirname, `temp_piper_${timestamp}.wav`);
        const rvcOutPath = path.join(rvcTempDir, `rvc_${timestamp}.wav`);

        // Ensure text is safely escaped for echo
        const safeText = text.replace(/"/g, '\\"').replace(/\$/g, '\\$');

        // Passo 1: Gerar voz base com Piper
        const piperCmd = `echo "${safeText}" | ./tts/tts_env/bin/piper --model ./tts/modelos_piper/pt_BR-faber-medium.onnx --output_file "${piperOutPath}"`;

        exec(piperCmd, { cwd: __dirname }, async (error, stdout, stderr) => {
            if (error) {
                console.error('Piper Error:', stderr);
                return reject('Falha ao gerar voz base com Piper');
            }

            // Passo 2: Converter com RVC via microserviço (modelo em cache)
            const modelPath = path.join(__dirname, 'tts', 'modelos_rvc', model);
            try {
                await callRvcMicroservice(piperOutPath, rvcOutPath, modelPath, pitch, method);
                resolve(`/rvc_temp/rvc_${timestamp}.wav`);
            } catch (err) {
                reject(err);
            } finally {
                // Remove arquivo intermediário do Piper independente do resultado
                try { fs.unlinkSync(piperOutPath); } catch(e) {}
            }
        });
    });
}

app.post('/api/tts/preview', express.json(), async (req, res) => {
    try {
        const { text, model, pitch, method } = req.body;
        if (!text || !model || pitch === undefined) return res.status(400).json({ error: 'Faltam parâmetros' });
        
        const audioUrl = await generateRVCAudio(text, model, pitch, method);
        res.json({ success: true, audioUrl });
    } catch(e) {
        res.status(500).json({ error: e });
    }
});

// ===================== RVC VOICE RECORDING =====================
// Multer para gravações temporárias de microfone
const recordingsDir = path.join(__dirname, 'public', 'audio_uploads');
const recordingStorage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, recordingsDir); },
    filename: function (req, file, cb) {
        cb(null, `rec_${Date.now()}.webm`);
    }
});
const uploadRecording = multer({ storage: recordingStorage });

function processAudioWithRVC(inputAudioPath, model, pitch, method) {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const rvcOutPath = path.join(rvcTempDir, `rvc_rec_${timestamp}.wav`);
        const wavInputPath = inputAudioPath.replace('.webm', '.wav');

        // Passo 1: Converter webm → wav via ffmpeg
        const convertCmd = `ffmpeg -y -i "${inputAudioPath}" "${wavInputPath}"`;
        exec(convertCmd, { cwd: __dirname }, async (err, stdout, stderr) => {
            if (err) {
                console.error('FFmpeg convert error:', stderr);
                return reject('Falha ao converter áudio gravado (precisa de ffmpeg instalado)');
            }

            // Passo 2: Converter com RVC via microserviço (modelo em cache)
            const modelPath = path.join(__dirname, 'tts', 'modelos_rvc', model);
            try {
                await callRvcMicroservice(wavInputPath, rvcOutPath, modelPath, pitch, method);
                resolve(`/rvc_temp/rvc_rec_${timestamp}.wav`);
            } catch (err2) {
                reject(err2);
            } finally {
                // Remove arquivos temporários independente do resultado
                try { fs.unlinkSync(inputAudioPath); } catch(e) {}
                try { fs.unlinkSync(wavInputPath); } catch(e) {}
            }
        });
    });
}

// Preview: processa a gravação com RVC e retorna a URL do áudio
app.post('/api/tts/record-rvc-preview', uploadRecording.single('audio'), async (req, res) => {
    try {
        const { model, pitch, method } = req.body;
        if (!req.file || !model || pitch === undefined) return res.status(400).json({ error: 'Faltam parâmetros (áudio, modelo, pitch)' });
        const audioUrl = await processAudioWithRVC(req.file.path, model, parseInt(pitch), method);
        res.json({ success: true, audioUrl });
    } catch(e) {
        res.status(500).json({ error: e });
    }
});

// Live: processa a gravação com RVC e emite para a overlay
app.post('/api/tts/record-rvc-live', uploadRecording.single('audio'), async (req, res) => {
    try {
        const { model, pitch, method, characterDataJson } = req.body;
        if (!req.file || !model || pitch === undefined || !characterDataJson) return res.status(400).json({ error: 'Faltam parâmetros' });
        const characterData = JSON.parse(characterDataJson);
        const audioUrl = await processAudioWithRVC(req.file.path, model, parseInt(pitch), method);
        io.emit('character:speak', {
            text: '',
            imageUrl: characterData.imageUrl,
            audioUrl: characterData.audioUrl,
            audioBehavior: characterData.audioBehavior,
            rvcAudioUrl: audioUrl, // Audio RVC (IA) gerado pela gravação
            subtitleColor: characterData.subtitleColor,
            position: characterData.position,
            customFlip: characterData.customFlip,
            customX: characterData.customX,
            customY: characterData.customY,
            muteBrowserTts: true,
            animation: characterData.animation || 'none'
        });
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e });
    }
});
// ===============================================================

app.get('/api/rvc-history', (req, res) => {
    try {
        const files = fs.readdirSync(rvcTempDir).filter(f => f.endsWith('.wav'));
        const fileList = files.map(f => {
            const stat = fs.statSync(path.join(rvcTempDir, f));
            return {
                name: f,
                url: '/rvc_temp/' + encodeURIComponent(f),
                mtime: stat.mtimeMs
            };
        });
        // order by newest first
        fileList.sort((a, b) => b.mtime - a.mtime);
        res.json({ files: fileList });
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

app.post('/api/tts/live', express.json(), async (req, res) => {
    try {
        const { text, model, pitch, method, characterData } = req.body;
        if (!text || !model || pitch === undefined || !characterData) return res.status(400).json({ error: 'Faltam parâmetros' });
        
        const audioUrl = await generateRVCAudio(text, model, pitch, method);
        
        // Emite para a overlay como um TTS normal, mas com o áudio gerado
        io.emit('character:speak', {
            text: text,
            imageUrl: characterData.imageUrl,
            audioUrl: characterData.audioUrl,
            audioBehavior: characterData.audioBehavior,
            rvcAudioUrl: audioUrl, // Audio RVC (IA)
            subtitleColor: characterData.subtitleColor,
            position: characterData.position,
            customFlip: characterData.customFlip,
            customX: characterData.customX,
            customY: characterData.customY,
            muteBrowserTts: true, // Silencia o robô do browser, exibe legenda
            animation: characterData.animation || 'none'
        });
        
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e });
    }
});
// ========================================================

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Estado simples em memória para caso o OBS recarregue a página
let appState = {};
let audioState = { url: '', playing: false, currentTime: 0, volume: 0.5 };

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    // Envia o estado atual quando um novo cliente (ex: OBS) conecta
    socket.on('request_state', () => {
        socket.emit('sync_state', Object.values(appState));
        socket.emit('audio:sync', audioState);
    });

    // ================= AUDIO SYNC =====================
    socket.on('audio:play', (data) => {
        audioState.url = data.url;
        audioState.playing = true;
        audioState.currentTime = data.currentTime || 0;
        audioState.volumeMult = data.volumeMult !== undefined ? data.volumeMult : 1;
        // io.emit manda pra TODOS conectados, inclusive quem enviou. Como o admin tbm ouve o proprio áudio isso não tem problema e garante que chega na overlay.
        io.emit('audio:play', audioState);
    });

    socket.on('audio:pause', (data) => {
        audioState.playing = false;
        audioState.currentTime = data.currentTime || 0;
        io.emit('audio:pause', audioState);
    });

    socket.on('audio:volume', (data) => {
        audioState.volume = data.volume;
        io.emit('audio:volume', audioState);
    });

    socket.on('audio:seek', (data) => {
        audioState.currentTime = data.currentTime;
        io.emit('audio:seek', audioState);
    });
    // ==================================================

    socket.on('media:create', (data) => {
        data.visible = true; // Por padrão, a mídia recém-criada é visível
        appState[data.id] = data;
        // Repassa para os outros clientes (como o OBS)
        socket.broadcast.emit('media:create', data);
    });

    socket.on('media:drag_sync', (data) => {
        if (appState[data.id]) {
            appState[data.id].x = data.x;
            appState[data.id].y = data.y;
            // Alta frequência: repassa a posição
            socket.broadcast.emit('media:drag_sync', data);
        }
    });

    socket.on('media:scale_sync', (data) => {
        if (appState[data.id]) {
            appState[data.id].scaleX = data.scaleX;
            appState[data.id].scaleY = data.scaleY;
            socket.broadcast.emit('media:scale_sync', data);
        }
    });

    socket.on('media:transform_sync', (data) => {
        if (appState[data.id]) {
            appState[data.id].rotation = data.rotation;
            appState[data.id].flipX = data.flipX;
            appState[data.id].flipY = data.flipY;
            socket.broadcast.emit('media:transform_sync', data);
        }
    });

    socket.on('media:crop_sync', (data) => {
        if (appState[data.id]) {
            appState[data.id].crop = data.crop;
            socket.broadcast.emit('media:crop_sync', data);
        }
    });

    socket.on('media:update_text', (data) => {
        if (appState[data.id]) {
            appState[data.id].text = data.text;
            socket.broadcast.emit('media:update_text', data);
        }
    });

    socket.on('media:layer_sync', (data) => {
        if (appState[data.id]) {
            appState[data.id].zIndex = data.zIndex;
            socket.broadcast.emit('media:layer_sync', data);
        }
    });

    socket.on('media:opacity_sync', (data) => {
        if (appState[data.id]) {
            appState[data.id].opacity = data.opacity;
            socket.broadcast.emit('media:opacity_sync', data);
        }
    });

    socket.on('media:toggle_visibility', (data) => {
        if (appState[data.id]) {
            appState[data.id].visible = data.visible;
            socket.broadcast.emit('media:toggle_visibility', data);
        }
    });

    socket.on('media:video_mute', (data) => {
        if (appState[data.id]) {
            appState[data.id].muted = data.muted;
            socket.broadcast.emit('media:video_mute', data);
        }
    });

    socket.on('media:video_volume', (data) => {
        if (appState[data.id]) {
            appState[data.id].volume = data.volume;
            socket.broadcast.emit('media:video_volume', data);
        }
    });

    socket.on('media:video_seek', (data) => {
        if (appState[data.id]) {
            appState[data.id].currentTime = data.currentTime;
            socket.broadcast.emit('media:video_seek', data);
        }
    });

    socket.on('media:video_sync_from_overlay', (data) => {
        if (appState[data.id]) {
            appState[data.id].currentTime = data.currentTime;
            socket.broadcast.emit('media:video_sync_from_overlay', data);
        }
    });

    socket.on('character:speak', (data) => {
        io.emit('character:speak', data);
    });

    socket.on('character:stop', () => {
        io.emit('character:stop');
    });

    socket.on('media:delete', (data) => {
        if (appState[data.id]) {
            const url = appState[data.id].url;
            delete appState[data.id];
            socket.broadcast.emit('media:delete', data);
            
            // Apaga arquivo local se existir
            if (url && url.startsWith('/uploads/')) {
                // Tira query string e decodifica a URI
                const filename = decodeURIComponent(url.split('?')[0].split('/').pop());
                const filepath = path.join(uploadsDir, filename);
                try {
                    if (fs.existsSync(filepath)) {
                        fs.unlinkSync(filepath);
                        console.log('🗑️ Arquivo apagado do disco:', filename);
                    }
                } catch(e) {
                    console.error('Erro ao deletar do disco:', e);
                }
            }
        }
    });

    socket.on('admin:mousemove', (data) => {
        socket.broadcast.emit('admin:mousemove', data);
    });

    // ================= WEBRTC SIGNALING =====================
    // Relay the offer from the emitter (captura.html) to the receiver (admin.html)
    socket.on('webrtc_offer', (data) => {
        if (data.targetId) {
            socket.to(data.targetId).emit('webrtc_offer', { offer: data.offer, emitterId: socket.id });
        } else {
            socket.broadcast.emit('webrtc_offer', { offer: data, emitterId: socket.id });
        }
    });

    socket.on('request_webrtc_offer', () => {
        socket.broadcast.emit('request_webrtc_offer', { requesterId: socket.id });
    });

    socket.on('webrtc_stream_started', () => {
        socket.broadcast.emit('webrtc_stream_started');
    });

    // Relay the answer from receiver to emitter
    socket.on('webrtc_answer', (data) => {
        if (data.targetId) {
            socket.to(data.targetId).emit('webrtc_answer', { answer: data.answer, from: socket.id });
        } else {
            socket.broadcast.emit('webrtc_answer', { answer: data, from: socket.id });
        }
    });

    // Relay ICE candidates
    socket.on('webrtc_ice_candidate', (data) => {
        if (data.targetId) {
            socket.to(data.targetId).emit('webrtc_ice_candidate', { candidate: data.candidate, from: socket.id });
        } else {
            socket.broadcast.emit('webrtc_ice_candidate', { candidate: data, from: socket.id });
        }
    });
    // ========================================================

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
        socket.broadcast.emit('admin:disconnect', socket.id);
    });
});

const initialPort = process.env.PORT || 3000;

function startServer(port) {
    server.listen(port, () => {
        console.log(`\n======================================================`);
        console.log(`🚀 Servidor rodando na porta ${port}`);
        console.log(`======================================================`);
        console.log(`📺 OBS Overlay URL: http://localhost:${port}/overlay.html`);
        console.log(`🛠️  Painel Admin URL: http://localhost:${port}/admin.html`);
        console.log(`======================================================\n`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️ A porta ${port} está em uso. Tentando a porta ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Erro ao iniciar o servidor:', err);
        }
    });
}

startServer(initialPort);
