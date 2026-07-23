
insert into public.areas (id, name, icon, sort_order) values
  ('living_room', 'Гостиная', 'sofa', 10),
  ('hall', 'Коридор', 'door-open', 20),
  ('kitchen', 'Кухня', 'utensils', 30),
  ('bedroom', 'Спальня', 'bed', 40),
  ('outdoor', 'Улица', 'tree-pine', 50)
on conflict (id) do update set name = excluded.name, icon = excluded.icon, sort_order = excluded.sort_order;

insert into public.devices (id, name, manufacturer, model, area_id, platform, external_id, meta)
values (
  'a0000000-0000-4000-8000-000000000001',
  'Living room light',
  'Iotvex',
  'living-room-light',
  'living_room',
  'iotvex',
  'living-room-light',
  '{"strip_count": 2}'::jsonb
),
(
  'a0000000-0000-4000-8000-00004c525733',
  'Living Room Weather',
  'Iotvex',
  'living-room-weather-station',
  'living_room',
  'iotvex',
  '1280464691',
  '{}'::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  area_id = excluded.area_id,
  model = excluded.model,
  meta = excluded.meta;

insert into public.entities (id, device_id, domain, name, area_id, capabilities, attributes) values
  (
    'light.living_room_strip_0',
    'a0000000-0000-4000-8000-000000000001',
    'light',
    'Гостиная — лента 0',
    'living_room',
    array['on_off','brightness','color','effect'],
    '{"strip_index":0,"platform":"iotvex","supported_color_modes":["rgb","brightness"]}'::jsonb
  ),
  (
    'light.living_room_strip_1',
    'a0000000-0000-4000-8000-000000000001',
    'light',
    'Гостиная — лента 1',
    'living_room',
    array['on_off','brightness','color','effect'],
    '{"strip_index":1,"platform":"iotvex","supported_color_modes":["rgb","brightness"]}'::jsonb
  ),
  (
    'sensor.living_room_temperature',
    null,
    'sensor',
    'Температура гостиной',
    'living_room',
    array['temperature','value'],
    '{"platform":"demo","unit_of_measurement":"°C"}'::jsonb
  ),
  (
    'sensor.living_room_humidity',
    null,
    'sensor',
    'Влажность гостиной',
    'living_room',
    array['humidity','value'],
    '{"platform":"demo","unit_of_measurement":"%"}'::jsonb
  ),
  (
    'sensor.hall_illuminance',
    null,
    'sensor',
    'Освещённость коридора',
    'hall',
    array['value'],
    '{"platform":"demo","unit_of_measurement":"lx"}'::jsonb
  ),
  (
    'binary_sensor.front_door',
    null,
    'binary_sensor',
    'Входная дверь',
    'hall',
    array['binary'],
    '{"platform":"demo"}'::jsonb
  ),
  (
    'binary_sensor.motion_hall',
    null,
    'binary_sensor',
    'Движение коридор',
    'hall',
    array['binary'],
    '{"platform":"demo"}'::jsonb
  ),
  (
    'weather.home',
    null,
    'weather',
    'Погода',
    'outdoor',
    array['value'],
    '{"platform":"demo"}'::jsonb
  ),
  (
    'person.xlebpushek',
    null,
    'person',
    'xlebpushek',
    'living_room',
    array['value'],
    '{"platform":"demo"}'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  area_id = excluded.area_id,
  capabilities = excluded.capabilities,
  attributes = excluded.attributes,
  device_id = excluded.device_id;

insert into public.entity_states (entity_id, state, attributes, available) values
  ('sensor.living_room_temperature', '23.4', '{"unit_of_measurement":"°C"}'::jsonb, true),
  ('sensor.living_room_humidity', '41', '{"unit_of_measurement":"%"}'::jsonb, true),
  ('sensor.hall_illuminance', '86', '{"unit_of_measurement":"lx"}'::jsonb, true),
  ('binary_sensor.front_door', 'off', '{}'::jsonb, true),
  ('binary_sensor.motion_hall', 'off', '{}'::jsonb, true),
  ('weather.home', 'partlycloudy', '{}'::jsonb, true),
  ('person.xlebpushek', 'home', '{}'::jsonb, true)
on conflict (entity_id) do update set state = excluded.state, attributes = excluded.attributes;

insert into public.automations (id, name, description, enabled, trigger, conditions, actions, mode, ha_entity_id)
values (
  'iotvex_light_1700',
  'Свет в 17:00',
  'Единая автоматизация (SoT: Supabase)',
  true,
  '{"trigger":"time","at":"17:00:00"}'::jsonb,
  '[]'::jsonb,
  '[{"action":"light.turn_on","target":{"entity_id":["light.living_room_strip_0","light.living_room_strip_1"]},"data":{"rgb_color":[255,116,116],"brightness_pct":50,"effect":0}}]'::jsonb,
  'single',
  'automation.svet_v_17_00'
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  enabled = excluded.enabled,
  trigger = excluded.trigger,
  actions = excluded.actions,
  ha_entity_id = excluded.ha_entity_id;

insert into public.scripts (id, name, description, sequence) values
  ('script_good_night', 'Спокойной ночи', 'Выключить свет', '[{"action":"light.turn_off","target":{"entity_id":"light.living_room_strip_0"}},{"action":"light.turn_off","target":{"entity_id":"light.living_room_strip_1"}}]'::jsonb),
  ('script_guest_mode', 'Гостевой режим', 'Мягкий свет', '[{"action":"light.turn_on","target":{"entity_id":"light.living_room_strip_0"},"data":{"brightness_pct":40}}]'::jsonb)
on conflict (id) do update set name = excluded.name, sequence = excluded.sequence;

insert into public.scenes (id, name, description, entities, area_id) values
  ('scene_evening', 'Вечер', '', '{"light.living_room_strip_0":{"state":"on","brightness_pct":45,"rgb_color":[255,160,80]},"light.living_room_strip_1":{"state":"on","brightness_pct":30}}'::jsonb, 'living_room'),
  ('scene_movie', 'Кино', '', '{"light.living_room_strip_0":{"state":"on","brightness_pct":15,"rgb_color":[120,40,180]},"light.living_room_strip_1":{"state":"off"}}'::jsonb, 'living_room'),
  ('scene_away', 'Никого нет', '', '{"light.living_room_strip_0":{"state":"off"},"light.living_room_strip_1":{"state":"off"}}'::jsonb, null)
on conflict (id) do update set name = excluded.name, entities = excluded.entities, area_id = excluded.area_id;
