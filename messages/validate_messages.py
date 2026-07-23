#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
LOCALES = ("en", "ru")
KEYS_FILE = BASE_DIR / "_keys.txt"


def load(locale: str) -> dict[str, Any]:
    with (BASE_DIR / f"{locale}.json").open(encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, dict):
        raise TypeError(f"{locale}.json root must be an object")
    return data


def dotted_keys(value: Any, prefix: str = "") -> list[str]:
    if isinstance(value, dict):
        keys: list[str] = []
        for key in sorted(value):
            next_prefix = f"{prefix}.{key}" if prefix else key
            keys.extend(dotted_keys(value[key], next_prefix))
        return keys
    return [prefix]


def main() -> None:
    catalogs = {locale: load(locale) for locale in LOCALES}
    key_sets = {locale: set(dotted_keys(catalog)) for locale, catalog in catalogs.items()}

    reference_locale = LOCALES[0]
    reference_keys = key_sets[reference_locale]
    for locale in LOCALES[1:]:
        missing = sorted(reference_keys - key_sets[locale])
        extra = sorted(key_sets[locale] - reference_keys)
        if missing or extra:
            details = []
            if missing:
                details.append(f"{locale}.json missing: {missing}")
            if extra:
                details.append(f"{locale}.json extra: {extra}")
            raise AssertionError("; ".join(details))

    keys = sorted(reference_keys)
    KEYS_FILE.write_text("\n".join(keys) + "\n", encoding="utf-8")

    for locale in LOCALES:
        print(f"{locale}: {len(key_sets[locale])} keys")
    print(f"namespaces: {', '.join(sorted(catalogs[reference_locale]))}")
    print(f"wrote: {KEYS_FILE}")


if __name__ == "__main__":
    main()
