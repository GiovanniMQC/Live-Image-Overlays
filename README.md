# 📺 OBS Live Collab Overlay (Em Desenvolvimento)

Um sistema web interativo para OBS Studio que permite a injeção colaborativa de mídias (áudio, vídeo, imagens e texto) diretamente na transmissão ao vivo, com controle em tempo real por moderadores.

> **⚠️ Nota de Desenvolvimento (Vibe Coding):**
> Este projeto faz uso intenso de Inteligência Artificial para o desenvolvimento inicial (o famoso *vibe coding*). A ideia principal é colocar um protótipo funcional no ar rapidamente, suprindo algumas lacunas de conhecimento técnico que ainda tenho. Mais do que apenas criar uma ferramenta para usar nas minhas lives, o objetivo deste projeto é **aprender a usar a IA como uma ferramenta de auxílio real**, enquanto manualmente eu faço a busca de bugs, realizando testes de funções e aprendendo a prototipar novas ideias rapidamente, além de melhorar a UX/UI.

---

## ✨ Funcionalidades

O sistema é dividido em três ambientes principais que se comunicam entre si:

### 🛠️ 1. Painel Admin (Multiplayer)
Um canvas vasto e interativo projetado para funcionar como uma mesa de controle dinâmico.
* **Sistema de Área de Palco (Staging Area):** O espaço de trabalho dos admins é propositalmente gigante. No centro, uma **borda vermelha** delimita a área real que aparece no OBS. Isso permite que os moderadores importem e preparem imagens, vídeos e textos nas laterais externas (fora do ar) e apenas arrastem os elementos para dentro da borda vermelha quando for o momento de exibir na live.
* **Efeito de Interação Externa:** Essa dinâmica de arrastar mídias para a tela de transmissão cria um efeito visual de que alguém de fora está intervindo diretamente na live em tempo real.
* **Soundpad Integrado:** Importe áudios, gerencie nomes e adicione ícones personalizados.
* **Controle Avançado de Mídia:** Ajuste de volume, barra de progresso do player (seeker), opacidade, redimensionamento/esticamento (stretch), espelhamento e cortes (crop) dos elementos colocados no canvas.
* **Presença Multiplayer:** Múltiplos administradores podem interagir no mesmo painel simultaneamente. É possível visualizar os cursores uns dos outros em tempo real, com opção de customizar o nome e a cor do ponteiro.
* **Monitoramento P2P:** A área demarcada pela borda vermelha no canvas pode ser substituída pelo retorno de vídeo real do streamer para que os admins vejam o resultado com precisão.

### 🎬 2. Tela de Overlay (OBS)
Uma página transparente projetada para ser adicionada como **Fonte de Navegador (Browser Source)** no OBS Studio.
* Renderiza e reproduz instantaneamente todas as mídias e áudios posicionados pelos administradores dentro do limite da borda vermelha, sem necessidade de comandos por parte do streamer.

### 📡 3. Portal do Streamer (Envio P2P)
Uma interface exclusiva para o streamer enviar seu retorno para os admins com latência quase zero.
* **Vídeo:** Envia a tela do OBS utilizando a Câmera Virtual (*OBS Virtual Camera*).
* **Áudio:** Envia o som da transmissão capturando um microfone virtual que pode ser configurado via **Voicemeeter**.
* **Conexão Direta:** Utiliza comunicação P2P via WebRTC para eliminar delays e permitir sincronia nas ações dos admins.

---

## 💻 Stack & Tecnologias
*(Base atual do protótipo)*
* **Node.js & WebSockets (Socket.io):** Para a comunicação bidirecional em tempo real, sincronizando cursores, posições e eventos do painel.
* **WebRTC:** Para a transmissão de vídeo e áudio P2P de baixíssima latência entre o portal do streamer e os admins.
* **Frontend Vanilla:** HTML5, CSS3 e JavaScript puro para manipulação de Canvas e elementos de mídia.

---
*Feito com ☕ e IA — focado em prototipagem rápida e aprendizado contínuo.*
