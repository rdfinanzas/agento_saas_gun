#!/bin/bash
# AgenTo SaaS - Development Startup Script
# Arquitectura: Backend (Bun) + Frontend (Next.js)
# OpenCode está integrado en el backend

set -e

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}   AgenTo SaaS - Iniciando servicios de desarrollo${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""

# Verificar Bun
if ! command -v bun &> /dev/null; then
    echo -e "${RED}[ERROR] Bun no está instalado. Instálalo desde https://bun.sh${NC}"
    exit 1
fi

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js no está instalado.${NC}"
    exit 1
fi

# Obtener el directorio del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Función para limpiar procesos al salir
cleanup() {
    echo ""
    echo -e "${YELLOW}Deteniendo servicios...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}Servicios detenidos.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ============================================
# 1. Iniciar Backend
# ============================================
echo -e "${YELLOW}[1/2] Iniciando Backend (Bun + Hono) en puerto 3000...${NC}"
cd "$SCRIPT_DIR/packages/server"
bun run dev &
BACKEND_PID=$!
echo -e "${GREEN}     ✅ Backend iniciado (PID: $BACKEND_PID)${NC}"

sleep 3

# ============================================
# 2. Iniciar Frontend
# ============================================
echo -e "${YELLOW}[2/2] Iniciando Frontend (Next.js) en puerto 3004...${NC}"
cd "$SCRIPT_DIR/packages/frontend"
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}     ✅ Frontend iniciado (PID: $FRONTEND_PID)${NC}"

sleep 2

# ============================================
# 3. Mostrar información
# ============================================
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}   Servicios iniciados correctamente${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${BLUE}    Backend:  http://localhost:3000${NC}"
echo -e "${BLUE}    Frontend: http://localhost:3004${NC}"
echo -e "${BLUE}    Health:   http://localhost:3000/health${NC}"
echo ""
echo -e "${YELLOW}    Presiona Ctrl+C para detener todos los servicios${NC}"
echo ""

# Mantener el script corriendo
wait
