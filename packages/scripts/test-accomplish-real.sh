#!/bin/bash

# Script para probar el endpoint real de accomplish
# Verifica que el chat envíe mensajes al backend y reciba respuestas con OpenCode

echo "=== Prueba de Accomplish Real (con OpenCode) ==="
echo ""

# 1. Login para obtener token
echo "1. Login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rdfinanzas@gmail.com","password":"rd130581"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Error: No se pudo obtener el token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "Token obtenido: ${TOKEN:0:20}..."
echo ""

# 2. Verificar que la API key de DeepSeek está configurada
echo "2. Verificando API key de DeepSeek..."
API_KEY_STATUS=$(curl -s http://localhost:3000/api/v1/admin/api-keys/status \
  -H "Authorization: Bearer $TOKEN")

echo "API Keys status: $API_KEY_STATUS"
echo ""

# 3. Crear tarea real
echo "3. Creando tarea real de accomplish..."
TASK_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/rdfinanzas/accomplish/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prompt":"¿Qué hora es?"}')

echo "Response: $TASK_RESPONSE"
echo ""

# Extraer task ID
TASK_ID=$(echo $TASK_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TASK_ID" ] || [ "$TASK_ID" = "null" ]; then
  echo "Error: No se pudo crear la tarea"
  exit 1
fi

echo "Task ID: $TASK_ID"
echo ""

# 4. Escuchar eventos SSE (timeout de 30 segundos)
echo "4. Escuchando eventos SSE (30 segundos)..."
echo "   Presiona Ctrl+C para detener"
echo ""

timeout 30 curl -N http://localhost:3000/api/v1/rdfinanzas/accomplish/tasks/$TASK_ID/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"

echo ""
echo "=== Prueba completada ==="
