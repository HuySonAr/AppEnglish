from __future__ import annotations

import argparse
import csv
import json
import math
import os
import random
import sys
import time

FIELDS = ("accuracy", "completeness", "fluency", "total")


def _ranks(values: list[float]) -> list[float]:
    order = sorted(range(len(values)), key=lambda index: values[index])
    ranks = [0.0] * len(values)
    position = 0
    while position < len(order):
        end = position
        while end + 1 < len(order) and values[order[end + 1]] == values[order[position]]:
            end += 1
        rank = (position + end) / 2 + 1
        for index in order[position : end + 1]:
            ranks[index] = rank
        position = end + 1
    return ranks


def pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 2:
        return None
    mean_x, mean_y = sum(xs) / n, sum(ys) / n
    cov = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    var_x = sum((x - mean_x) ** 2 for x in xs)
    var_y = sum((y - mean_y) ** 2 for y in ys)
    if var_x == 0 or var_y == 0:
        return None
    return cov / math.sqrt(var_x * var_y)


def spearman(xs: list[float], ys: list[float]) -> float | None:
    return pearson(_ranks(xs), _ranks(ys))


def mae(xs: list[float], ys: list[float]) -> float | None:
    return sum(abs(x - y) for x, y in zip(xs, ys)) / len(xs) if xs else None


def compare(rows: list[dict], fields=FIELDS) -> dict:
    report = {}
    for field in fields:
        pairs = [(row["system"][field], row["expert"][field]) for row in rows if row["system"].get(field) is not None and row["expert"].get(field) is not None]
        ours, theirs = [pair[0] for pair in pairs], [pair[1] for pair in pairs]
        report[field] = {
            "n": len(pairs),
            "pearson": _round(pearson(ours, theirs)),
            "spearman": _round(spearman(ours, theirs)),
            "mae": _round(mae(ours, theirs)),
        }
    return report


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, 3)


def load_speechocean(root: str, split: str = "test") -> list[dict]:
    with open(os.path.join(root, "resource", "scores.json"), encoding="utf-8") as file:
        scores = json.load(file)
    wanted = None
    text_file = os.path.join(root, split, "text")
    if os.path.exists(text_file):
        with open(text_file, encoding="utf-8") as file:
            wanted = {line.split(maxsplit=1)[0] for line in file if line.strip()}
    audio = {}
    for folder, _, files in os.walk(os.path.join(root, "WAVE")):
        for name in files:
            if name.lower().endswith(".wav"):
                audio[os.path.splitext(name)[0]] = os.path.join(folder, name)
    items = []
    for utt, entry in scores.items():
        if (wanted is not None and utt not in wanted) or utt not in audio:
            continue
        completeness = float(entry.get("completeness", 0))
        items.append(
            {
                "id": utt,
                "audio": audio[utt],
                "text": entry["text"],
                "expert": {
                    "accuracy": float(entry["accuracy"]),
                    "completeness": completeness * 10 if completeness <= 1 else completeness,
                    "fluency": float(entry["fluency"]),
                    "total": float(entry["total"]),
                },
            }
        )
    return sorted(items, key=lambda item: item["id"])


def sample(items: list[dict], limit: int, seed: int) -> list[dict]:
    chosen = list(items)
    random.Random(seed).shuffle(chosen)
    return sorted(chosen[:limit], key=lambda item: item["id"])


def run(items: list[dict], transcribe, score) -> list[dict]:
    rows = []
    for index, item in enumerate(items, start=1):
        started = time.time()
        words = transcribe(item["audio"], "en", "")
        result = score(item["text"], words) if words else {"scores": {field: 0.0 for field in FIELDS}}
        rows.append({"id": item["id"], "text": item["text"], "expert": item["expert"], "system": result["scores"], "seconds": round(time.time() - started, 2)})
        print(f"{index}/{len(items)} {item['id']}: system {result['scores']['total']} expert {item['expert']['total']}", file=sys.stderr)
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Compare read-aloud scores with Speechocean762 expert scores")
    parser.add_argument("--root", required=True, help="Folder of the speechocean762 repository (resource/scores.json and WAVE/)")
    parser.add_argument("--split", default="test")
    parser.add_argument("--limit", type=int, default=150)
    parser.add_argument("--seed", type=int, default=762)
    parser.add_argument("--out", default="speechocean762-report")
    args = parser.parse_args(argv)

    from .config import load_settings
    from .speaking import score_read_aloud
    from .transcriber import Transcriber

    settings = load_settings()
    items = sample(load_speechocean(args.root, args.split), args.limit, args.seed)
    if not items:
        print("No samples found; check --root and --split", file=sys.stderr)
        return 1
    rows = run(items, Transcriber(settings), score_read_aloud)
    report = {"dataset": "speechocean762", "split": args.split, "seed": args.seed, "model": settings.whisper_model, "samples": len(rows), "metrics": compare(rows)}
    with open(f"{args.out}.json", "w", encoding="utf-8") as file:
        json.dump(report, file, indent=2)
    with open(f"{args.out}.csv", "w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["id", *[f"system_{field}" for field in FIELDS], *[f"expert_{field}" for field in FIELDS], "text"])
        for row in rows:
            writer.writerow([row["id"], *[row["system"].get(field) for field in FIELDS], *[row["expert"][field] for field in FIELDS], row["text"]])
    print(json.dumps(report["metrics"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
