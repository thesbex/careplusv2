#!/usr/bin/env bash
# regress-touched.sh — non-régression ciblée sur les modules touchés.
#
# Compare la diff (HEAD + working tree, par défaut vs origin/main) au mapping
# `chemin → IT pattern`, et lance UNIQUEMENT les ITs des modules concernés.
# Les changements sur les zones partagées (shared/, identity/, db migrations,
# pom.xml, application*.yml côté backend ; lib/ + components/ + tsconfig +
# vite.config côté frontend) déclenchent quand même la suite complète parce
# qu'un changement transverse peut casser n'importe quel module.
#
# Pourquoi ce script existe (ADR-029, leçon QA wave 7 du 2026-05-03) :
#   - `mvn verify` complet = 5+ minutes → bloquant en itération rapide.
#   - L'agent `regression-guard` reste la garde finale avant push (full suite).
#   - Ce script est l'outil intermédiaire « j'ai touché vaccination, lance
#     juste les ITs vaccination » sans ouvrir un mvn -Dtest=... à la main.
#
# Usage :
#   ./scripts/regress-touched.sh                  # vs origin/main, full diff
#   ./scripts/regress-touched.sh --vs HEAD~2      # vs commit spécifique
#   ./scripts/regress-touched.sh --backend-only   # skip frontend
#   ./scripts/regress-touched.sh --frontend-only  # skip backend
#   ./scripts/regress-touched.sh --staged         # only staged changes
#
# Exit code = exit code du `mvn` ou `npm test` (0 = vert).

set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────────────
VS="origin/main"
RUN_BACKEND=1
RUN_FRONTEND=1
STAGED_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --vs) VS="$2"; shift 2 ;;
    --backend-only) RUN_FRONTEND=0; shift ;;
    --frontend-only) RUN_BACKEND=0; shift ;;
    --staged) STAGED_ONLY=1; shift ;;
    -h|--help)
      sed -n '2,28p' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *) echo "unknown flag: $1 (try --help)" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ── Compute touched files ─────────────────────────────────────────────────────
if [[ $STAGED_ONLY -eq 1 ]]; then
  TOUCHED="$(git diff --name-only --cached 2>/dev/null | sort -u)"
else
  # diff vs base + working tree changes (staged + unstaged) + untracked
  TOUCHED="$(
    {
      git diff --name-only "$VS"...HEAD 2>/dev/null || true
      git diff --name-only HEAD          2>/dev/null || true
      git diff --name-only --cached      2>/dev/null || true
      git ls-files --others --exclude-standard 2>/dev/null || true
    } | sort -u | grep -v '^$' || true
  )"
fi

if [[ -z "$TOUCHED" ]]; then
  echo "[regress-touched] no changes detected — nothing to test."
  exit 0
fi

echo "[regress-touched] touched files:"
echo "$TOUCHED" | sed 's/^/  /'
echo

# ── Backend: classify ─────────────────────────────────────────────────────────
BACKEND_SHARED_ROOTS=(
  "src/main/java/ma/careplus/shared/"
  "src/main/resources/db/migration/"
  "src/main/java/ma/careplus/identity/"
  "pom.xml"
  "src/main/resources/application"
)

BACKEND_FULL=0
BACKEND_MODULES=()

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  for root in "${BACKEND_SHARED_ROOTS[@]}"; do
    [[ "$f" == "$root"* ]] && BACKEND_FULL=1
  done
  if [[ "$f" =~ ^src/(main|test)/java/ma/careplus/([^/]+)/ ]]; then
    BACKEND_MODULES+=("${BASH_REMATCH[2]}")
  fi
done <<< "$TOUCHED"

