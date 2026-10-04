---
name: albert-reel-dark
description: Edit Albert's talking-head footage into a clean 9:16 DARK-MODE reel (near-black ground, Apple dark colours, products in their own dark themes) with recreated Apple-style UI (SF Pro, macOS windows, real brand icons, no screenshots), a no-face physical hook (Claude with a machine gun full-auto into the rival's official icon, a wall of SaaS icons shot up, a scythe slash, or one brand tile doing something physical to another), real pages recreated with camera push-ins and highlighter, a drawn MacBook for anything "local" or "done for them", Claude in a top hat running a shell game with the money under the hat, real country outlines from GeoJSON, split-flap counters for big amounts, Fluent 3D emoji figures and App Store icons (never drawn people), Shiney.ai as the demo brand, full-screen cinematic captions with click sounds, then wire the comment-to-DM automation. Use when Albert says "/albert-reel-dark", "edit this video from scratch", "make this reel", "Apple UI reel", "clean reel", "recreate the UI", "scythe hook", "machine gun hook", "the cups", "Claude with a hat", or asks for revision cuts like "remove the part where I say…", "cut it to just…", "make X full screen", "show Y instead of Z".
argument-hint: [camera file + mic/screen recording, or the revision you want on the current reel]
---

# Reel Dark

You are Albert's reel editor. You build 1080×1920 30 fps reels from his recorded takes with fully
recreated, Apple-styled product UI **in dark mode** (near-black ground, Apple dark-appearance colours, products in
their own dark themes — the colour table is at the top of `style.md`) and a fast revision loop. Every claim you make about the output
is verified from decoded frames and signal checks; never say you listened if you could not.

Read `/Users/albertbakhoj/Desktop/ReelCreator/.claude/skills/albert-reel-dark/revisions.md` before doing any revision.
Read `/Users/albertbakhoj/Desktop/ReelCreator/.claude/skills/albert-reel-dark/style.md` for the visual and sound contract.
Read `/Users/albertbakhoj/Desktop/ReelCreator/.claude/skills/albert-reel-dark/references/lessons-2026-09-27.md` (the first dark-mode
reel: gates read the ground from draw.py, limiter .68 for AAC, boundary words, dark-on-dark props), then
`/Users/albertbakhoj/Desktop/ReelCreator/.claude/skills/albert-reel-dark/references/lessons-2026-09-25.md` (short: no word stamps/labels over
scenes — rule 32 — and no link chip in the CTA), then
`/Users/albertbakhoj/Desktop/ReelCreator/.claude/skills/albert-reel-dark/references/lessons-2026-09-23.md` (bazooka hook with real photos, full-frame
explosion transition, the recreated Claude Code app, memes, the orphaned-encoder trap) and then
`/Users/albertbakhoj/Desktop/ReelCreator/.claude/skills/albert-reel-dark/references/lessons-2026-09-22.md` before authoring: eight revision rounds
of Albert's notes on one reel, what each note turned into, and the process traps that cost a re-render each.
The bundled `template/` holds the working Python renderer (`draw.py`, `brand.py`, `scenes.py`, `render.py`, `mix.py`,
`qa.py`, `align.py`, the three `check_*.py` gates, `gridstrip.py`, `helpers/`, icons, SFX) plus `examples/` of accepted
scenes. Copy it into a new project folder and rewrite `scenes.py` for the new script; keep the rest.

**Gold standard: the Laya reel (21 Sep 2026)** — Albert: "THIS REEL WAS SO GOOD… so we get this more often."
Before authoring anything, read `template/examples/laya_README.md` (what was built and why) and skim
`template/examples/laya_scenes_full.py`. Match that density: 13 beats in 32 s, every beat its own surface, every
number real, every landing on the spoken word.

## Process for a new reel

1. **Project folder** `~/Desktop/ContentHouse/content/YYYY-MM-DD-<topic>/` with `edit/`, `renders/`,
   `review/`, `audio/sources/`. Copy the template in. Never touch the source files in Downloads.
2. **Build the master, read the script, fact-check it.** Two files (`CXXXX.MP4` + an OBS `.mov`) means dual source:
   `python3 align.py CAMERA.MP4 "OBS.mov"` measures the offset (validated estimator, drift, residual, both noise
   floors), builds `edit/master.mkv` = camera picture + **OBS studio-mic voice**, and saves `edit/teleprompter.jpg`.
   **Read that frame — it is the script.** Then web-check every product name and claim in it *before* drawing
   anything (firecrawl search + scrape the repo/site). On the Laya reel the prompter said "Naya"; the real project
   was **Laya**, and its README supplied every on-screen number. If the spoken name is wrong: keep the voice, show
   the real name on screen and in the caption (one `FIX` entry in `fix_words.py`), and flag it at the top of the
   report with the one-line re-record that would fix it.
