# Iotvex Assistant

**Голосовой помощник для умного дома Iotvex**  
Wake word: **Alexa** / **Алекса** · Женский русский голос · RU + EN

---

## Содержание / Contents

- [Быстрый старт (RU)](#быстрый-старт)
- [Quick Start (EN)](#quick-start)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Supported Intents](#supported-intents)
- [Architecture](#architecture)
- [Roadmap](#roadmap)

---

## Быстрый старт

### 1. Требования

- Python 3.10+
- Интернет-соединение (edge-tts использует Microsoft Neural TTS)
- Доступ к серверу умного дома Iotvex

### 2. Установка

```bash
cd assistant

# Создать виртуальное окружение
python3 -m venv .venv
source .venv/bin/activate

# Установить зависимости
pip install -r requirements.txt
```

### 3. Настройка

```bash
cp .env.example .env
# Отредактируйте .env:
#   IOTVEX_WWW_URL=http://95.31.206.51
#   IOTVEX_TOKEN=your_service_token_here
nano .env
```

### 4. Запуск

```bash
# Простой запуск
bash scripts/run.sh

# С кастомным портом
bash scripts/run.sh --port 8777

# Режим отладки (с hot-reload)
bash scripts/run.sh --debug
```

Сервис запустится на `http://0.0.0.0:8777`.  
Документация API: `http://localhost:8777/docs`

### 5. Тест

```bash
# Проверка здоровья
curl http://localhost:8777/health

# Голосовая команда (текст)
curl -X POST http://localhost:8777/v1/text \
  -H "Content-Type: application/json" \
  -d '{"text": "Алекса, включи свет"}'

# Без аудио в ответе
curl -X POST http://localhost:8777/v1/text \
  -H "Content-Type: application/json" \
  -d '{"text": "Алекса, яркость 70%", "include_audio": false}'
```

---

## Quick Start

### Requirements

- Python 3.10+
- Internet connection (edge-tts uses Microsoft Neural TTS — online)
- Access to your Iotvex smart home server

### Install & Run

```bash
cd assistant

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env: set IOTVEX_WWW_URL and IOTVEX_TOKEN

bash scripts/run.sh
```

### Test

```bash
# Health check
curl http://localhost:8777/health

# Turn on lights (English)
curl -X POST http://localhost:8777/v1/text \
  -H "Content-Type: application/json" \
  -d '{"text": "Alexa turn on the lights"}'

# Set rainbow effect
curl -X POST http://localhost:8777/v1/text \
  -H "Content-Type: application/json" \
  -d '{"text": "Alexa rainbow effect"}'
```

---

## API Reference

### `GET /health`

Returns service status, TTS/STT/LLM capability info, uptime.

### `POST /v1/text`

**Body**
```json
{
  "text": "Алекса, включи левую ленту",
  "include_audio": true
}
```

**Response**
```json
{
  "reply": "Хорошо, включаю свет (левую ленту)!",
  "intent": "lights_on",
  "confidence": 0.95,
  "lang": "ru",
  "entities": { "target": "left" },
  "actions": [
    { "action": "lights_on", "strip": "left", "success": true, "backend": "www" }
  ],
  "audio_b64": "<base64 MP3 of the spoken reply>"
}
```

`audio_b64` is an MP3 file encoded as base64. Decode and play with any audio player.  
Set `include_audio: false` to skip TTS and save bandwidth.

### `POST /v1/audio`

Multipart form with field `audio` (wav / webm / ogg / mp3).  
Requires `STT_BACKEND=whisper` (see STT section).  
Returns the same response shape as `/v1/text`, plus `stt_text`.

### `GET /v1/voices`

Returns available TTS voices.

---

## Configuration

All settings are read from environment variables or `.env` file.

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8777` | Listen port |
| `IOTVEX_WWW_URL` | `http://127.0.0.1` | Iotvex www server |
| `IOTVEX_AGENT_URL` | _(unset)_ | Direct agent URL (optional) |
| `IOTVEX_TOKEN` | _(unset)_ | Bearer token for home API |
| `TTS_VOICE_RU` | `ru-RU-SvetlanaNeural` | Russian female TTS voice |
| `TTS_VOICE_EN` | `en-US-JennyNeural` | English female TTS voice |
| `TTS_INCLUDE_AUDIO` | `true` | Include base64 audio in responses |
| `STT_BACKEND` | `stub` | `stub` / `whisper` / `vosk` |
| `WHISPER_MODEL` | `base` | Whisper model size (tiny/base/small/medium) |
| `LLM_ENABLED` | `false` | Enable Ollama LLM hook |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `gemma2:2b` | Ollama model tag |

---

## Supported Intents

### Русские команды

| Команда | Пример |
|---|---|
| Включить свет | «Алекса, включи свет» |
| Выключить свет | «Алекса, выключи все ленты» |
| Яркость | «Алекса, яркость 70%» |
| Цвет | «Алекса, красный цвет» / «Алекса, тёплый белый» |
| Эффект | «Алекса, радуга» / «Алекса, эффект дыхание» |
| Левая/правая лента | «Алекса, включи левую ленту» |
| Привет | «Алекса, привет» |
| Помощь | «Алекса, помощь» |
| Статус | «Алекса, статус» |

### English commands

| Command | Example |
|---|---|
| Turn on lights | "Alexa turn on the lights" |
| Turn off lights | "Alexa turn off all strips" |
| Brightness | "Alexa set brightness to 60%" |
| Color | "Alexa red color" / "Alexa warm white" |
| Effect | "Alexa rainbow" / "Alexa set effect fire" |
| Left/right strip | "Alexa turn on the right strip" |
| Greeting | "Alexa hello" |
| Help | "Alexa help" |
| Status | "Alexa status" |

### Цвета / Colors

`красный` / `red`, `оранжевый` / `orange`, `жёлтый` / `yellow`,
`зелёный` / `green`, `голубой` / `cyan`, `синий` / `blue`,
`фиолетовый` / `purple`, `розовый` / `pink`, `белый` / `white`,
`тёплый белый` / `warm white`, `холодный белый` / `cool white`

### Эффекты / Effects

`радуга` / `rainbow`, `дыхание` / `breathing`, `пульс` / `pulse`,
`бегущий` / `chase`, `огонь` / `fire`, `статичный` / `solid`,
`мигание` / `blink`, `мерцание` / `twinkle`

---

## TTS — Голос

По умолчанию используется **ru-RU-SvetlanaNeural** (Microsoft Neural, женский русский голос).  
Сервис требует интернет-соединения для синтеза речи.

Для офлайн-работы замените на `pyttsx3` или `vosk-tts` (не включены, нужна доустановка).

Список голосов: `GET /v1/voices` или `edge-tts --list-voices | grep ru-RU`.

---

## STT — Распознавание речи

По умолчанию STT отключён (`STT_BACKEND=stub`).  
Эндпоинт `/v1/audio` вернёт ошибку с инструкцией по установке.

**Включить Whisper:**
```bash
pip install openai-whisper
# В .env:
STT_BACKEND=whisper
WHISPER_MODEL=base  # или small/medium для лучшего качества
```

**Включить Vosk (офлайн, быстрее):**
```bash
pip install vosk
# Скачать русскую модель:
mkdir -p models
wget https://alphacephei.com/vosk/models/vosk-model-ru-0.42.zip
unzip vosk-model-ru-0.42.zip -d models/
# В .env:
STT_BACKEND=vosk
VOSK_MODEL_PATH=models/vosk-model-ru-0.42
```

---

## LLM — Опциональная языковая модель

LLM подключается к локальному [Ollama](https://ollama.com) и используется,
если правила NLU не распознали команду с достаточной уверенностью.

```bash
# Установить Ollama: https://ollama.com/download
ollama serve
ollama pull gemma2:2b   # или mistral:7b, llama3.2:3b

# В .env:
LLM_ENABLED=true
OLLAMA_MODEL=gemma2:2b
```

---

## Architecture

```
POST /v1/text
     │
     ▼
 NLU (nlu.py)
 ├─ strip wake word (Alexa/Алекса/…)
 ├─ detect language (RU/EN)
 ├─ match intent patterns
 └─ extract entities (target, brightness, color, effect)
     │
     ▼  (if conf < threshold and LLM enabled)
 LLM (llm.py) ──► Ollama /api/chat
     │
     ▼
 Home action (home.py) ──► IOTVEX_WWW_URL /api/iotvex/strips/{index}
     │
     ▼
 Reply text (voice.py — _format_reply)
     │
     ▼
 TTS (tts.py) ──► edge-tts ru-RU-SvetlanaNeural
             └──► gTTS fallback
     │
     ▼
 JSON response { reply, intent, entities, actions, audio_b64 }
```

---

## Roadmap

- [ ] Microphone input via WebSocket (real-time wake-word detection)
- [ ] Vosk wake-word detector (offline Porcupine alternative)
- [ ] Persistent conversation context
- [ ] Home state query (current brightness/color read-back)
- [ ] Multi-room / multi-zone strip groups
- [ ] Offline TTS (Silero TTS for Russian)

---

## License

MIT — Iotvex internal project.
