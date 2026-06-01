# NexRouter Hono Backend Rules

## Changelog + version required

For every code/docs/config change in this repo, update `CHANGELOG.md` **and** bump package version in the same change set. Do this proactively; do not wait to be asked.

Minimum rule:
- Provider/model/routing/auth/OAuth/API changes → bump patch version + add changelog entry.
- README/docs/deployment wording changes → bump patch version + add changelog entry.
- Internal scripts/config changes → bump patch version + add changelog entry.
- If `CHANGELOG.md` has a new top version, `package.json` and `package-lock.json` must match that exact version.
- Patch-only policy by default unless Zhen says otherwise: `0.4.31` → `0.4.32` → `0.4.33`.

Recommended command:
```bash
npm version patch --no-git-tag-version
```
Then edit `CHANGELOG.md` top entry to the same version and today’s date.

Use concise sections: `Features`, `Fixes`, `Improvements`, `Docs`, `Chore`, `Cleanup`.

Before commit/push:
```bash
grep -n '"version"' package.json package-lock.json | head
head -20 CHANGELOG.md
```
Verify versions match.

## Production data safety

Do not change, migrate, delete, move, or expose production runtime DB/data paths without explicit Zhen approval. Do not push secrets to repo.