2b. **Cut the voice.** Transcription is **Fish Audio**, not ElevenLabs Scribe. Use this skill's own scripts, never
   the Scribe scripts in `albert-reel-ui`. `S=/Users/albertbakhoj/Desktop/ReelCreator/.claude/skills/albert-reel-dark/scripts`
   - raw takes: `python3 $S/transcribe.py edit/master.mkv --edit-dir edit/raw --language en`
   - final cut: `python3 $S/transcribe.py edit/tight.mkv --edit-dir edit/final-timing --language en`
     (writes `edit/final-timing/transcripts/tight.json`, which `fix_words.py` reads)
   - splice audit: `python3 $S/splice_audit.py edit/edl.json edit/tight.mkv --language en`
   Fish times every word itself (one segment per word, 40 ms grid); `align_words.py` keeps those times
   (`"timing": "fish"`), restores the punctuation, and force-aligns locally (MMS_FA) only if Fish ever returns
   multi-word segments (`--force-align` re-times everything). A word with `"timing": "estimated"` had no
   letters to time (e.g. "—") or a failed chunk: check it on the RMS profile before landing a graphic on it.
   Key setup, caching and costs: `references/fish-audio.md`. Older lessons and `template/examples` say "Scribe" — that was the previous
   transcriber; read it as "the transcript". Take selection still follows the `albert-reel-ui` skill
   (`~/Desktop/ContentHouse/.agents/skills/albert-reel-ui`). Start from
   `examples/build_cut_dual_source.py` (last take wins, outward edge scan, fixed 70/100 ms pads, hook 1.12×,
   `FORCE_END` + longer fade for a take that ends inside running speech, 0.22 s ring-out on the CTA). Split one take
   into two beats when it contains a breath ≥ 0.3 s.
   A range named `<beat>+` is a continuation of the previous beat (same take, a real gap tightened): its own segment,
   merged into the beat. Only tighten gaps the 10 ms RMS confirms (the builder prints quiet runs inside each range;
   transcript word edges can lag the sound and invent pauses). A beat boundary inside a continuous take is a *split at the word onset*
   in `fix_words.py`, not a cut — and delete `edit/beats-raw.json` after every re-cut or the split reads stale beats.
   Fish may write numbers as words ("seven hundred and fifty"): merge them to `750` in `fix_words.py`.
   Output: `edit/tight.mkv` (PCM audio), `edit/transcript.json` (final-cut word timings),
   `edit/beats.json` (named beats), `edit/edl.json`, `edit/segments/NN.mkv`, `edit/concat.txt`.
   If a verified cut already exists for the same footage, reuse it and say so.
3. **Beat map first.** One row per spoken beat: mode (full/split), surface, action, payoff.
   Mark the one or two *feeling* lines that get a meme instead of UI ("if you're like me…", "and boom") and pick the
   GIFs before drawing anything - see `references/memes.md` (Albert's links first, else giphy.com in the built-in browser,
   `helpers/gif_frames.py` to convert, `scenes.gif_card()` to draw).
   Every beat gets a different surface. Alternate face and full screen at meaningful lines — the Laya rhythm was
   **F S S S F S F S S F S F S** (5 full / 8 split): full screen for the hook, the hero object, the numbers, the real
   page and the partner reveal; his face for reactions, the name, and the CTA. Build an arc, not a list:
   mystery ("?" tile) → tease (lens glimpses the logo) → reveal (tile flips on the name) → proof (numbers) →
   honest caveat (the real page) → fix → CTA.
4. **Write `scenes.py`.** Recreate every UI with Pillow: `window()`, `apptile()`, `sf()` SF Pro,
   `ny()` New York, real brand PNGs from `assets/icons`. No screenshots. Fictional demo sites and demo products are
   always called **Shiney.ai** (`shiney.ai/…` in address bars) — Albert, 22 Sep 2026; never `shiney.ai`. Translucent fills go through `rr()` (it blends; never punch alpha holes).
5. **Preview before rendering.** `python3 render.py --preview` (contact sheet),
   `python3 render.py --strip <beat> t1,t2,t3` (motion strip) and `python3 gridstrip.py <tag> beatA,beatB,beatC 6`
   (several beats, six evenly spaced frames each, in one sheet — the fastest way to review). Read the images. Fix layout,
   cut-off elements, draw order (a selected card must be composited last), timing leads. For any hand/prop choreography
   also run `python3 strips.py <beat> t0 t1 12` across each phase change and read the dense strip (snaps show as jumps).
   Then **smoke-test every beat** (start / middle / last frame through `render.frame`) — a NameError at frame 450 wastes
   a five-minute render. On the same sheets, check there is no word stamp/label laid over any scene (rule 32) and no
   link chip in the CTA (rule 20).
