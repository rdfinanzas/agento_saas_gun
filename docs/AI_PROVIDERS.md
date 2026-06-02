# URLs de Proveedores de IA

## Endpoints

| Proveedor | URL Base |
|-----------|----------|
| OpenAI | https://api.openai.com |
| Anthropic | https://api.anthropic.com |
| Google AI | https://generativelanguage.googleapis.com |
| xAI | https://api.x.ai |
| DeepSeek | https://api.deepseek.com |
| Moonshot | https://api.moonshot.cn/v1 |
| Kimi Coding | https://api.kimi.com/coding |
| Z.AI | https://open.bigmodel.cn |
| MiniMax | https://api.minimax.io |
| OpenCode | https://api.opencode.ai/v1 |
| Ollama | http://localhost:11434 |
| LM Studio | http://localhost:1234/v1 |

## curl

### OpenAI
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Anthropic
```bash
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-3-5-sonnet-20241022", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello"}]}'
```

### Google AI
```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GOOGLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'
```

### xAI
```bash
curl -X POST https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "grok-4", "messages": [{"role": "user", "content": "Hello"}]}'
```

### DeepSeek
```bash
curl -X POST https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Moonshot
```bash
curl -X POST https://api.moonshot.cn/v1/chat/completions \
  -H "Authorization: Bearer $MOONSHOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "kimi-k2.5", "messages": [{"role": "user", "content": "Hello"}]}'
```

### MiniMax
```bash
curl -X POST https://api.minimax.io/v1/text/chatcompletion_v2 \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "MiniMax-M2.5", "messages": [{"role": "user", "content": "Hello"}]}'
```

### OpenCode
```bash
curl -X POST https://api.opencode.ai/v1/chat/completions \
  -H "Authorization: Bearer $OPENCODE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "opencode/big-pickle", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Z.AI
```bash
curl -X POST https://open.bigmodel.cn/api/paas/v4/chat/completions \
  -H "Authorization: Bearer $ZAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "glm-4.7-flashx", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Ollama
```bash
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model": "llama2", "messages": [{"role": "user", "content": "Hello"}]}'
```