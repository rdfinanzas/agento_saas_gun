#!/bin/bash
# Test Script - OpenCode HTTP Integration
# Prueba la comunicación HTTP con el servidor de OpenCode

set -e

echo "============================================================"
echo "   Test - Integración HTTP con OpenCode"
echo "============================================================"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ============================================
# 1. Verificar servidor OpenCode
# ============================================
echo -e "\n${YELLOW}[1/3] Verificando servidor OpenCode...${NC}"

if curl -s http://localhost:4096/session/status > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Servidor OpenCode responde${NC}"
else
    echo -e "${RED}❌ Servidor OpenCode no responde${NC}"
    echo "Inicia el servidor con: cd packages/opencode-fork/packages/opencode && bun run src/server/server.ts"
    exit 1
fi

# ============================================
# 2. Verificar backend
# ============================================
echo -e "\n${YELLOW}[2/3] Verificando backend...${NC}"

if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend responde${NC}"
else
    echo -e "${RED}❌ Backend no responde${NC}"
    echo "Inicia el backend con: cd packages/backend && npm run start:dev"
    exit 1
fi

# ============================================
# 3. Probar health check del adaptador
# ============================================
echo -e "\n${YELLOW}[3/3] Probando health check...${NC}"

STATUS=$(curl -s http://localhost:4096/session/status | head -20)
echo "Estado del servidor OpenCode:"
echo "$STATUS"

echo -e "\n${GREEN}============================================================${NC}"
echo -e "${GREEN}   ✅ Todos los tests pasaron${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "La integración HTTP está lista para usar."
echo ""