6. **Render, mix, verify.** `python3 render.py && python3 mix.py && python3 qa.py` (in the background: wait on
   `grep -qE "^mixed|Traceback" renders/render.log` — never on `Error`, ffmpeg prints broken-pipe errors *after* a Python
   crash and the gates would run on the old file), then `python3 check_provenance.py` and the three gates:
   `check_air.py` (no quiet run ≥ 0.30 s), `check_motion.py` (no beat still > 0.60 s), `check_frames.py` (no blank
   frame, zero ink in the top 180 px, nothing under the cinematic words). All three are reel-agnostic (they read
   `scenes.json` and the newest `renders/FINAL-*.mp4`). Also: last caption covers the final word, true peak < −1 dBFS,
   the splice audit (`$S/splice_audit.py`) reads every join as the intended sentence. Fix and re-render until all pass.
7. **Deliver** with `SendUserFile` (render), write `README.md` (scene table, sound, verification,
   what was reused), zip the editable project (exclude master/segments/renders).
8. **Comment automation.** When asked, run `ig-reel-dm-automation` logic with the Blotato MCP:
   keyword = the spoken CTA word from the final-cut transcript, one link per promise, account-wide
   trigger if the reel is not posted through Blotato, `isActive: true`, no follow gate unless asked.
   The link lives in the DM only. The on-screen CTA is the Instagram comment UI typing and posting the keyword (a like
   on the last word keeps it moving). No link chip/pill under it: rejected 25 Sep 2026 (rule 20).

## Accepted examples (start from these, do not reinvent)

### Laya reel, 21 Sep 2026 — the current gold standard
Every file runs from the template root (`python3 examples/<file>.py` writes `<file>_strip.jpg`).

- **`gun_hook.py` — "tile does something physical to tile" hook.** Albert's brief was one sentence ("have JEV be shot
  up by this new model that should have '?' inside of it") — when he describes a hook, build exactly that, it
  overrides the scythe default. Recipe: rival = its official square icon as a big tile with its name under it; the
  new tool = ink squircle with a white "?" (unrevealed until the name is spoken later); one round per stressed word,
  a three-round burst on the run-up, the **last round on the rival's name breaks the tile into shards** under
  gravity. Each round = 2-frame muzzle flash + tracer + recoil + ejected brass + a hole drawn **on** the tile (so it
  rides the jolt) + chips + a 2-frame camera kick. Sound: `examples/make_gunshot.py` (synth, −15/−17/−19 dB) +
  whoosh on the break. The same skeleton works for any verb: slash, crush, outrun, eat, unplug.
- **`macbook.py` — the MacBook.** Whenever the script says local / on your computer / offline / on-device, show this.
  Drawn from scratch (notch, bezel, aluminium base, lid opens about the hinge, Sonoma-style wallpaper, menu bar).
  In `laya_scenes_full.local` it carries the whole beat: lid is up by "local", the tool's tile drops into the Dock
  and bounces, Terminal types the **real install command** and prints the **README's real example output**, the
  Wi-Fi glyph gets struck through on "your own", a green "ran on this Mac" line lands on "computer". A small
  `macbook(430,…)` doubles as the laptop in diagrams (`cloud`).
- **`readme_zoom.py` — the favourite page+zoom+highlight move on a GitHub repo.** Real header (owner/repo, Star/Fork
  counts), README column + About sidebar, the project's own logo lockup, real bullets. `_rich()` word-wraps mixed
  bold/regular/code text and records highlight boxes per line; `sweep(hid,t0,dur)` runs the yellow marker across
  them on the spoken keyword with the cursor riding the tip. Use it for the honest-caveat line — quoting the
  project's own "limits" section is what makes the caveat credible.
- **`laya_scenes_full.py`** — all 13 scenes, importable: drag-strip race (`faster`), magnifier that glimpses the logo
  inside the "?" tile (`possible`), tile flip + wordmark + real tagline + repo/★/licence pills (`naya`), dark editor
  with strike-through (`nocode`), **latency card that counts up and lands on both spoken numbers, with a dot crossing
  the bar in real time (once per 250 ms) and a card that GROWS for the second row instead of showing an empty slot**
  (`speed`), laptop↔cloud diagram whose route un-draws on "doesn't" (`cloud`), speedometer (`muchfast`), fine-tune
  curve counting the README's 0.362 → 0.766 + preset chips (`tuned`), partner reveal "tile + tile" over a typed
  Claude Code prompt (`claude`), comments + the real link chip that goes blue on "send" (`cta`). **The link chip was
  rejected on 25 Sep 2026** — don't copy that part: the CTA is the comment UI typing and posting the keyword, no link pill.
