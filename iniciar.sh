#!/usr/bin/env bash
# =============================================================
# iniciar.sh — Inicializador do Live Image Overlays
# Sobe: RVC (Flask :5050) + RVC-ONNX (Flask :5051) + Node (:3000)
# =============================================================

# --- Cores para o terminal ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# --- Caminho base do projeto (pasta onde este script está) ---
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$PROJECT_DIR/tts/tts_env/bin/python"
LOG_DIR="$PROJECT_DIR/.logs"

mkdir -p "$LOG_DIR"

# --- Banner ---
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║     🎙️  Live Image Overlays — Iniciar    ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""

# --- Verifica se o Python do venv existe ---
if [ ! -f "$PYTHON" ]; then
    echo -e "${RED}✗ Ambiente virtual Python não encontrado em:${RESET}"
    echo -e "  ${YELLOW}$PYTHON${RESET}"
    echo -e "${RED}  Crie o venv com: python -m venv tts/tts_env${RESET}"
    exit 1
fi

# --- Verifica se o Node.js está disponível ---
if ! command -v node &>/dev/null; then
    echo -e "${RED}✗ Node.js não encontrado. Instale o Node.js para continuar.${RESET}"
    exit 1
fi

# --- Função para matar todos os processos ao sair ---
PIDS=()
cleanup() {
    echo ""
    echo -e "${YELLOW}⚠ Encerrando todos os servidores...${RESET}"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
        fi
    done
    wait 2>/dev/null
    echo -e "${GREEN}✓ Todos os servidores foram encerrados.${RESET}"
    echo ""
    exit 0
}
trap cleanup SIGINT SIGTERM

# -----------------------------------------------------------
# 1. Servidor RVC (rvc_python — porta 5050)
# -----------------------------------------------------------
echo -e "${BOLD}[1/3]${RESET} ${YELLOW}RVC (PTH) desativado para economizar RAM${RESET}..."
# "$PYTHON" "$PROJECT_DIR/servidor_rvc.py" \
#     > "$LOG_DIR/rvc.log" 2>&1 &
# PID_RVC=$!
# PIDS+=("$PID_RVC")
# echo -e "      PID: ${CYAN}$PID_RVC${RESET} | Log: ${YELLOW}.logs/rvc.log${RESET}"

# -----------------------------------------------------------
# 2. Servidor RVC-ONNX (porta 5051)
# -----------------------------------------------------------
echo -e "${BOLD}[2/3]${RESET} Iniciando ${GREEN}RVC-ONNX${RESET} (porta 5051)..."
"$PYTHON" "$PROJECT_DIR/servidor_rvc_onnx.py" \
    > "$LOG_DIR/rvc_onnx.log" 2>&1 &
PID_ONNX=$!
PIDS+=("$PID_ONNX")
echo -e "      PID: ${CYAN}$PID_ONNX${RESET} | Log: ${YELLOW}.logs/rvc_onnx.log${RESET}"

# -----------------------------------------------------------
# 3. Servidor Node.js (porta 3000)
# -----------------------------------------------------------
echo -e "${BOLD}[3/3]${RESET} Iniciando ${GREEN}Node.js${RESET} (porta 3000)..."
cd "$PROJECT_DIR"
node server.js > "$LOG_DIR/node.log" 2>&1 &
PID_NODE=$!
PIDS+=("$PID_NODE")
echo -e "      PID: ${CYAN}$PID_NODE${RESET} | Log: ${YELLOW}.logs/node.log${RESET}"

# -----------------------------------------------------------
# Status final
# -----------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}✓ Todos os servidores iniciados!${RESET}"
echo -e "${CYAN}──────────────────────────────────────────${RESET}"
echo -e "  📺  OBS Overlay : ${BOLD}http://localhost:3000/overlay.html${RESET}"
echo -e "  🛠️   Admin Panel : ${BOLD}http://localhost:3000/admin.html${RESET}"
echo -e "  🎙️   RVC         : ${BOLD}http://localhost:5050${RESET}"
echo -e "  ⚡  RVC-ONNX    : ${BOLD}http://localhost:5051${RESET}"
echo -e "${CYAN}──────────────────────────────────────────${RESET}"
echo -e "  Pressione ${BOLD}Ctrl+C${RESET} para encerrar tudo."
echo ""

# --- Aguarda qualquer processo terminar inesperadamente ---
while true; do
    for pid in "${PIDS[@]}"; do
        if ! kill -0 "$pid" 2>/dev/null; then
            echo -e "${RED}⚠ Processo $pid encerrou inesperadamente!${RESET}"
            echo -e "  Verifique os logs em ${YELLOW}.logs/${RESET}"
            cleanup
        fi
    done
    sleep 3
done
