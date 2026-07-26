#!/usr/bin/env python3
"""store/listing.md のコードブロックが Play Console の文字数上限に収まっているか検証する。

使い方: python3 store/check_listing.py
"""
import re
import sys
from pathlib import Path

LIMITS = [
    ("アプリ名", 30),
    ("簡単な説明", 80),
    ("詳しい説明", 4000),
]

md = (Path(__file__).parent / "listing.md").read_text(encoding="utf-8")

ok = True
for name, limit in LIMITS:
    # 「## <名前>（上限N文字）」の直後から次の見出しまでの ``` ブロックを拾う
    section = re.search(rf"^## {re.escape(name)}（[^\n]*\n(.*?)(?=^## |\Z)", md,
                        re.S | re.M)
    if not section:
        print(f"NG  {name}: セクションが見つかりません")
        ok = False
        continue
    blocks = re.findall(r"```\n(.*?)\n```", section.group(1), re.S)
    if not blocks:
        print(f"NG  {name}: コードブロックが見つかりません")
        ok = False
        continue
    for i, body in enumerate(blocks):
        n = len(body)
        mark = "OK " if n <= limit else "NG "
        if n > limit:
            ok = False
        label = name if i == 0 else f"{name}（案{i + 1}）"
        print(f"{mark}{label}: {n} / {limit} 文字")

sys.exit(0 if ok else 1)