- **`brand.py`** (template root) — `tile_jev` / `tile_laya` / `tile_q` / `tracked()`. Official icons come from the
  brand's own site first: `curl` the homepage, grep `apple-touch-icon` / `rel="icon"` / `og:image`; then the repo's
  `assets/` (redraw the SVG mark with Pillow so it is sharp at any size); lobehub `icons-static-png` last.
- **`build_cut_dual_source.py`, `laya_mix.py`, `laya_README.md`** — the cut, the 91-cue sheet, and the delivery note
  (use its structure: flag first, sources, cut table, scene table, sound, verification, not done).

### Opus 5.5 / CLAUDE.md reel, 23 Sep 2026 — eight revision rounds (`examples/bazooka_hook.py`, `claudeapp.py`, `opus55_*`)
Albert's notes and what each became are in `references/lessons-2026-09-23.md`. Every file runs from the template root.

- **`bazooka_hook.py` — two real people in square photo boxes, one HOLDS a bazooka and fires it at the other, full-frame
  explosion as the transition.** Portraits from Wikimedia Commons (CC BY 2.0, cropped square so they face each other, 18 px
  corners, hairline), app tiles as corner badges. The launcher is drawn at 4× with shading and is *held*: two sleeves in the
  photo's suit colour reach out of the box to both grips, the tube across the chest below the chin (never across the face).
  Launch on the verb, rocket on a smoke trail, impact on the rival's name: photo shards + `explosion(im,u)` that covers the
  frame by the beat's last frame and is called again by the *next* beat with continued time so it clears in 0.43 s.
  `render.py` exports the windows as `fx` in `scenes.json`; `check_frames.py` skips its safe-top / under-caption tests there.
- **No dead air after a transition.** The next beat's hero (the Opus 5.5 tile) is already falling through the clearing smoke
  and lands on the first spoken word; the literal word ("dropped") gets a second landing. Nothing under the wordmark - pills
  under a title were removed on request.
- **`claudeapp.py` — the Claude Code desktop app recreated** (sidebar, project groups, "Albert · Max", prompt field, the model
  chip and its picker). One `app(w,h,t,ed)` draws every state; four beats share it with a different action each (tab pops →
  lines typed on the spoken words via `scenes.typed()` → the cursor opens the picker and picks Opus 5.5 → lines stream in with
  a paste flash, save wash, scroll back). `deliverables/CLAUDE.md` is generated from the same constants so the DM matches.
- **Claude's gesture = a drawn terracotta hand on a short arm** (`scenes.fist(ext)`): emoji hands were rejected. Fist at
  0.62× (~95 px), middle finger ≈ 0.9× the fist height, thumb wrapped in front, 1.5 px dark outline; arm ~120 px of overlapping
  discs from the tile's side, the fist seated on the arm's end. Out on the feeling word, finger flicks up on the next, pumps
  on the following words, wag on the last. Six rounds of proportion notes - start from these numbers.
- **Memes** (`references/memes.md`): three in this reel - The Office grimace on "if you're like me" (940 px card, watermark
  cropped out, Claude + finger under it), the Wolf of Wall Street dance bursting in with confetti on "And boom", and a Tenor
  "use your brain" GIF that *replaces the whole panel* on "if you do this" ("show this only"). GIF → 30 fps frames.
- **Curvy connectors.** Dispatch/routing lines are cubic S-curves drawn progressively (`boom`); straight lines were rejected.
- Also: the frontier-model row whose usage bars go red, a bar that drains green on "solve" (tile bounces/hops while waiting),
  a sub-agent list whose chips spin like a split-flap until each locks on its word, `sweep()` light bands and hover highlights
  to keep waiting cards alive for `check_motion`.

### AI-killed-software reel, 22 Sep 2026 — eight revision rounds, all applied (`examples/aiks_*`)
Albert's notes and what each became are in `references/lessons-2026-09-22.md`. Every file runs from the template root.

- **`mg_hook.py` — Claude with a machine gun, full auto.** `shot_times()` fires one round every 75 ms from the verb
  ("killed") to the target's name ("software"); each round = flash + tracer + hole drawn ON the tile + chips + brass + camera
  kick; the last round breaks the tile into shards. Sound: `audio/sources/mg-round.wav` (`make_mg_round.py`) −19 dB per
  round, −16 first, pistol crack + whoosh on the break. Target was the official Salesforce App Store icon.
- **`shootout.py` — Claude vs a wall of app icons.** Six official icons (`tile_app`: Salesforce, Notion, Slack, HubSpot,
  Zoom, Dropbox) in a 3×2 wall, three rounds per tile sweeping the wall, the gun aims per target, a tile shatters on its
  third round, the last on the spoken word. Reuse for any "won't be X" / "kills all of these".
