# `inputs/imports/`

Third-party dumps a tenant hands you outside of a live run — a Search Console
export, a keyword-rank spreadsheet, an analytics CSV. `importsRoot()`
(`packages/engine/src/repo.ts`) is the only thing that names this directory;
nothing in the engine parses a file here today, so the shape is up to whoever
adds the first importer.

Nothing under this directory is committed by default: it is a place for your
own tenant's data, not sample data, so there is nothing here to gitignore
either — just don't commit a real customer's export to a public fork.

If you build an importer, document the expected file layout here (for
example `<tenant-id>/<source>-<date>/*.csv`) so `farsyn` users know where to
drop their own exports.
