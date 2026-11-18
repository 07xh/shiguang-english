#!/usr/bin/env python3
"""Structural diagnostics for authorized offline paper JSON; never log copyrighted passages."""
import json
from pathlib import Path

root = Path("app/src/main/assets/university")
index = json.loads((root / "content-index.json").read_text(encoding="utf-8"))
for row in index["entries"]:
    print("PAPER", row["level"], row["id"])
    for module, rel_path in row["modules"].items():
        obj = json.loads((root / rel_path).read_text(encoding="utf-8-sig"))
        node = obj.get(module, obj) if isinstance(obj, dict) else obj
        print(" ", module, "ROOT", type(node).__name__, "COUNT",
              len(node) if isinstance(node, (list, dict)) else 0)
        def inspect(value, label, depth):
            if depth > 2:
                return
            if isinstance(value, list):
                print("   ",label,"LIST",len(value))
                if value: inspect(value[0], label + "[0]", depth + 1)
            elif isinstance(value, dict):
                print("   ",label,"KEYS",",".join(str(k) for k in list(value.keys())[:26]))
                for k in list(value.keys())[:7]:
                    v = value[k]
                    if isinstance(v, (list, dict)):
                        inspect(v, label + "." + str(k), depth + 1)
        inspect(node, module, 0)