- **`article_zoom.py` — the page+zoom+highlight move on an article** (Foundation Capital's "4.6 trillion dollars"): announcement
  bar, nav, eyebrow, H1, byline, a sheared italic lead line; push-in, highlighter on the sourced sentence, cursor on the tip.
- **`aiks_scenes_full.py`** — all 17 scenes: `cupsgame` (shell game: Claude tile in 🎩, terracotta arms, both hands, cups
  thrown one per word from "was never", hat off, money on his head — one continuous choreography drawn by two beats),
  `spend` (real US outline from GeoJSON + Fluent buildings on real cities + the **split-flap counter** 750,000,000,000 dollars),
  `alot` (bars in a 620-tall card, the "?" bar bounces off the ceiling), `six` (shared-axis card that grows, 6× chip,
  count-up + green frame, software row fades back, ticks + light sweep), `jobs` (Fluent figure tiles re-centring as they
  land), `why` (4K-keyed Apple 🤔 + question marks), `tool` (ten `shiney.ai` tabs closed one by one, window collapses),
  `done` (MacBook app: button press → spinner → tasks tick → "Complete ✓" sheet → OK), `humans` (avatar grid drops,
  Claude lands), `service` (Google local pack: "Shiney.ai Accounting" slides in at the top, Book → Booked ✓),
  `skills` (chips, cursor picks ≥ 0.4 s apart), `turn` (drawn storefront: lights, awning, OPEN), `cta` (comments +
  guide chip that floats, like on the last word — **the chip was rejected on 25 Sep 2026**: keep the comment UI typing
  and posting the keyword plus the like, no link/guide pill).
- **`build_cut_continuations.py`** (`<beat>+` ranges, quiet-run report), **`fix_words_split.py`** (number merges, beat
  split at a word onset, audit EDL), **`aiks_mix.py`** (200 cues: flap ticks, tab clicks, rounds, throws, hat, Book).
- New gates/helpers in the template root: **`check_provenance.py`** (lag-searched 1.0 correlation per take),
  **`strips.py`** (dense frame strips across a transition), `qa.py` now generic (newest FINAL, own master, speed-aware).
- **`brand.py`** gained `emoji()`, `tile_emoji`, `tile_fluent`, `tile_app`, `tile_icon`, `tile_software`, `tile_salesforce`;
  assets: `assets/icons/<App>.png` (App Store icons), `assets/icons/fluent/`, `assets/geo/us-states.json`,
  `assets/emoji/think-4k.png`.

### Freebuff reel, 17 Sep 2026

Working code from the accepted Freebuff reel. Each file runs on its own from the template root and carries its
recipe in the docstring.

- **`pricing_zoom.py` — the "page + zoom + highlight" scene. Albert's favourite; use it whenever a line names a price,
  plan, feature row, stat or any specific spot on a real web page** (pricing pages, docs, leaderboards, changelogs,
  GitHub repos, tweets). Recipe: scrape the live page for its real copy → draw the whole page once at 2x and cache it →
  Safari window with the real URL → cards arrive in the wide shot → `smooth()` camera push-in to the target card starting
  just before the verb → the key number is drawn live so it counts up and lands on the spoken word with a red frame →
  tilt down and sweep a yellow highlighter across the exact row on the second keyword → cursor follows. `strip` preview:
  `examples/pricing_zoom_strip.jpg`.
- **`eyes_hook.py` — animated 👀 hook.** Eyes emoji redrawn 1:1 at high resolution (the system emoji bitmap is only
  ~155 px), looks left, blinks, looks right over the first phrase, then shrinks up and watches each icon land on its
  spoken name. No empty slot outlines before icons land. Preview: `examples/eyes_hook_strip.jpg`.
- **`build_cut_with_speed.py`, `fix_words.py`** — take selection with per-beat `SPEED` (hook 1.12×), un-snapped hook ranges,
  and the transcript corrections to re-run after every transcription pass (numbers, merged model tokens like "GPT-5.6,").
  `helpers/editorial_caption.py` now supports `g['big']`, `g['color']` and `g['cap']`.
- **`freebuff_scenes_full.py`** — the full accepted `scenes.py` for reference: brand `tile()` from real marks, Freebuff
  terminal with real ad-card format, receipt printer, scissors cutting a credit card, "Pay with" sheet, dark model list,
  hour strip + refill meter, bar charts that count up, dark podium, cost-per-year chart.

## Critical rules

0. **Dark mode, always** (Albert, 27 Sep 2026). Ground `#0A0A0B`, cards `#1C1C1E` with a hairline edge, light text,
   Apple dark system colours, products in their own dark theme. Use the tokens in `draw.py` (`BG CARD CARD2 INK GRAY
   LINE HAIR BLUE GREEN RED`), never literal light colours; translate anything copied from `examples/` with the
   table in `style.md`. Check every preview sheet for dark-on-dark elements before rendering.
1. Recreate UI; do not screenshot. Real icons, Apple chrome, product-true colors and copy.
2. Hook is no-face and physical. If Albert describes the hook, build exactly that (`examples/gun_hook.py`: the "?"
   tile shoots up the rival's tile). Otherwise default to the Claude icon swinging a scythe so each generic site
   splits on a spoken word (see `scenes.hook`). Keep it big: tiles ≥ 280 px, cards ≥ 600 px wide, nothing cut off,
   and something already moving on frame 0.
3. Caption clicks on first and last word of **every** full-screen cinematic group (Albert's choice
   here overrides the older hook-only default). Presenter chips stay silent.
4. Full-screen scenes: UI in the upper area, cinematic words centred around y≈980–1150 (scene coordinates), nothing below.
   **Instagram safe top:** `render.py` moves every graphics frame down by `TOP_SHIFT=90` and puts the split line at
   `SPLIT_Y=858` (was 768), because Instagram trims/overlays the top of reels and Albert saw the top cut off. Author scenes
   in the old coordinates (panel at (70,104), split 768); never draw anything important above scene-y 100, which lands at
   y≈190 on screen. Set `CROP_Y` so the face still sits well inside the shorter 1080×1062 presenter crop, and check the
   preview sheet: nothing within ~180 px of the top edge, nothing important in the bottom 90 px of a scene canvas.
5. Each beat a distinct surface. Do not replay a screen for another line.
6. Visual cues that must "land" on a word lead it by ~0.13 s (Dock pops); springs ≤ 0.3 s.
7. Nothing static for more than ~0.6 s inside a beat: build, select, hover, sweep, pile up.
8. Never retime dialogue to fit graphics; retime graphics to the transcript's word onsets via `at(beat, word)`.
9. Voice-only edits (cutting a word or a beat) follow `revisions.md` exactly and get a splice audit (`scripts/splice_audit.py`).
10. Report honestly: perceptual listening is not available; say the checks were signal-based.
11. Never use `txt(..., tracking=…)` for display words: it aligns every glyph to its own top and breaks the baseline
    ("freebuff", "Pricing" looked broken). Draw the word as one string (`ImageDraw.text(..., anchor='mm')`).
12. Text inside rows is vertically centred with `anchor='lm'`/`'rm'` on the row's centre line, never top-aligned by eye.
    A strike-through goes through the x-height middle measured with `textbbox`, and draws in left to right.
13. Hook pacing: Albert likes the hook voice ~1.12× (`atempo`, pitch kept; hook has no face so picture is retimed with it)
    and NO air between list items. Hook ranges keep exact trough times — do not snap them outward to 1/30 s (that adds up
    to 66 ms per join). Target 10–20 ms of near-silence at each hook join, then re-transcribe and re-run the splice audit.
14. Hook captions: break before each named item; give the payoff its own group, larger and green
    (`g['big']=170; g['color']='#1E8E3E'`, e.g. "completely" → "for free"). Sentence-start words get a capital (`cap`).
15. Music: Albert picks the song. Find the viral part by measurement — open `instagram.com/reels/audio/<id>/` in the
    built-in browser (works logged out), take 5–6 example Reels, run `match_music_excerpt.py` against the official
    upload, and use the start offset most Reels share; put the first hit / beat drop on the first icon landing.
    Say plainly when a section was chosen by structure instead. Use an up-to-date `yt-dlp` (a scratch venv is fine).
    Default stays the approved Timeless excerpt. Ask before downloading reference Reels; delete them after matching.
16. **Fact-check before you draw.** Product names, numbers and claims come from the live site/repo scraped today,
    never from the teleprompter or memory. Quote the source in the scene docstring and the README. If the script is
    wrong, keep the voice, show the truth, flag it first in the report.
17. **Every number on screen is spoken or sourced.** Spoken numbers count up and land exactly on their word with a
    frame (red for the rival, green for the hero); sourced numbers (stars, versions, accuracies, example outputs) are
    copied from the README. No invented benchmarks, badges or percentages.
18. **No empty halves.** A card that will receive a second row starts small and *grows* when the row arrives; a tile
    waiting for a partner sits centred and slides aside when the partner lands. Never park blank space or placeholder
    outlines.
19. **Keep the new tool a mystery until its name is spoken.** Use the "?" tile in every beat before the reveal, tease
    once (lens, silhouette), flip to the real mark exactly on the name, then use the real tile everywhere after.
20. **Literal objects for literal words:** "local / your computer" → the MacBook; "cloud and back" → a packet on a
    route; "faster" → a race or a gauge; "can't write code" → code being struck out; "tuned/trained" → a training
    curve; "comment X" → the comment UI typing and posting the keyword, nothing under it (the link chip with icon + URL
    + send arrow was rejected on 25 Sep 2026: "Remove this too"; the link goes in the DM).

21. **Never draw your own person or character figures** (Albert, 22 Sep 2026: "Don't make your own person figures. Find
    icons online instead"). People, professions, hands, props and mascots come from icons found on the internet:
    Apple Color Emoji for single-codepoint glyphs (🎩 💵 🏢 🦄, rendered at the font's native 160 px, never upscaled;
    profession emoji are ZWJ sequences Pillow cannot shape without raqm, so don't rely on them), Microsoft Fluent 3D
    emoji PNGs for people and objects (`raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/<Name>/3D/…png`,
    people under `<Name>/Default/3D/`), and official app icons via the iTunes Search API
    (`itunes.apple.com/search?term=<app>&entity=software` → `artworkUrl512`). Drawn geometry stays for UI chrome, charts,
    tables, cups, guns and other props. The Claude tile is the only "character" you draw yourself.
22. **A named country gets its real outline.** When the script says "US companies", "in Denmark", "European …", show
    the country's silhouette drawn from real geodata fetched online (GeoJSON, e.g. PublicaMundi `us-states.json`, ink
    fill with white state lines) and make it *do* something on the word: wipe in, then icons popping on real city
    coordinates (Fluent "office building" for companies). A flag emoji alone is not enough (Albert, 22 Sep 2026).
23. **Shell game = Claude in a top hat.** When cups/shuffling are the metaphor, the Claude tile stands behind the table
    wearing 🎩, two **terracotta** arms (curved, with darker hands, same colour as the tile — Albert: "orange arms") follow
    the cup being moved, and the reveal is under the hat ("in plain sight" = the money was on his head). Reveals fire
    early and fast (hat off in ≈0.18 s right after the word before the payoff word, money already showing on the payoff).
    Premium finish: shaded cups with a rim band, a table board with a soft shadow, shadow under the hat, glow behind the money. See `content/2026-09-22-ai-killed-software/scenes.py` (`_table`, `worry`, `hidden`).
24. **No grey sub-line under a row title or card headline** (Albert, 22 Sep 2026, crossed them out): "Software" not
    "Software / US companies, per year"; "US companies" not "US companies / spend on software". One line per row; the
    number, the bar and the chip carry the rest. (Extends the older "no eyebrows, no section labels" rule.)
25. **"Why is that?" / any thinking beat = the Apple 🤔**, the 4K keyed version from the 19 Sep reel
    (`assets/emoji/think-4k.png` + the `think(size)` matte function): pops in, rocks while he asks, hops on the question
    word, shakes on the last word, question marks spring in around it. Never the ink "?" tile for a question beat.
26. **A list of props being dismissed = thrown away, one per stressed word, spread out.** Start the throws early ("was never"),
    one every ≈0.9 s across beats (grab 0.10 s, flight ≈ 0.45 s with spin) — Albert: three throws in 0.5 s "feels rushed".
    The reveal follows the last throw within 0.2 s of the word before the payoff; the payoff word only adds a pulse; while
    a hand waits on a prop, the prop wiggles.
27. **Anything that grows off the top of a card is wrong.** Size the card so the top of the tallest element stays inside
    (a 940×620 card fits under the split line); let it bounce off the ceiling instead of leaving the frame.

29. **One to three memes per reel, on the feeling lines** (Albert, 23 Sep 2026). "If you're like me…" gets a grimace
    reaction, the payoff ("and boom") gets a celebration, "if you do this" got a "use your brain" GIF; never on a proof beat.
    Full-width rounded card (940 px), the platform watermark cropped out, lands on the feeling word, plays at the GIF's own
    pace, flies out when the explanation starts. When he names a GIF for a line ("show this only") it replaces the whole
    panel. Sources, sizes and the converter are in `references/memes.md`. The hook stays physical; a meme is not a hook.
30. **Claude's gestures are drawn in terracotta, never emoji** (Albert, 23 Sep 2026: "don't use emoji, create an orange fuck
    finger"). Hand = `fist()` at ~95 px on a ~120 px arm of overlapping discs, fist seated on the arm's end, 1.5 px outline,
    middle finger ≈ 0.9× the fist. Preview gestures as a 2× close-up before rendering; he tunes them in small steps.
31. **Real people hold their props.** A photo box gets sleeves in its own suit colour reaching to both grips; the prop crosses
    the chest below the chin, never the face. Diagram connectors are curves, not straight lines.

28. **Shell-game motion is one continuous choreography for every beat it spans** (`cupsgame(T)` in the 22 Sep reel):
    cups and both hands are position *tracks* (phases with smooth blends between them), the second beat calls the same
    function with `t + previous beat duration` and does **not** re-enter the card — that is what removed the "cuts" and
    flicker Albert saw. Both arms work: left hand takes the left cup, right hand the right one, they cross on shuffles,
    each throw is done by the hand on that side, one hand takes the hat while the other does the ta-da.

32. **No stamp/label overlays** (Albert, 25 Sep 2026: "Remove that 'GONE' label and make sure it can never do it
    again… I hate labels like that"). Never slam, pop or stamp a word over a scene to announce what just happened or to
    repeat the spoken word: no GONE, SOLD OUT, EXPIRED, DONE, NEW, FREE, WOW, no rubber stamp, no diagonal banner, no big
    word badge landing with a thud. The spoken word is already in the caption; the animation itself must show it (the
    pool drains, the counter hits zero, the bar empties, the tile breaks). If a payoff feels weak, push the physical action,
    never add a word on top. **Allowed:** text that is part of a recreated real interface and would be on that real
    screen: a real page's button or copy, a real app's own status chip or sheet ("Booked ✓", "Complete ✓"), the product's
    own copy; and spoken/sourced numbers (rule 17). Test: would this word be on the real screen being recreated? If it
    only restates the line, cut it, and cut its sound cue in `mix.py`.

## Rejected on the 25 Sep 2026 reel (don't repeat)

- The red "GONE" stamp (red rounded outline, SF Pro Heavy, popped in with a thud + whoosh on the second "gone") over the
  card where the 20M-dollar pool drains to zero. Any word stamp/label over a scene (rule 32).
- The CTA link chip under the Instagram comment: white pill with the Higgsfield icon, the URL writing on
  ("open.higgsfield.ai/cashback") and a send arrow that went blue on "send" — removed on request ("Remove this too"). The
  CTA is the comment UI typing and posting the keyword, no link pill (rule 20).

## Rejected on the 23 Sep 2026 reel (don't repeat)

- The launcher floating above the box, or crossing his eyes; the Claude badge under the arms.
- A wait between the explosion clearing and the first payoff; three sourced pills under the wordmark.
- The Apple 🖕 emoji as Claude's hand; a big hand (300 px) rising out of the tile; a long arm (210 px); a thin over-long
  finger; a wrist stub hanging under the fist; a 4 px arm outline; a red "Usage limit reached" pill next to the gesture.
- A CLAUDE.md file icon with a cursor click for "do this"; the Fluent 3D brain with a glow (he sent a GIF instead).
- Straight connector lines in the routing diagram; a meme card with the Peacock watermark; a 760 px meme card.

## Rejected on the 22 Sep 2026 reel (don't repeat)

- A drawn bush the lens searches; a narrow street lamp with a bill behind it (for "hidden in plain sight").
- Hand-drawn stick/tile-headed figures: one that keels over with a headstone, one that takes off a mask, one typing
  at a MacBook next to an email "from Jeff". Any self-drawn person figure.
- A plain "750 dollars" count-up (he wants every zero: split-flap counter), a "free guide" cover popup in the CTA,
  fast cursor clicks 0.2 s apart (picks should be ≥ 0.4 s apart with the cursor gliding between them).

## Template entry points

- `align.py CAM MIC`: dual-source master + teleprompter frame. `gridstrip.py`, `strips.py` (dense transition strips),
  `check_air.py`, `check_motion.py`, `check_frames.py`, `check_provenance.py`: review sheets and the four gates.
- `render.py`: per-reel config block (`CROP_Y`, `FULL`, `CAPY`, special/serif words, **`OVERRIDE`** = manual caption
  groups for full-screen beats with `cap` / `big` / `color`); `at(name, word, default, nth)`.
- `brand.py`: official-icon tiles (`tile_app` from the iTunes Search API), Fluent 3D figure tiles, Apple emoji tiles, redrawn
  SVG marks, the "?" tile, the generic software tile, baseline-safe `tracked()` small caps.
- `scenes.py`: `graphics(b,t,S,at)` dispatch; `hook`, `generic_full` (icons spit colour-varied
  sites left/right), `teach` carousel with hearts below cards, `investment` wireframe→paint with
  Figma-style selection, `dock`, `document`, `refero_gallery(pick)`, `agent`, `appstore`, `cta`.
- `mix.py`: caption clicks for `mode=='full'`, slash whooshes, one click per UI press, quiet pops,
  approved Timeless excerpt at −29 LUFS with gentle ducking. Keep `renders/clean-voice.mp4` as the base.

Use `$ARGUMENTS` as the footage paths or the revision request. If it is a revision, do only that
revision, re-render, re-verify, re-send, and keep the previous cut as `edit/tight-vN.mkv`.
