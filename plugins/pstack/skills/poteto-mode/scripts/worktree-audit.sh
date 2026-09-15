#!/usr/bin/env bash
set -euo pipefail

exec python3 - "$@" <<'PY'
import argparse
import datetime
import json
import os
import pathlib
import subprocess
import sys

parser = argparse.ArgumentParser(description="Read-only Git worktree audit using local refs; never removes files or fetches.")
parser.add_argument("repo", nargs="?", default=".")
parser.add_argument("--base", help="local integration ref used to check commit reachability")
args = parser.parse_args()
environment = dict(os.environ, GIT_OPTIONAL_LOCKS="0")


def git(*arguments, cwd=None):
    return subprocess.run(
        ["git", "-C", str(cwd or args.repo), *arguments],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=environment,
    )


def output(result):
    return os.fsdecode(result.stdout).strip() if result.returncode == 0 else ""


def commit(ref):
    return output(git("rev-parse", "--verify", "--end-of-options", ref + "^{commit}"))


root = output(git("rev-parse", "--show-toplevel"))
if not root:
    parser.error("pass a path inside a Git worktree")

listing = git("worktree", "list", "--porcelain", "-z")
if listing.returncode:
    sys.exit(os.fsdecode(listing.stderr).strip() or "cannot list worktrees")

worktrees = []
record = {}
for token in listing.stdout.split(b"\0"):
    if not token:
        if record:
            worktrees.append(record)
            record = {}
        continue
    key, _, value = token.partition(b" ")
    record[os.fsdecode(key)] = os.fsdecode(value)
if record:
    worktrees.append(record)

base_ref = args.base
if base_ref is None:
    remote_default = output(git("symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"))
    candidates = [remote_default, "refs/heads/main", "refs/heads/master"]
    base_ref = next((candidate for candidate in candidates if candidate and commit(candidate)), None)
base_sha = commit(base_ref) if base_ref else ""
if args.base and not base_sha:
    parser.error("--base must resolve to an existing local commit")
print("Base: " + (str(base_ref) + "@" + base_sha if base_sha else "unknown; pass --base") + "; refs were not fetched; active sessions and PR states were not queried.", file=sys.stderr)


def dirty_counts(worktree):
    status = git("status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=matching", cwd=worktree)
    if status.returncode:
        return None
    counts = {"tracked": 0, "untracked": 0, "ignored": 0}
    entries = iter(status.stdout.split(b"\0"))
    for entry in entries:
        if not entry:
            continue
        code = entry[:2]
        kind = "untracked" if code == b"??" else "ignored" if code == b"!!" else "tracked"
        counts[kind] += 1
        if b"R" in code or b"C" in code:
            next(entries, None)
    return counts


def size_kib(worktree):
    try:
        result = subprocess.run(["du", "-sk", str(worktree)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=environment)
        return int(result.stdout.split(None, 1)[0]) if result.returncode == 0 else None
    except (OSError, ValueError, IndexError):
        return None


now = datetime.datetime.now(datetime.timezone.utc).timestamp()
rows = []
for index, worktree in enumerate(worktrees):
    path = worktree.get("worktree", "")
    head = worktree.get("HEAD", "")
    counts = dirty_counts(path)
    dirty = "unknown" if counts is None else ",".join(f"{key}:{value}" for key, value in counts.items() if value) or "clean"
    merge = git("merge-base", "--is-ancestor", head, base_sha) if head and base_sha else None
    merged = "yes" if merge and merge.returncode == 0 else "no" if merge and merge.returncode == 1 else "unknown"
    timestamp = output(git("log", "-1", "--format=%ct", "HEAD", cwd=path))
    age = str(max(0, int((now - int(timestamp)) // 86400))) if timestamp.isdigit() else "unknown"
    upstream = output(git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}", cwd=path))
    if upstream:
        divergence = output(git("rev-list", "--left-right", "--count", "HEAD...@{upstream}", cwd=path)).split()
        remote = f"ahead:{divergence[0]},behind:{divergence[1]}" if len(divergence) == 2 else "unknown"
    else:
        remote = "detached" if "detached" in worktree else "no-upstream"
    if "locked" in worktree:
        bucket = "hold-locked"
    elif index == 0:
        bucket = "hold-primary"
    elif pathlib.Path(path).resolve() == pathlib.Path(root).resolve():
        bucket = "hold-current"
    elif "prunable" in worktree:
        bucket = "review-prunable-metadata"
    elif counts is None:
        bucket = "hold-unknown"
    elif any(counts.values()):
        bucket = "hold-files"
    elif merged == "yes":
        bucket = "review-merged"
    else:
        bucket = "hold-unmerged-or-unknown"
    size = size_kib(path)
    rows.append((size, age, merged, dirty, remote, bucket, path))

print("SIZE_KIB\tAGE_DAYS\tMERGED\tFILES\tREMOTE\tBUCKET\tWORKTREE")
for row in sorted(rows, key=lambda row: (-1 if row[0] is None else row[0]), reverse=True):
    cells = ["unknown" if row[0] is None else str(row[0]), *row[1:-1], json.dumps(row[-1], ensure_ascii=True)]
    print("\t".join(cells))
PY
