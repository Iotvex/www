# Iotvex × Яндекс Умный дом (Алиса)

Провайдер Smart Home встроен в WWW: REST `/v1.0/*` + минимальный OAuth `/oauth/*`.

## Что умеет

| Устройство | ID (стабильный) | Возможности |
|---|---|---|
| Левая / правая LED-лента | `light.living_room_strip_0/1` | on/off, яркость ≤70%, цвет RGB |
| Метеостанция (группа) | `sensor.living_room_weather` | температура, влажность, CO₂, освещённость, давление |

Голосовые примеры:

- «Алиса, включи левую ленту»
- «Алиса, поставь яркость правой ленты на 40»
- «Алиса, какая температура в гостиной?»
- «Алиса, какая влажность / какой CO₂ на метеостанции?»

## Публичный HTTPS (туннель)

На домашней машине в `www/config/runtime.json`:

```json
"bridge": {
  "exposeSmartHome": true,
  "exposeAssistant": false,
  "preferredProvider": "cloudflare_tunnel"
}
```

Затем:

```bash
python3 /home/xlebpushek/iotvex/www/scripts/publish-manager.py reconcile
```

Актуальный URL (быстрый Cloudflare tunnel, обновляется при `reconcile`) смотрите в `bridge.smartHomePublicUrl` / `bridge.wwwPublicUrl` и `config/publish-state.json`.

**Текущий публичный URL (на момент последней сверки):**

```
https://smtp-path-hon-pacific.trycloudflare.com
```

**Endpoint URL** в консоли Яндекс Диалогов (корень хоста — Яндекс сам добавляет `/v1.0/...`):

```
https://smtp-path-hon-pacific.trycloudflare.com
```

Локальная Alexa (`:18927`) **не** публикуется. Код `assistant/` сохранён; runtime выключен.

## OAuth (привязка аккаунта)

## Навык в Диалогах (готово)

| Поле | Значение |
|---|---|
| Имя | **Iotvex** |
| Skill ID | `65859e59-385d-4877-82e0-373e1a929fa8` |
| Статус | **опубликован**, **приватный** (`onAir=true`) |
| Консоль | https://dialogs.yandex.ru/developer/skills/65859e59-385d-4877-82e0-373e1a929fa8/settings/main |
| Endpoint | `https://smtp-path-hon-pacific.trycloudflare.com` (без `/v1.0`) |
| OAuth authorize | `https://smtp-path-hon-pacific.trycloudflare.com/oauth/authorize` |
| OAuth token | `https://smtp-path-hon-pacific.trycloudflare.com/oauth/token` |
| Client ID | `iotvex-yandex` |
| Client Secret | `www/config/yandex-smart-home.json` (host-only, mode 600) |

## Привязка в «Дом с Алисой» (точный клик-путь)

### 1. Открыть приложение / сайт

| Платформа | Ссылка |
|---|---|
| Android (Google Play) | https://play.google.com/store/apps/details?id=com.yandex.iot |
| Android (RuStore) | https://www.rustore.ru/catalog/app/com.yandex.iot |
| iPhone / iPad | https://apps.apple.com/ru/app/дом-с-алисой/id1582810683 |
| Браузер (без установки) | https://yandex.ru/iot |
| Обзор умного дома | https://alice.yandex.ru/smart-home |

Войдите **тем же Яндекс ID**, под которым опубликован навык Iotvex (см. консоль выше).

### 2. Добавить производителя Iotvex

1. Откройте https://yandex.ru/iot или приложение «Дом с Алисой».
2. **Устройства** → **Добавить устройство** (или «+»).
3. Раздел **производители** / **умный дом** / список брендов (не «по инструкции», не Zigbee).
4. Найдите **Iotvex** и нажмите.
5. На экране OAuth нажмите **только «Разрешить»** (authorize → `…/oauth/authorize`, token → `…/oauth/token` с HTTP Basic).
6. Вернитесь в дом → список устройств обновится сам; при необходимости **Обновить список устройств**.

Должны появиться: левая/правая лента + метеостанция.

