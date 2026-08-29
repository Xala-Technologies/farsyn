# Governance

## Model today: benevolent dictator

Farsyn is currently maintained under a benevolent-dictator model: Xala
Technologies AS, acting through the maintainers listed in
[`CODEOWNERS`](.github/CODEOWNERS), has final say over the project's
direction, releases, and what merges. This is a starting point chosen for
speed while the project is young, not a permanent structure.

In practice, this means:

- Design decisions and disputes are resolved by the maintainers, with a
  strong default toward consensus first.
- Anyone can propose a change via a pull request or an issue; anyone can
  disagree with a decision by saying so in the relevant thread.
- `AGENTS.md`'s invariants are the closest thing this project has to a
  constitution for the codebase itself — a change that contradicts one needs
  to argue for changing the invariant, not route around it silently.

## Path to a maintainer group

As the contributor base grows, the intent is to move toward a small group of
maintainers with commit access, chosen by demonstrated, sustained
contribution — code, review, or both — rather than by request. There's no
fixed threshold or timeline for this yet; it happens when there are people to
add.

When it does, the update to this document will describe:

- how someone becomes a maintainer,
- how decisions get made among maintainers (consensus, vote, or otherwise),
- what happens when maintainers disagree.

## Releases

Releases are cut from `main` via [`release.yml`](.github/workflows/release.yml)
(changesets) by a maintainer. Versioning follows semver; `0.x` releases may
contain breaking changes without a major bump, per semver's own carve-out for
pre-1.0 software.

## Removing a maintainer

A maintainer who becomes inactive, or whose conduct violates the
[Code of Conduct](CODE_OF_CONDUCT.md), can be removed by the remaining
maintainers. This is deliberately not detailed further while the maintainer
group is one organization — it will be specified before it needs to matter.
