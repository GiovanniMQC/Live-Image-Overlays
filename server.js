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

// Configuração do Multer para salvar os arquivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const ext = path.extname(file.originalname);
        cb(null, 'media-' + uniqueSuffix + ext)
    }
});
const upload = multer({ storage: storage });

// Endpoint para receber arquivos via Drag & Drop
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    // Retorna a URL pública do arquivo
    res.json({ url: '/uploads/' + req.file.filename });
});

// Endpoint para listar os áudios upados
app.get('/api/audio-uploads', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        const audioFiles = files.filter(f => f.match(/\.(mp3|wav|ogg|aac|m4a)$/i));
        res.json(audioFiles.map(f => '/uploads/' + f));
    } catch(e) {
        res.json([]);
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

    socket.on('media:delete', (data) => {
        if (appState[data.id]) {
            const url = appState[data.id].url;
            delete appState[data.id];
            socket.broadcast.emit('media:delete', data);
            
            // Apaga arquivo local se existir
            if (url && url.startsWith('/uploads/')) {
                const filename = path.basename(url);
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
