#!/bin/bash
# ===========================================
# AgenTo - Deploy Script para VPS
# ===========================================
# Uso: copiar este proyecto al VPS y ejecutar:
#   chmod +x deploy.sh && ./deploy.sh
# ===========================================

set -e

echo "==========================================="
echo "  AgenTo - Deploy to VPS"
echo "==========================================="

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo "Instalando Docker Compose plugin..."
    apt-get update
    apt-get install -y docker-compose-plugin
fi

# Create storage directory
mkdir -p storage

# Generate JWT secret if not changed
if grep -q "change-this-to-a-secure-random-string" .env.production; then
    echo "Generando JWT_SECRET seguro..."
    JWT_SECRET=$(openssl rand -base64 48)
    sed -i "s/sk-agento-prod-2024-change-this-to-a-secure-random-string-at-least-32-characters/$JWT_SECRET/" .env.production
    echo "JWT_SECRET generado automaticamente"
fi

# Build and start
echo ""
echo "Construyendo contenedores..."
docker compose build

echo ""
echo "Iniciando servicios..."
docker compose up -d

echo ""
echo "Esperando a que PostgreSQL este listo..."
sleep 10

# Run migrations
echo "Ejecutando migraciones..."
docker compose exec server bun run db:migrate || echo "Nota: Si falla, ejecutar manualmente: docker compose exec server bun run db:migrate"

# Seed templates
echo "Cargando templates..."
docker compose exec server bun run scripts/seed-templates.ts || echo "Nota: Si falla, ejecutar manualmente: docker compose exec server bun run scripts/seed-templates.ts"

echo ""
echo "==========================================="
echo "  Deploy completado!"
echo "==========================================="
echo ""
echo "  Frontend:  http://69.62.90.206:3000"
echo "  API:       http://69.62.90.206:3001"
echo "  Health:    http://69.62.90.206:3001/health"
echo ""
echo "  Webhook Evolution API:"
echo "    URL: http://69.62.90.206:3001/api/whatsapp/evolution/webhook"
echo ""
echo "  Comandos utiles:"
echo "    docker compose logs -f          # Ver logs"
echo "    docker compose logs server -f   # Logs del server solo"
echo "    docker compose restart server   # Reiniciar server"
echo "    docker compose down             # Detener todo"
echo "==========================================="
