const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuração e limpeza da pasta de Uploads ao iniciar o servidor
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
} else {
    // Limpa arquivos antigos para não acumular lixo
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
        try { fs.unlinkSync(path.join(uploadsDir, file)); } catch(e) {}
    }
}

// Configuração da pasta de Uploads de Áudio (persistente)
const audioUploadsDir = path.join(__dirname, 'public', 'audio_uploads');
if (!fs.existsSync(audioUploadsDir)) {
    fs.mkdirSync(audioUploadsDir, { recursive: true });
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
    const { name, icon, pinned } = req.body;
    
    const audio = audioList.find(a => a.id === id);
    if (audio) {
        if (name !== undefined) audio.name = name;
        if (icon !== undefined) audio.icon = icon;
        if (pinned !== undefined) audio.pinned = pinned;
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

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
        socket.broadcast.emit('admin:disconnect', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`======================================================`);
    console.log(`📺 OBS Overlay URL: http://localhost:${PORT}/overlay.html`);
    console.log(`🛠️  Painel Admin URL: http://localhost:${PORT}/admin.html`);
    console.log(`======================================================\n`);
});
