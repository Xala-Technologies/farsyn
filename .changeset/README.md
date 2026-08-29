# Changesets

This project uses [changesets](https://github.com/changesets/changesets) to
manage versioning and the changelog for `@farsyn/engine` and `@farsyn/mcp`.

If your PR changes either published package in a way users should know about,
run:

```bash
pnpm changeset
```

and follow the prompts — it writes a small markdown file describing the
change and which package(s) it affects (patch/minor/major). Commit that file
alongside your change. `apps/console` and `apps/ui` are excluded (`ignore` in
`.changeset/config.json`) since neither is published.

A maintainer merges the version PR that changesets opens against `main`;
merging it triggers the actual npm publish. See
[`.github/workflows/release.yml`](../.github/workflows/release.yml) and
[`GOVERNANCE.md`](../GOVERNANCE.md).
