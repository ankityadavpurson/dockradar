<!--
Optional front-matter for static site generators — delete if you paste this
into Dev.to, Hashnode or Medium.

---
title: "Stop Cutting Releases by Hand: A Versioning Pipeline That Refuses to Guess"
description: "How to turn conventional commits into version numbers, changelogs, tags, images and release assets — with the failure modes that matter."
tags: [ci, github-actions, semver, devops, release-engineering]
---
-->

# Stop Cutting Releases by Hand

## A versioning pipeline that refuses to guess

Here is the release checklist almost every project writes down and almost nobody follows:

1. Decide the new version number.
2. Bump it in the backend source file.
3. Bump it in `package.json`.
4. Write the changelog entry.
5. Commit, tag, push.
6. Build and push the container image.
7. Build the distributable archive.
8. Write release notes.
9. Upload the assets.

Nine steps, each one a place to drop the ball. The failure modes are boringly predictable: you bump one
of the two version files and ship an image labelled `2.4.0` whose health endpoint still reports
`2.3.0`. You tag, then the image build fails, and now a tag exists that nothing was ever built from.
You write the changelog three weeks later from memory, and it reads like it.

This post walks through a pipeline that does all nine steps on every merge to `main`, and — more
importantly — the failure modes it was hardened against. The snippets are deliberately generic: plain
`bash` and `awk` you can drop into any project, with a per-ecosystem adapter table for the one part
that differs. At the end there is a trimmed copy-paste workflow.