# Dedupe + drop shared/identity (already trigger full)
if [[ ${#BACKEND_MODULES[@]} -gt 0 ]]; then
  BACKEND_MODULES=($(printf "%s\n" "${BACKEND_MODULES[@]}" | sort -u | grep -vE '^(shared|identity)$' || true))
fi

# ── Backend: run ──────────────────────────────────────────────────────────────
BACKEND_EXIT=0
if [[ $RUN_BACKEND -eq 1 ]]; then
  if [[ $BACKEND_FULL -eq 1 ]]; then
    echo "[regress-touched] backend: shared/identity/migration/pom touched → full mvn verify"
    mvn -q verify || BACKEND_EXIT=$?
  elif [[ ${#BACKEND_MODULES[@]} -eq 0 ]]; then
    echo "[regress-touched] backend: no Java sources touched — skipping."
  else
    PATTERN=""
    for m in "${BACKEND_MODULES[@]}"; do
      CAP="$(echo "${m:0:1}" | tr '[:lower:]' '[:upper:]')${m:1}"
      [[ -n "$PATTERN" ]] && PATTERN+=","
      PATTERN+="*${CAP}*IT"
    done
    echo "[regress-touched] backend: modules ${BACKEND_MODULES[*]} → mvn -Dtest='$PATTERN' verify"
    mvn -q verify -Dtest="$PATTERN" -DfailIfNoTests=false || BACKEND_EXIT=$?
  fi
fi

# ── Frontend: classify + run ──────────────────────────────────────────────────
FRONTEND_EXIT=0
if [[ $RUN_FRONTEND -eq 1 ]]; then
  FRONTEND_TOUCHED="$(echo "$TOUCHED" | grep -E '^frontend/' || true)"
  if [[ -z "$FRONTEND_TOUCHED" ]]; then
    echo "[regress-touched] frontend: no frontend/ files touched — skipping."
  else
    FRONTEND_SHARED_ROOTS=(
      "frontend/src/lib/"
      "frontend/src/components/"
      "frontend/src/main.tsx"
      "frontend/src/App.tsx"
      "frontend/package.json"
      "frontend/package-lock.json"
      "frontend/tsconfig"
      "frontend/vite.config"
    )
    FRONTEND_FULL=0
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      for root in "${FRONTEND_SHARED_ROOTS[@]}"; do
        [[ "$f" == "$root"* ]] && FRONTEND_FULL=1
      done
    done <<< "$FRONTEND_TOUCHED"

    if [[ $FRONTEND_FULL -eq 1 ]]; then
      echo "[regress-touched] frontend: lib/components/build config touched → full npm test"
      ( cd frontend && npm test -- --run ) || FRONTEND_EXIT=$?
    else
      SLICES=()
      while IFS= read -r f; do
        if [[ "$f" =~ ^frontend/src/features/([^/]+)/ ]]; then
          SLICES+=("${BASH_REMATCH[1]}")
        fi
      done <<< "$FRONTEND_TOUCHED"

      if [[ ${#SLICES[@]} -eq 0 ]]; then
        echo "[regress-touched] frontend: no recognized slice — running full npm test"
        ( cd frontend && npm test -- --run ) || FRONTEND_EXIT=$?
      else
        SLICES=($(printf "%s\n" "${SLICES[@]}" | sort -u))
        ARGS=()
        for s in "${SLICES[@]}"; do
          ARGS+=("src/features/$s")
        done
        echo "[regress-touched] frontend: slices ${SLICES[*]} → npm test ${ARGS[*]}"
        ( cd frontend && npm test -- --run "${ARGS[@]}" ) || FRONTEND_EXIT=$?
      fi
    fi
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo
if [[ $BACKEND_EXIT -ne 0 || $FRONTEND_EXIT -ne 0 ]]; then
  echo "[regress-touched] FAILED — backend=$BACKEND_EXIT frontend=$FRONTEND_EXIT"
  echo "[regress-touched] (avant push : laisser regression-guard tourner la suite complète)"
  exit 1
fi

echo "[regress-touched] OK — modules touchés verts."
echo "[regress-touched] note : ce n'est pas une non-régression COMPLÈTE."
echo "[regress-touched]        Avant push, lance regression-guard (mvn verify full)."
exit 0
