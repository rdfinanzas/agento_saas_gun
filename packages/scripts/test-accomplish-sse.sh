#!/bin/bash

# Script para probar el endpoint de SSE de accomplish
# Prueba que el chat envía mensajes al backend y recibe respuestas vía SSE

echo "=== Prueba de Accomplish SSE ==="
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

# 2. Crear tarea de prueba con SSE
echo "2. Creando tarea de prueba..."
TASK_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/rdfinanzas/accomplish/test-sse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"Hola mundo"}')

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

# 3. Escuchar eventos SSE (timeout de 10 segundos)
echo "3. Escuchando eventos SSE (10 segundos)..."
echo "   Presiona Ctrl+C para detener"
echo ""

timeout 10 curl -N http://localhost:3000/api/v1/rdfinanzas/accomplish/tasks/$TASK_ID/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"

echo ""
echo "=== Prueba completada ==="