> Token endpoint принимает `Authorization: Basic base64(client_id:client_secret)` — так шлёт Яндекс. Без Basic телефон показывает «ошибка при обмене данных».

### 3. Приватный навык — кому виден

- Консоль навыка: https://dialogs.yandex.ru/developer/skills/65859e59-385d-4877-82e0-373e1a929fa8/settings/main  
- Навык **опубликован и приватный** (`onAir=true`): в списке производителей **Iotvex виден только аккаунту, который его опубликовал** (и явным тестовым пользователям в консоли, если добавлены).  
- Другой Яндекс ID навык **не увидит**, пока его не сделают публичным или не добавят как тестера.

### 4. Endpoint / Cloudflare URL

Актуальный публичный URL: `https://smtp-path-hon-pacific.trycloudflare.com`  
Endpoint в навыке: `https://smtp-path-hon-pacific.trycloudflare.com` (без `/v1.0` — иначе Яндекс ходит на `/v1.0/v1.0/...` и Quasar пишет DISCOVERY_ERROR).  
OAuth: `…/oauth/authorize` и `…/oauth/token` на том же хосте.  
Rewrite на случай старого Endpoint: `/v1.0/v1.0/*` → `/v1.0/*`.

Проверка живости: `GET /v1.0` → 200. Если после `publish-manager.py reconcile` URL сменился — обновите Endpoint + OAuth в консоли навыка и значения в `runtime.json` / этом документе из `config/publish-state.json`.

Тестовые фразы:

- «Алиса, включи левую ленту»
- «Алиса, поставь яркость правой ленты на 40»
- «Алиса, какая температура в гостиной?»

Для локальных тестов без OAuth можно слать `Authorization: Bearer <IOTVEX_SERVICE_TOKEN>`.

## Проверка API

```bash
TOKEN=$(docker exec iotvex-www printenv IOTVEX_SERVICE_TOKEN)
curl -sS -H "Authorization: Bearer $TOKEN" http://127.0.0.1/v1.0/user/devices | jq .
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"devices":[{"id":"sensor.living_room_weather"}]}' \
  http://127.0.0.1/v1.0/user/devices/query | jq .
```

Яркость при action ограничена **70%** (потолок LED).

## Alexa runtime (выключен)

Остановлено / отключено:

- `systemctl --user` → `iotvex-alexa-wake.service` (disabled)
- Docker `iotvex-alexa`, `iotvex-ollama` (profile `alexa`, `restart: "no"`)
- Туннель Cloudflare на `:18927`
- FAB ассистента скрыт (`NEXT_PUBLIC_IOTVEX_VOICE_ASSISTANT_UI` не `1`)

Вернуть Alexa (не рекомендуется): `docker compose --profile alexa up -d` в `assistant/` + `IOTVEX_EXPOSE_ASSISTANT=1`.

## Голосовая активация «Алиса» в Яндекс Браузере на Linux

**Ограничение Яндекса:** фраза «Слушай, Алиса» работает **только в Windows**-сборке браузера. На Linux настройка «голосовая активация» может быть включена (`alice.voice_activation_enabled=true`), но continuous listen **не реализован**.

Кнопка микрофона в UI работает — это ожидаемо.

### Workaround: companion hotword

Сервис `iotvex-alice-wake` слушает USB-мик, Whisper распознаёт «Алиса», затем через `xdotool` открывает/фокусирует Яндекс Браузер и кликает по UI Алисы.

```bash
mkdir -p ~/.config/systemd/user
cp /home/xlebpushek/iotvex/www/scripts/alice-linux-wake/iotvex-alice-wake.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now iotvex-alice-wake.service
journalctl --user -u iotvex-alice-wake -f
```

Требования: сессия с `DISPLAY`, PipeWire, USB mic как default source, установленный `xdotool`, Whisper в `assistant/.venv`.

Статус: `/tmp/iotvex-alice-wake-status.json`.

Это **не** нативный always-on браузера; возможны ложные срабатывания Whisper и промахи клика по UI. Для надёжного умного дома без wake используйте колонку Алисы / телефон «Дом с Алисой» + этот провайдер.
