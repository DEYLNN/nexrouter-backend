# AI Gateway Hono Backend Rules

## Changelog required

For every code/docs/config change in this repo, update `CHANGELOG.md` in the same change set. Do this proactively; do not wait to be asked.

Minimum rule:
- Provider/model/routing/auth/OAuth/API changes → add a changelog entry.
- README/docs/deployment wording changes → add a changelog entry.
- Internal scripts/config changes → add a changelog entry.
- Version should follow current patch-only policy unless Zhen says otherwise.

Use concise sections: `Features`, `Fixes`, `Improvements`, `Docs`, `Chore`, `Cleanup`.

## Production data safety

Do not change, migrate, delete, move, or expose production runtime DB/data paths without explicit Zhen approval. Do not push secrets to repo.
