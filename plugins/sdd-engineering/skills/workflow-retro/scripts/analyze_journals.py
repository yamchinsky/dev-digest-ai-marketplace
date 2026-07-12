#!/usr/bin/env python3
"""Aggregate Claude Code session journals for a workflow retrospective.

Usage:
    analyze_journals.py <session-journal.jsonl> [--shallow] [--json]

Reads the main session journal and (unless --shallow) every subagent journal
under <journal-dir>/<session-uuid>/subagents/agent-*.jsonl. Prints a compact
markdown summary (default) or JSON (--json).

Rules the numbers depend on:
- usage is deduplicated by message uuid (last occurrence wins) — streaming
  writes the same assistant message several times;
- tool calls are counted from the deduplicated messages only;
- cache-hit = cache_read / (input + cache_creation + cache_read);
- parallelism intervals come from agent meta.json start/end when present,
  else from the journal's first/last timestamps.

Offline by design: stdlib only, no network, no writes outside stdout.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from datetime import datetime, timezone

USAGE_KEYS = (
    "input_tokens",
    "output_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
)


def parse_ts(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def iter_jsonl(path):
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def analyze_journal(path, actor):
    """Return per-actor metrics for one journal file."""
    latest_msg_by_uuid = {}  # uuid -> message dict (last occurrence wins)
    first_ts = None
    last_ts = None

    for entry in iter_jsonl(path):
        ts = parse_ts(entry.get("timestamp"))
        if ts is not None:
            if first_ts is None or ts < first_ts:
                first_ts = ts
            if last_ts is None or ts > last_ts:
                last_ts = ts

        message = entry.get("message")
        uuid = entry.get("uuid")
        if isinstance(message, dict) and uuid:
            latest_msg_by_uuid[uuid] = message

    tokens = dict.fromkeys(USAGE_KEYS, 0)
    tool_calls = {}
    for message in latest_msg_by_uuid.values():
        usage = message.get("usage")
        if isinstance(usage, dict):
            for key in USAGE_KEYS:
                value = usage.get(key)
                if isinstance(value, (int, float)):
                    tokens[key] += int(value)
        content = message.get("content")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    name = block.get("name", "?")
                    tool_calls[name] = tool_calls.get(name, 0) + 1

    denominator = (
        tokens["input_tokens"]
        + tokens["cache_creation_input_tokens"]
        + tokens["cache_read_input_tokens"]
    )
    cache_hit = tokens["cache_read_input_tokens"] / denominator if denominator else 0.0

    return {
        "actor": actor,
        "journal": path,
        "tokens": tokens,
        "cache_hit": round(cache_hit, 4),
        "tool_calls": dict(sorted(tool_calls.items(), key=lambda kv: -kv[1])),
        "tool_calls_total": sum(tool_calls.values()),
        "first_ts": first_ts.isoformat() if first_ts else None,
        "last_ts": last_ts.isoformat() if last_ts else None,
        "duration_s": (last_ts - first_ts).total_seconds() if first_ts and last_ts else 0,
    }


def subagent_interval(journal_path, metrics):
    """[start, end] for parallelism; meta.json wins over journal timestamps."""
    meta_path = journal_path.replace(".jsonl", ".meta.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path, encoding="utf-8") as fh:
                meta = json.load(fh)
            start = parse_ts(meta.get("startTime") or meta.get("start_time"))
            end = parse_ts(meta.get("endTime") or meta.get("end_time"))
            if start and end:
                return start, end
        except (json.JSONDecodeError, OSError):
            pass
    start = parse_ts(metrics["first_ts"])
    end = parse_ts(metrics["last_ts"])
    return start, end


def parallelism(intervals):
    """Max simultaneous subagents + total wall-clock with none running in parallel."""
    intervals = [(s, e) for s, e in intervals if s and e and e > s]
    if not intervals:
        return {"max_parallel": 0, "serial_stretch_s": 0}

    events = []
    for start, end in intervals:
        events.append((start, 1))
        events.append((end, -1))
    events.sort(key=lambda item: (item[0], -item[1]))

    live = 0
    max_live = 0
    solo_start = None
    solo_total = 0.0
    for ts, delta in events:
        prev = live
        live += delta
        max_live = max(max_live, live)
        if live == 1 and prev != 1:
            solo_start = ts
        elif live != 1 and prev == 1 and solo_start is not None:
            solo_total += (ts - solo_start).total_seconds()
            solo_start = None

    return {"max_parallel": max_live, "serial_stretch_s": round(solo_total)}


def fmt_duration(seconds):
    seconds = int(seconds)
    if seconds >= 3600:
        return f"{seconds // 3600}h{(seconds % 3600) // 60:02d}m"
    if seconds >= 60:
        return f"{seconds // 60}m{seconds % 60:02d}s"
    return f"{seconds}s"


def to_markdown(result):
    lines = []
    lines.append(f"Mode: **{result['mode']}** · session journal: `{result['session_journal']}`")
    if result["mode"] == "shallow":
        lines.append("> shallow run — subagent tokens NOT counted (undercount).")
    lines.append("")
    lines.append("| Actor | In | Out | CacheCreate | CacheRead | Cache-hit | Tools | Duration |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for actor in result["actors"]:
        tokens = actor["tokens"]
        lines.append(
            "| {a} | {i:,} | {o:,} | {cc:,} | {cr:,} | {ch:.1%} | {tc} | {d} |".format(
                a=actor["actor"],
                i=tokens["input_tokens"],
                o=tokens["output_tokens"],
                cc=tokens["cache_creation_input_tokens"],
                cr=tokens["cache_read_input_tokens"],
                ch=actor["cache_hit"],
                tc=actor["tool_calls_total"],
                d=fmt_duration(actor["duration_s"]),
            )
        )
    totals = result["totals"]
    lines.append(
        "| **TOTAL** | {i:,} | {o:,} | {cc:,} | {cr:,} | {ch:.1%} | {tc} | — |".format(
            i=totals["input_tokens"],
            o=totals["output_tokens"],
            cc=totals["cache_creation_input_tokens"],
            cr=totals["cache_read_input_tokens"],
            ch=totals["cache_hit"],
            tc=totals["tool_calls_total"],
        )
    )
    lines.append("")
    par = result["parallelism"]
    lines.append(
        f"Parallelism: max **{par['max_parallel']}** simultaneous subagents; "
        f"serial stretch (exactly one live): {fmt_duration(par['serial_stretch_s'])}."
    )
    lines.append("")
    lines.append("Top tools per actor:")
    for actor in result["actors"]:
        top = ", ".join(f"{name}×{count}" for name, count in list(actor["tool_calls"].items())[:5]) or "—"
        lines.append(f"- {actor['actor']}: {top}")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("journal", help="path to the session journal (.jsonl)")
    parser.add_argument("--shallow", action="store_true", help="skip subagent journals")
    parser.add_argument("--json", action="store_true", help="print JSON instead of markdown")
    args = parser.parse_args()

    session_journal = os.path.abspath(args.journal)
    if not os.path.exists(session_journal):
        sys.exit(f"journal not found: {session_journal}")

    actors = [analyze_journal(session_journal, "main")]

    intervals = []
    if not args.shallow:
        session_uuid = os.path.splitext(os.path.basename(session_journal))[0]
        pattern = os.path.join(os.path.dirname(session_journal), session_uuid, "subagents", "agent-*.jsonl")
        for sub_path in sorted(glob.glob(pattern)):
            actor_name = os.path.splitext(os.path.basename(sub_path))[0]
            metrics = analyze_journal(sub_path, actor_name)
            actors.append(metrics)
            intervals.append(subagent_interval(sub_path, metrics))

    totals = dict.fromkeys(USAGE_KEYS, 0)
    tool_calls_total = 0
    for actor in actors:
        for key in USAGE_KEYS:
            totals[key] += actor["tokens"][key]
        tool_calls_total += actor["tool_calls_total"]
    denominator = (
        totals["input_tokens"]
        + totals["cache_creation_input_tokens"]
        + totals["cache_read_input_tokens"]
    )
    totals_out = dict(totals)
    totals_out["cache_hit"] = round(totals["cache_read_input_tokens"] / denominator, 4) if denominator else 0.0
    totals_out["tool_calls_total"] = tool_calls_total

    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "shallow" if args.shallow else "deep",
        "session_journal": session_journal,
        "actors": actors,
        "totals": totals_out,
        "parallelism": parallelism(intervals),
    }

    print(json.dumps(result, indent=2) if args.json else to_markdown(result))


if __name__ == "__main__":
    main()