The production case study is [DockRadar](https://github.com/ankityadavpurson/dockradar), a Docker
container monitor that ships a container image to two registries **and** a native install tarball for
Linux and macOS on every release — currently at v13.19.5, after 31 tagged releases. Every "in
production this is…" pointer below refers to
[`.github/workflows/release.yml`](https://github.com/ankityadavpurson/dockradar/blob/main/.github/workflows/release.yml)
in that repo.

---

## Two rules the whole design rests on

Everything below follows from two rules. If you take nothing else from this post, take these.

**Rule 1 — one source of truth per artifact, and a machine that copies it.**

A version number that lives in four files is four opportunities for drift. Pick exactly one home per
build artifact (one per language runtime, usually), and let automation write the others. Then *verify
the copy landed* — more on that in Stage 2, because this is the step everyone skips.

In DockRadar there are two sources of truth, one per runtime: `backend/app/version.py` holds a bare
`__version__ = "X.Y.Z"` — nothing else in the file, so the rewrite pattern can stay trivial — and
`frontend/package.json` holds the `version` field. The API serves `__version__` back to the UI, so a
missed bump is visible to every user, not just to whoever cut the release.

**Rule 2 — nothing irreversible until everything reversible has passed.**

Order your pipeline by how hard each step is to undo:

| Step | Undo cost |
|---|---|
| Rewrite a version string | free |
| Build an archive | free |
| Push a commit | cheap |
| **Push a tag** | **expensive — consumers may already have fetched it** |
| Push `:latest` to a registry | expensive |
| Publish a GitHub Release | public immediately |

So everything free goes first. In DockRadar the native tarball is built *and smoke-tested* at
`release.yml:170` — a hundred lines **before** `git tag` at `release.yml:284`. A broken build fails the
job while the only damage is a red X in the Actions tab. Get this ordering backwards and a compile
error leaves behind a tag you now have to explain to everyone who already fetched it.

---

## Stage 1 — Derive the version from commits you already wrote

You already encoded your intent when you wrote `feat:` or `fix:` in the commit subject. Read it back
instead of asking a human to decide again.

```bash
# Latest released version, as a bare number. Requires the full tag list:
# actions/checkout fetches no tags by default — use
#   with: { fetch-depth: 0, fetch-tags: true }
LATEST=$(git tag -l 'v*' \
  | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
  | sed 's/^v//' \
  | sort -V \
  | tail -1)
```

Two details in those four lines are load-bearing:

- **`sort -V`, never plain `sort`.** Version sort understands that 16 > 9; lexical sort does not. Run
  it yourself on `13.8.0, 13.9.0, 13.10.0, 13.16.3` — `sort -V | tail -1` gives `13.16.3`, plain
  `sort | tail -1` gives `13.9.0`. A pipeline using plain `sort` silently starts computing bumps from
  the wrong base the moment you reach a two-digit minor.
- **The `grep -E` filter.** Without it, `v2.0.0-rc1` or `v2.0.0-hotfix` can win the sort and feed a
  non-numeric string into arithmetic. Decide what a release tag looks like and reject everything else.

Now the bump decision:

```bash
SUBJECTS=$(git log --format=%s "v$LATEST..HEAD")   # subjects: feat:, fix:, type!:
BODIES=$(git log --format=%B "v$LATEST..HEAD")     # full bodies: BREAKING CHANGE footers

if [ -z "$SUBJECTS" ]; then
  echo "::error::No commits since v$LATEST — nothing to release."
  exit 1
fi

if echo "$BODIES"   | grep -qE '^BREAKING CHANGE' \
|| echo "$SUBJECTS" | grep -qE '^[a-z]+(\([^)]*\))?!:'; then
  BUMP=major                                       # feat!: or a BREAKING CHANGE footer
elif echo "$SUBJECTS" | grep -qE '^feat(\([^)]*\))?:'; then
  BUMP=minor
else
  BUMP=patch
fi
```

Breaking changes get detected two ways, because [Conventional
Commits](https://www.conventionalcommits.org/) allows both: a `!` before the colon in the subject, or a
`BREAKING CHANGE:` footer in the body. Checking only subjects misses half of them. The `(\([^)]*\))?`
group is what makes `feat(api):` count as a feature rather than falling through to "other".

Then the arithmetic, which is one line of shell and needs no dependencies at all:

```bash
IFS=. read -r MA MI PA <<< "$LATEST"
case "$BUMP" in
  major) VERSION="$((MA+1)).0.0" ;;
  minor) VERSION="$MA.$((MI+1)).0" ;;
  patch) VERSION="$MA.$MI.$((PA+1))" ;;
esac
```

> `<<<` is a bash here-string, and so are the `array=()` forms later in this post. GitHub Actions'
> default shell on `ubuntu-latest` is `bash`, so these work as written — but they are **not** POSIX
> `sh`. If you port this to a container whose `/bin/sh` is dash, set `shell: bash` explicitly.

### Refuse rather than guess

The most valuable property of a release pipeline is that it stops when reality does not match its
assumptions. Three guards, each two lines:

```bash
# 1. An explicitly requested version must actually be semver.
if [[ ! "$EXPLICIT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "::error::Version must be semver like 2.1.0 (got '$EXPLICIT')"; exit 1
fi

# 2. Never re-release an existing tag.
if git tag -l "v$VERSION" | grep -q .; then
  echo "::error::Tag v$VERSION already exists"; exit 1
fi

# 3. Never go backwards — catches typos like 2.1.0 when 2.10.0 is out.
HIGHEST=$(printf '%s\n%s\n' "$LATEST" "$VERSION" | sort -V | tail -1)
if [ "$HIGHEST" != "$VERSION" ]; then
  echo "::error::Version $VERSION is not higher than the latest release $LATEST"; exit 1
fi
```

Guard 3 is the one people leave out, and the one that saves you. `2.1.0` typed instead of `2.10.0` is a
plausible slip, passes a semver regex, and publishes a "new" release that every package manager and
update checker will consider older than what users already have.

### Keep the manual override

Automation that cannot be overridden gets worked around. Expose both modes on the same job:

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Explicit version without the leading v (empty = auto-calculate)'
        required: false
        type: string
      bump:
        description: 'Auto-calculation mode when version is empty'
        default: auto
        type: choice
        options: [auto, major, minor, patch]
```

One wrinkle worth knowing: when the same job is *also* triggered by something other than
`workflow_dispatch`, every `inputs.*` expression renders as an empty string. Default them in shell, or
the first automatic run picks an empty bump mode and dies:

```bash
BUMP="${{ inputs.bump }}"
BUMP="${BUMP:-auto}"      # inputs are empty on non-dispatch triggers
```

*In production: `release.yml:68-134`.*

---

## Stage 2 — Bump every file, then prove the bump happened

Writing the version is one line per ecosystem. Here is the part that matters: **`sed` exits 0 when it
matches nothing.** Rename the file, reformat the line, add a type annotation — `__version__: str = "1.0.0"`
no longer matches `^__version__ = ".*"` — and your bump step goes green while changing nothing. You then
publish an image tagged `2.4.0` containing version `2.3.0`, and you find out from a user.

So always pair the write with an independent read-back:

```bash
V="${{ steps.version.outputs.value }}"

# --- write ---
sed -i 's/^__version__ = ".*"/__version__ = "'"$V"'"/' pkg/version.py
(cd frontend && npm pkg set version="$V")

# --- prove it (read the files back through a different mechanism) ---
APP_VERSION=$(sed -n 's/^__version__ = "\(.*\)"/\1/p' pkg/version.py)
PKG_VERSION=$(node -p "require('./frontend/package.json').version")
echo "release=$V  backend=$APP_VERSION  frontend=$PKG_VERSION"
if [ "$V" != "$APP_VERSION" ] || [ "$V" != "$PKG_VERSION" ]; then
  echo "::error::Version bump failed — backend '$APP_VERSION' / frontend '$PKG_VERSION' do not match '$V'"
  exit 1
fi
```

Four extra lines, and the class of bug "we shipped a mislabelled build" is gone for good.

### Write / read-back pairs per ecosystem

| Ecosystem | Write | Read back |
|---|---|---|
| Node | `npm pkg set version="$V"` | `node -p "require('./package.json').version"` |
| Python (bare `__version__`) | `sed -i 's/^__version__ = ".*"/__version__ = "'"$V"'"/' pkg/version.py` | `sed -n 's/^__version__ = "\(.*\)"/\1/p' pkg/version.py` |
| Python (`pyproject.toml`) | `sed -i '0,/^version =/s/^version = ".*"/version = "'"$V"'"/' pyproject.toml` | `python -c "import tomllib,pathlib;print(tomllib.loads(pathlib.Path('pyproject.toml').read_text())['project']['version'])"` |
| Rust | `cargo set-version "$V"` (cargo-edit) | `cargo metadata --no-deps --format-version 1 \| jq -r '.packages[0].version'` |
| Go | nothing to bump — inject at build: `-ldflags "-X main.version=$V"` | `./myapp --version` |
| Java / Maven | `mvn -q versions:set -DnewVersion="$V" -DgenerateBackupPoms=false` | `mvn -q help:evaluate -Dexpression=project.version -DforceStdout` |
| .NET | `sed -i "s#<Version>.*</Version>#<Version>$V</Version>#" MyApp.csproj` | `dotnet msbuild -getProperty:Version` |

The Go row is the ideal, incidentally: there is nothing to bump because nothing is committed. If your
language lets you inject the version at build time, this whole class of drift disappears and the tag is
the only source of truth you need.

### A second, independent gate at tag time

The check above runs inside the release job, where the version came from a variable, so it mostly proves
`sed` worked. Add an independent gate in whatever workflow builds images from tags, where the version
arrives from a completely different source — the git ref:

```yaml
- name: Verify version consistency (tag builds only)
  if: startsWith(github.ref, 'refs/tags/v')
  run: |
    TAG_VERSION="${GITHUB_REF_NAME#v}"
    APP_VERSION=$(sed -n 's/^__version__ = "\(.*\)"/\1/p' pkg/version.py)
    if [ "$TAG_VERSION" != "$APP_VERSION" ]; then
      echo "::error::Version mismatch — tag v$TAG_VERSION, code $APP_VERSION. Bump before tagging."
      exit 1
    fi
```

This one catches the human path: someone tags `v2.5.0` by hand from a laptop without bumping anything.
Two cheap checks from two different angles beat one clever check.

*In production: `release.yml:136-154` and `docker-publish.yml:37-47`.*

---

## Stage 3 — Rotate the changelog instead of writing one

Adopt the [Keep a Changelog](https://keepachangelog.com/) layout and treat `## [Unreleased]` as an
inbox:

```markdown
# Changelog

## [Unreleased]

## [2.3.0] — 2026-04-02

### Added
- Thing you can now do

[Unreleased]: https://github.com/you/myapp/compare/v2.3.0...HEAD
[2.3.0]: https://github.com/you/myapp/compare/v2.2.0...v2.3.0
```

Release time is then pure text surgery, and the policy that makes it pleasant to live with is:

> **If a human wrote notes under `[Unreleased]`, use them verbatim. If nobody did, synthesize them from
> the commit log.**

Best of both: prose when a change deserves prose, never a blank release when it does not. Extract the
current body first:

```awk
# awk: print the lines between the [Unreleased] heading and the next "## [" heading
/^## \[Unreleased\]/ { grab=1; next }
grab && /^## \[/     { exit }
grab                 { print }
```

If that comes back empty, group the commit subjects instead:

```bash
RANGE="v$LATEST..HEAD"
subj() { git log --no-merges --format='%s' "$RANGE"; }

ADDED=$(subj   | grep -E  '^feat(\([^)]*\))?:' | sed -E 's/^feat(\([^)]*\))?: *//')
FIXED=$(subj   | grep -E  '^fix(\([^)]*\))?:'  | sed -E 's/^fix(\([^)]*\))?: *//')
CHANGED=$(subj | grep -viE '^(feat|fix)(\([^)]*\))?:' \
               | grep -viE '^chore\(release\)' \
               | sed -E 's/^[a-zA-Z]+(\([^)]*\))?: *//')

: > section_body.txt
add_group() {                       # add_group "Added" "$ADDED"
  [ -n "$2" ] || return 0           # skip empty groups — no bald "### Fixed" headings
  { printf '\n### %s\n' "$1"; printf '%s\n' "$2" | sed 's/^/- /'; } >> section_body.txt
}
add_group Added   "$ADDED"
add_group Fixed   "$FIXED"
add_group Changed "$CHANGED"

# Never emit an empty section.
grep -qE '\S' section_body.txt || printf '\n- Maintenance release.\n' >> section_body.txt
```

`--no-merges` keeps "Merge pull request #24" out of your release notes. Excluding `chore(release)`
keeps the *previous* release commit from showing up in the *next* release's notes — a small thing that
looks sloppy on every release page until you fix it.

Then splice: re-emit an empty `[Unreleased]`, insert the new dated section, and drop the old body.

```awk
# awk -v ver=2.4.0 -v date=2026-04-02 -v bodyfile=section_body.txt
/^## \[Unreleased\]/ && !done {
  print "## [Unreleased]"; print "";            # leave a fresh, empty inbox
  print "## [" ver "] — " date;
  while ((getline line < bodyfile) > 0) print line;
  print "";
  done=1; skip=1; next                          # skip = swallow the old body
}
skip && /^## \[/ { skip=0 }                     # next heading: stop swallowing
skip             { next }
{ print }
```

And refresh the reference links in one more pass — repoint `[Unreleased]` at the new tag and insert the
new version's compare link above the rest:

```awk
# awk -v ver=2.4.0 -v latest=2.3.0 -v repo=you/myapp
/^\[Unreleased\]:/ {
  print "[Unreleased]: https://github.com/" repo "/compare/v" ver "...HEAD"
  print "[" ver "]: https://github.com/" repo "/compare/v" latest "...v" ver
  next
}
{ print }
```

One trick worth stealing when you later extract that section for the release body: match with `index()`
rather than a regex.

```awk
# "## [2.4.0]" as a literal prefix — no escaping the [brackets], no regex surprises
index($0, "## [" ver "]") == 1 { grab=1; next }
grab && index($0, "## [") == 1 { exit }
grab                           { print }
```

Interpolating a version into a regex means escaping `[`, `]` and `.` correctly every single time.
`index($0, s) == 1` is a literal prefix test, and it is impossible to get wrong.

*In production: `release.yml:201-282`.*

---

## Stage 4 — Commit, tag and push atomically

```bash
git config user.name  "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git add pkg/version.py frontend/package.json CHANGELOG.md
git commit -m "chore(release): v$V"
git tag "v$V"

# --atomic: branch and tag land together, or neither does.
git push --atomic origin HEAD "v$V"
```

`--atomic` is the important word. Here is the exact scenario it prevents: your release job starts, and
while it is building, a teammate merges another PR. Your branch push is now rejected as non-fast-forward.
Without `--atomic`, git has already pushed the tag — so the remote carries `v2.4.0` pointing at a commit
that is not on `main` and never will be, and your release references a version bump nobody can see.
With `--atomic`, the rejection takes the tag down with it and the job fails clean; you re-run it and it
recalculates from the new `main`.

Pair it with serialized concurrency:

```yaml
concurrency:
  group: release
  cancel-in-progress: false   # queue releases; never cancel one mid-flight
```

`cancel-in-progress: true` is the right default for CI on pull requests and the wrong default here. A
cancelled release job is a release stopped at a random line — tag pushed, image not built; image pushed,
release not created. Releases should queue and run to completion, however slow that feels.

*In production: `release.yml:46-50` and `release.yml:284-293`.*

---

## Stage 5 — Publish artifacts, and the part everyone gets wrong

This is the stage that bit DockRadar in production, three releases in a row, and the lesson generalizes
to any release tool.

`softprops/action-gh-release` — and most equivalents — does this internally:

1. create the release as a **draft**,
2. upload each asset,
3. flip `draft: false` to publish.

Sensible. But if step 2 throws, the job dies before step 3, and the release stays a draft. Drafts are
invisible to everyone but maintainers. Meanwhile the tag is pushed and the image is on the registry. So
v13.16.0, v13.16.1 and v13.16.2 all "shipped" with an invisible release page — and GitHub's upload
endpoint turned out to be the culprit: sporadic server-side errors (`Error saving asset`,
`Error creating asset temp dir`) that hit assets of *any* size. v13.16.2 failed on `install.sh`, a few
kilobytes.

The general principle:

> **Publish the cheap thing that cannot fail first. Attach the expensive things afterwards.**

```yaml
# 1. Create the release with a body and NO assets. Nothing here can fail
#    transiently, so the release always becomes visible.
- name: Create GitHub Release
  uses: softprops/action-gh-release@v3
  with:
    tag_name: v${{ steps.version.outputs.value }}
    name: v${{ steps.version.outputs.value }}
    body_path: RELEASE_NOTES.md
    generate_release_notes: true    # appends commits + contributors

# 2. Attach assets separately, with retries.
- name: Upload release assets
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    TAG: v${{ steps.version.outputs.value }}
  run: |
    upload() {
      for attempt in 1 2 3 4 5; do
        # Quiet on the first try; every retry dumps the full HTTP exchange, so a
        # recurring failure is diagnosable from the log alone — status code plus
        # the x-github-request-id header, which is what support will ask for.
        [ "$attempt" -gt 1 ] && export GH_DEBUG=api

        # --clobber makes each attempt idempotent: a retry after a partial
        # upload replaces the asset instead of duplicating it.
        if gh release upload "$TAG" "$1" --clobber; then
          echo "attached $1 (attempt $attempt)"; unset GH_DEBUG; return 0
        fi
        echo "attempt $attempt failed for $1"
        [ "$attempt" -lt 5 ] && sleep $((attempt * 15))   # 15s, 30s, 45s, 60s
      done
      unset GH_DEBUG; return 1
    }
```

Three ideas in that function are worth lifting wholesale:

- **Idempotent retries.** `--clobber` (or your tool's equivalent upsert flag) means attempt 4 does not
  care what attempts 1–3 half-did. Retry logic without idempotency creates duplicates.
- **Escalating observability.** Debug logging off on the happy path, on from attempt 2. Healthy runs
  stay readable; the one run you need to debug carries everything. (Actions masks `GITHUB_TOKEN` in all
  log output, so `GH_DEBUG=api` does not leak it — verify the equivalent guarantee before doing this on
  another platform.)
- **Linear backoff, bounded attempts.** Five tries over about two and a half minutes. Long enough to
  outlive a blip, short enough that a real outage fails the job instead of burning runner minutes.

### Not every asset deserves to fail the release

Classify assets by whether their absence actually breaks a user:

```bash
# Required: the install instructions in the release notes curl these by URL,
# so a release missing them is genuinely broken.
failed=()
for f in "$NATIVE" "$NATIVE.sha256" scripts/install.sh scripts/uninstall.sh; do
  upload "$f" || failed+=("$f")
done

# Best effort: the image is already on both registries, so a missing *offline*
# tarball must not fail an otherwise-complete release. Warn, and leave the
# operator the exact recovery commands.
if ! upload "$IMAGE_TARBALL"; then
  echo "::warning::Could not attach $IMAGE_TARBALL. $TAG is published and the image is on GHCR and Docker Hub."
  {
    echo "### Offline image tarball not attached"
    echo "To attach it by hand:"
    echo "    docker pull $IMAGE && docker save $IMAGE | gzip > $IMAGE_TARBALL"
    echo "    gh release upload $TAG $IMAGE_TARBALL --clobber"
  } >> "$GITHUB_STEP_SUMMARY"
fi

if [ ${#failed[@]} -gt 0 ]; then
  echo "::error::Required assets failed to upload after 5 attempts: ${failed[*]}"
  exit 1
fi
```

Writing recovery commands into `$GITHUB_STEP_SUMMARY` is a habit worth forming. When a partial failure
happens, the person fixing it is already looking at the run page — put the fix there, pre-filled with the
real version and image name, instead of making them reconstruct it from the workflow source.

*In production: `release.yml:390-463`. The comment block above that step names the three releases it
came from; incident notes belong next to the code that carries the scar.*

---

## Stage 6 — Smoke-test what you actually shipped

A successful build proves your code compiles and your `Dockerfile` has valid syntax. It does not prove
the thing you are about to publish *runs*. Two checks, seconds each, catch an embarrassing share of bad
releases.

**Check the packaged archive, not the working tree.** Install it into a throwaway environment from the
*packaged* dependency list and import the app. This catches the file you forgot to include and the
dependency that only exists in your dev requirements:

```bash
python -m venv /tmp/smoke-venv
/tmp/smoke-venv/bin/pip install --quiet -r "dist/$STAGE/backend/requirements.txt"
(cd "dist/$STAGE/backend" && /tmp/smoke-venv/bin/python -c \
  "import app.main as m; assert m.DIST.exists(), 'frontend/dist missing'; print('smoke test ok')")
```

That `assert m.DIST.exists()` is the good part: it verifies the *built frontend* made it into the
archive. An archive that imports fine but serves a blank page is exactly the failure a plain import test
misses.

**Check the pushed image, not the local build.** Pull it back from the registry and run one command in
it:

```bash
docker pull "$IMAGE"
docker run --rm "$IMAGE" python -c "import app.main; print('smoke test: app imports ok')"
```

Generalize as `docker run --rm "$IMAGE" myapp --version` for a compiled binary, or
`node -e "require('./dist/index.js')"` for Node. The rule: *the build proves it compiles; only running
it proves it loads.*

*In production: `release.yml:191-194` and `release.yml:343-358`.*

---

## Wiring the triggers

DockRadar chains three workflows instead of running one giant one:

```
PR opened ──────────────► ci.yml                  (tests + frontend build)
                             │ workflow_call
push to main ───────────► docker-publish.yml      (needs: ci → build & push :latest)
                             │ workflow_run: completed
                          release.yml             (version → bump → changelog → tag
                                                   → versioned image → release)
```

`ci.yml` is written with `on: workflow_call` **and** `on: pull_request`, so one file serves as both the
PR gate and the reusable quality gate the publish workflow depends on via `needs:`. No duplicated test
configuration.

One GitHub-specific gotcha that will cost you an afternoon if you do not know it:

> **A tag pushed using `GITHUB_TOKEN` does not trigger other workflows.**

This is deliberate — it stops a workflow from triggering itself forever. But it means a `release.yml`
that pushes `v2.4.0` and expects the tag-triggered image build to fire will wait forever. Two ways out:

1. **Build the versioned image inside the release job** — what DockRadar does at `release.yml:309-338`,
   reusing `docker/metadata-action` to tag both `X.Y.Z` and `latest`. No extra credentials, and one job
   you can read top to bottom.
2. **Push the tag with a PAT or GitHub App token**, which *does* trigger workflows. More moving parts, a
   secret to rotate, and a genuine self-trigger loop risk.

Option 1 is the safer default. Whichever you pick, write down *why* in a comment at the top of the
workflow — this is exactly the kind of thing that looks like a redundant duplicate build to whoever
reads it next. (On GitLab CI the equivalent chaining is `needs:` plus `rules: - if: $CI_COMMIT_TAG`; on
Jenkins it is a downstream `build job:` step. The token gotcha is GitHub-specific, but "does my tag push
retrigger the pipeline?" is a question worth answering explicitly on every platform.)

---

## The copy-paste version

A minimum viable pipeline with every principle above and none of the project specifics. Fill in the two
`TODO` markers.

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version: { description: 'Explicit X.Y.Z (empty = auto)', required: false, type: string }
      bump:
        description: 'Mode when version is empty'
        default: auto
        type: choice
        options: [auto, major, minor, patch]

permissions:
  contents: write     # commit, tag, create release
  packages: write     # only if you push images

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with: { fetch-depth: 0, fetch-tags: true }   # both required for tag math

      - name: Determine version
        id: version
        run: |
          EXPLICIT="${{ inputs.version }}"
          BUMP="${{ inputs.bump }}"; BUMP="${BUMP:-auto}"
          LATEST=$(git tag -l 'v*' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
                   | sed 's/^v//' | sort -V | tail -1)

          if [ -n "$EXPLICIT" ]; then
            [[ "$EXPLICIT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
              || { echo "::error::Not semver: $EXPLICIT"; exit 1; }
            VERSION="$EXPLICIT"
          else
            [ -n "$LATEST" ] || { echo "::error::No v* tags; pass an explicit version"; exit 1; }
            if [ "$BUMP" = auto ]; then
              S=$(git log --format=%s "v$LATEST..HEAD"); B=$(git log --format=%B "v$LATEST..HEAD")
              [ -n "$S" ] || { echo "::error::No commits since v$LATEST"; exit 1; }
              if echo "$B" | grep -qE '^BREAKING CHANGE' \
              || echo "$S" | grep -qE '^[a-z]+(\([^)]*\))?!:'; then BUMP=major
              elif echo "$S" | grep -qE '^feat(\([^)]*\))?:'; then  BUMP=minor
              else                                                  BUMP=patch; fi
            fi
            IFS=. read -r MA MI PA <<< "$LATEST"
            case "$BUMP" in
              major) VERSION="$((MA+1)).0.0" ;;
              minor) VERSION="$MA.$((MI+1)).0" ;;
              patch) VERSION="$MA.$MI.$((PA+1))" ;;
            esac
          fi

          git tag -l "v$VERSION" | grep -q . && { echo "::error::v$VERSION exists"; exit 1; }
          if [ -n "$LATEST" ]; then
            [ "$(printf '%s\n%s\n' "$LATEST" "$VERSION" | sort -V | tail -1)" = "$VERSION" ] \
              || { echo "::error::$VERSION is not newer than $LATEST"; exit 1; }
          fi

          echo "value=$VERSION"  >> "$GITHUB_OUTPUT"
          echo "latest=$LATEST"  >> "$GITHUB_OUTPUT"
          echo "## Releasing v$VERSION" >> "$GITHUB_STEP_SUMMARY"

      # TODO: replace with your ecosystem's write + read-back pair (see the table above).
      - name: Bump and verify
        run: |
          V="${{ steps.version.outputs.value }}"
          sed -i 's/^__version__ = ".*"/__version__ = "'"$V"'"/' pkg/version.py
          GOT=$(sed -n 's/^__version__ = "\(.*\)"/\1/p' pkg/version.py)
          [ "$V" = "$GOT" ] || { echo "::error::bump failed: got '$GOT'"; exit 1; }

      # TODO: build + smoke-test your artifacts HERE — before the tag exists.

      - name: Rotate changelog
        run: |
          # See Stage 3: extract [Unreleased], fall back to commit-derived
          # bullets, splice in "## [X.Y.Z] - DATE", refresh the compare links,
          # and write RELEASE_NOTES.md.
          echo "TODO"

      - name: Commit, tag, push
        run: |
          V="${{ steps.version.outputs.value }}"
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A && git commit -m "chore(release): v$V"
          git tag "v$V"
          git push --atomic origin HEAD "v$V"

      - name: Create release (no assets — cannot fail transiently)
        uses: softprops/action-gh-release@v3
        with:
          tag_name: v${{ steps.version.outputs.value }}
          name: v${{ steps.version.outputs.value }}
          body_path: RELEASE_NOTES.md
          generate_release_notes: true

      - name: Upload assets with retries
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAG: v${{ steps.version.outputs.value }}
        run: |
          upload() {
            for attempt in 1 2 3 4 5; do
              [ "$attempt" -gt 1 ] && export GH_DEBUG=api
              gh release upload "$TAG" "$1" --clobber && { unset GH_DEBUG; return 0; }
              [ "$attempt" -lt 5 ] && sleep $((attempt * 15))
            done
            unset GH_DEBUG; return 1
          }
          failed=()
          for f in dist/*.tar.gz; do upload "$f" || failed+=("$f"); done
          [ ${#failed[@]} -eq 0 ] || { echo "::error::failed: ${failed[*]}"; exit 1; }
```

---

## When *not* to build this

Honesty about the price: DockRadar's `release.yml` is about 460 lines of YAML and shell. That is real
code, in a language with no type checker, that runs only in CI. Reach for an existing tool instead when:

- **You want conventions, not decisions.** [release-please](https://github.com/googleapis/release-please),
  [semantic-release](https://semantic-release.gitbook.io/) and [changesets](https://github.com/changesets/changesets)
  all do version calculation and changelog generation well, and someone else maintains them.
- **Your artifacts are standard.** Publishing to npm, PyPI or crates.io? The ecosystem tool already
  knows how. Shipping Go binaries? [goreleaser](https://goreleaser.com/) is excellent and handles
  cross-compilation, checksums and archives in a few lines of config.
- **Your team will not read shell.** A 460-line workflow nobody else can debug is a bus-factor problem
  dressed up as automation.

Hand-rolling earns its keep when you need things the tools do not give you cheaply: a specific ordering
guarantee (build, *then* tag), multi-artifact fan-out to different destinations (two registries **and** a
native tarball **and** installer scripts), per-asset failure semantics (required vs best-effort), or a
refusal to add a Node toolchain to a repo that has no other reason for one.

And you can mix: let release-please compute the version and changelog, then do your own artifact
publishing with the retry and classification logic from Stage 5. These principles are independent of who
implements each stage.

---

## The checklist

1. **One source of truth per artifact** — everything else is generated.
2. **Verify every bump by reading the file back.** A `sed` that matched nothing still exits 0.
3. **Build and smoke-test before you tag.** The tag is the first step you cannot take back.
4. **Push branch and tag with `--atomic`.** Never leave an orphaned tag behind.
5. **Queue releases; never cancel them.** `cancel-in-progress: false`.
6. **Guard against going backwards**, not just against malformed input.
7. **Publish first, attach second.** Never let an asset upload strand the release.
8. **Retry idempotently, log more on retry**, and classify assets as required or best-effort.
9. **Smoke-test the artifact you actually shipped**, pulled back from where you shipped it.
10. **Comment the why, especially the scars.** `# this is why the release job builds its own image`
    saves the next person a day.

The pipeline you want is not the one that never fails. It is the one that, when it fails, leaves nothing
behind that you have to explain.

---

*The full workflow this was drawn from:
[`release.yml`](https://github.com/ankityadavpurson/dockradar/blob/main/.github/workflows/release.yml)
in [DockRadar](https://github.com/ankityadavpurson/dockradar) — self-hosted Docker container monitoring.
Every line reference in this post points there.*
