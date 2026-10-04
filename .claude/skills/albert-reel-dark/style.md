# Visual and sound contract — DARK MODE (albert-reel-dark, 27 Sep 2026)

**This skill renders every reel in dark mode.** The sections further down were written for the light (off-white)
look of the earlier reels; they still define layout, timing, motion and sound, but every *colour* in them is
translated with the table below. The tokens live in `template/draw.py`, so new code picks them up automatically.

| role | light (older sections) | dark (use this) |
|---|---|---|
| ground `BG` | `#F1F0EB` off-white | `#0A0A0B` near-black |
| card / panel `CARD` | white | `#1C1C1E` + 2 px `HAIR` edge `(255,255,255,26)` |
| raised surface, controls, pills, rows `CARD2` | `#F5F5F7`, `#F0F0F3` | `#2C2C2E` |
| primary text `INK` | `#1D1D1F` | `#F5F5F7` |
| secondary text `GRAY` | `#6E6E73`, `#8E8E93` | `#98989D` |
| separators, axes, ground lines `LINE` | `#E3E3E6`, `#E5E5EA`, `#DEDCD4` | `#38383A` |
| blue / green / red | `#0071E3` / `#34C759` / `#FF3B30` | `#0A84FF` / `#30D158` / `#FF453A` (Apple dark) |
| payoff caption green | `#1E8E3E` | `#30D158` |
| cinematic caption words | `#222224` | `#F5F5F7` (default in `editorial_caption.py`) |
| presenter chip | `#292A28` | `#1C1C1E` + `#3A3A3C` edge |
| macOS / Safari chrome | `#F6F6F6` bar, `#E9E9EB` field | `#2A2A2C` bar, `#3A3A3C` field, `#1E1E1E` body (`window()`) |
| unrevealed "?" tile | ink `#1D1D1F` | `#2C2C2E` + light ring (`tile_q`) |
| shadows | alpha 34 | alpha 110, blur 22 — plus the hairline, which is what actually separates dark cards |
| highlighter | (255,214,10,95) | (255,214,10,70) over light text; or a 6 px `YELLOW` underline sweep |
| drawn props (guns, launchers) | `#111113` ink | gunmetal `#3A3A40` / `#66666E` — ink vanishes on the ground |

- **Recreated products use their own dark theme** whenever they have one: X dark (`#000`, text `#E7E9EA`, muted
  `#71767B`, lines `#2F3336`), Instagram dark comments (`instagram_comment.render(theme='dark')`), GitHub dark,
  Safari dark, Whop's dashboard (`#000` page, `#0A0A0A` cards, `#1754D8` primary). A product with no dark theme keeps
  its real light UI inside a dark window. Never invert a real brand's colours.
- White brand tiles stay white (they pop on the ground); dark tiles get the light ring from `brand._ring`.
- Translucent fills **and edges** go through `rr()` (it blends both). Never draw a translucent outline with raw
  `ImageDraw` on a card: it punches see-through pixels.
- `template/examples/*` are the accepted light-mode reels. Reuse their motion and structure; translate their literal
  colours with the table (the `mg_hook.py` gun is already converted).
- Contrast check on every preview sheet: nothing dark-on-dark (a `#1D1D1F` element on `BG` is invisible), and no pure
  white slab bigger than a brand tile or a real white product surface (it glares at night).

---

# Visual and sound contract (accepted September 2026, Refero reel)

- **Safe top (Sept 2026):** the whole graphics layer is shifted down 90 px in `render.py` (`TOP_SHIFT`), split line and
  presenter chip at y=858, presenter crop 1080×1062. The numbers below are scene coordinates before that shift.
- 1080×1920, 30 fps, ground `#F1F0EB`. Split mode: graphics y 0–768 (panel 940×560 at (70,104)),
  presenter crop 1080×1152 at (0,440) below. Full mode: UI top, cinematic words centred (y≈982–1150).
- Type: SF Pro (`/System/Library/Fonts/SFNS.ttf`, variable weights), New York for editorial serif,
  Menlo chips for presenter captions, Arial Bold + Times Bold Italic for cinematic captions (editorial_caption.py).
- Chrome: macOS window with traffic lights, Safari-style address field with lock, 14–16 px radius,
  hairline `#E3E3E6`, soft shadow (`shadow()`), 220–350 ms entrances, 50–120 ms child stagger.
- Icons: squircle `apptile()` from real PNG marks (Apple, Notion, Duolingo, Claude, ChatGPT, Refero).
- Product fidelity: Apple hero = nav bar with  and items, "iPhone" 66 Semibold, five colour iPhones
  with tinted screens and Dynamic Island. Notion = New York headline, blue CTA. Duolingo = green
  wordmark, owl tile, green pill. Refero = mark + "/ Styles", New York headline, search + dark button.
  Claude = cream window, terracotta send circle, checklist steps. Instagram comments via helper.
- Generic "AI slop" sites: same hero layout, gradient in one of 12 palettes, "Unlock the future"-style
  copy, white pill, three translucent feature boxes (blended, never alpha holes).
- Hook: three slop windows in a zig-zag; Claude tile + scythe (`reaper()`), swing −80°…70° in 0.24 s,
  card splits along a diagonal, halves fall with gravity and fade in 0.66 s, terracotta streak + white core.
- Cursor: `pointer_motion.motion` only; approach → settle → single press → release. Arrive 2–3 frames early.
- Sound: caption mouse-down on first/last word of every full-screen group (−25 hook, −27 later);
  whoosh-snap −22 on slashes, −31 on transitions; first-click −26 per UI press; pop −29..−31 for dock,
  hearts, GET pulse, first spits. Music: Timeless (Instrumental) from 23.1176 s, −29 LUFS pre-duck,
  sidechain threshold .03 ratio 2, limiter .84. Voice ≈ −16 LUFS.
- Never add badges, eyebrows, section labels or made-up numbers. Fictional demo brand is **Shiney.ai** (was `shiney.ai` until 22 Sep 2026).
- **No word stamps or labels over a scene** (Albert, 25 Sep 2026: "I hate labels like that"; SKILL.md rule 32). Never
  slam, pop or stamp a word to announce what happened or repeat the spoken word: GONE, SOLD OUT, EXPIRED, DONE, NEW, FREE,
  WOW, a rubber stamp, a diagonal banner, a big word badge with a thud. The caption already carries the word; the
  animation shows it (pool drains, counter hits $0, bar empties, tile breaks). Fine: text that belongs to a recreated real
  interface (a real page's button, a real app's status chip or sheet, the product's own copy) and spoken/sourced numbers.

## Additions accepted September 2026 (Freebuff reel)

- Signature move: **recreated real page → camera push-in → live count-up landing on the spoken number → yellow highlighter
  sweep on the exact row** (`template/examples/pricing_zoom.py`). Page copy comes from the live site, never invented.
  Highlighter fill (255,214,10,95); price frame red #FF3B30, 3 px scaled with the zoom; zoom 0.6 s `smooth()`.
- Hook option: redrawn 👀 emoji that looks around and then watches the icons land (`template/examples/eyes_hook.py`).
  No command bars over hook icons, no "FREE" badges on icons, no empty placeholder outlines.
- Brand tiles: white squircle + real mark (lobehub `icons-static-png` on jsDelivr is a good source), hairline ring;
  a brand's own square logo is cropped to fill the tile (no white frame).
- Dark surfaces Albert liked: Freebuff-style terminal (#0B0B0D, green #54A967), dark model list, dark podium steps
  (#1D1D1F / #2C2C2E with white labels). White podiums were rejected.
- Physical metaphors over symbols: scissors cutting the credit card (no shake, no red no-entry sign); a receipt printing
  $0.00 lines instead of floating question marks.
- Payoff caption may be larger and green; everything else stays ink on off-white.

## Additions accepted September 2026 (Laya reel — Albert: "THIS REEL WAS SO GOOD")

Reference code: `template/examples/gun_hook.py`, `macbook.py`, `readme_zoom.py`, `laya_scenes_full.py`, `laya_mix.py`.

- **Tile language.** Rival = its official square icon filling the squircle (TypeSafe/Jev: magenta #E551BA from
  typesafe.ai's apple-touch-icon). Hero = white squircle + hairline ring + the mark redrawn from the project's SVG
  (Laya #2A78D6). Unrevealed hero = ink #1D1D1F squircle with a white SF Pro Heavy "?" at 66 % of the tile. Hook tiles
  280–360 px, row tiles 112 px, title-bar tiles 48 px, Dock tiles 54 px. Tiles stand on a 3 px `#DEDCD4` ground line.
- **Gun hook.** Pistol is a flat `#111113` silhouette with `#3A3A3F` port/serrations, held by a little ink "hand" nub.
  Round = flash (orange #FF7A1A / yellow #FFC933 / white core, 190 px, stretched forward, 2–3 frames) + 7 px warm tracer
  with a 3 px white core + recoil envelope `exp(-t/.07)` (gun kicks up 13°, tile leans 2°) + brass `#C9A24B` ejected
  up-and-back under g = 2600 px/s² + hole (black core, scorched magenta ring, six cracks) + 7 chips + ±7 px camera
  kick for 2 frames. Shots lead the word by .05 s (not .13 — a shot is instantaneous). Break = three polygon shards
  with their own velocity and spin, opaque for .22 s then fading; a grey smoke curl leaves the muzzle.
- **MacBook.** Lid `#0A0A0B` with a `#8E9096` edge, notch 11.8 % of width, screen radius 1.4 %, base 1.13× the lid
  width with a vertical 222→150 grey gradient, thumb scoop, blurred contact shadow. Opens from 12 % to 100 % in
  ≈ .45 s with the screen fading up from black. On the screen: translucent menu bar (, app name bold, clock, battery,
  Wi-Fi), dark Terminal `#16161A` with a `#2A2A2F` title bar and SF Mono 30 px, translucent Dock; the hero tile drops
  into the Dock and bounces `|sin(9.5u)|·46·exp(-2.6u)` with a running dot under it.
- **Number landings.** Count-up uses `smooth()` from the verb ("takes") to the number's onset so it reads the final
  value exactly on the word; frame springs in on the onset (red #FF3B30 rival, green #34C759 hero), 5 px, radius 20.
  Bars share one axis (0–250) so the ratio is honest; axis ticks arrive one by one to keep the quiet stretch alive; a
  white dot crosses the rival's bar in real time (period = the real latency).
- **GitHub page.** Drawn at 2× in GitHub's own palette (ink #1F2328, muted #59636E, line #D1D9E0, link #0969DA, tab
  underline #FD8C73, button #F6F8FA). Body 21 units in a 548-unit column so a 1.42× push-in gives ≈ 30 px on screen.
  Push-in .60 s `smooth()`, finishing .13 s before the first keyword; highlighter (255,214,10,95) sweeps .42–.62 s;
  the camera tilts ≤ 16 units with the second sweep so the section heading never leaves the frame.
- **Cards grow, tiles slide.** Latency card 440 → 750 px when row two arrives (.30 s ease); the solo tile sits centred
  and slides to the left slot as its partner springs in with a "+" that rotates 90° into place.
- **Reveal.** Tile flip = horizontal scale |cos(πp)| over .22 s ending on the name; wordmark springs .9 → 1.0; the
  project's own tagline in letter-spaced small caps drawn on one baseline (`brand.tracked`, never `txt(tracking=)`);
  pills (repo · ★ · licence) stagger 70 ms.
- **CTA.** Instagram comment helper types the keyword on "comment", posts on "and" (a like on the last word keeps it
  moving). The white link pill that used to sit underneath (real link writing on "link", paper-plane + outline blue on
  "send") was **rejected on 25 Sep 2026** ("Remove this too"): no link chip in the CTA; the link goes in the DM.
- **Captions.** Every full-screen beat gets an `OVERRIDE` row: sentence-start `cap`, payoff words in their own group
  (`big` 150–190; green for the hero's win — "free", "30"; ink for the rival's number — "250"; the rival's name big on
  the hook's last shot). Serif-italic emphasis on the hero name, the numbers, "free" and the partner ("Claude").
- **Sound.** ≈ 90 cues for 33 s. Synth gunshot −15 dB first/last, −17 singles, −19 burst; whoosh −23 on the break;
  whoosh −27…−31 on flips, sweeps, camera moves and card growth; pop −26…−31 on every landing (numbers, checks, chips,
  Dock drop); first-click −26/−27 on return key, send and post. Voice ≈ −17 LUFS integrated after the mix,
  true peak −1.4 dBFS.
- **Presenter crop.** `CROP_Y` so the hair just clears the caption chip (372 on that shoot) — check the preview sheet.

## Additions 22 Sep 2026 (AI-killed-software reel, v4)

- **Icons come from the internet, figures are never drawn.** Apple emoji at native 160 px, Microsoft Fluent 3D emoji PNGs
  (people/professions/objects), official App Store icons via the iTunes Search API. The only drawn "character" is the
  Claude tile (optionally with 🎩 and two ink arms).
- **Countries are real outlines** from GeoJSON (contiguous US: ink `#1D1D1F`, white state lines 2 px at 2×, equirectangular
  with a 1.3 lat stretch), wiped in on the word, with Fluent office buildings popping on real city coordinates.
- **Split-flap counter** for big spoken amounts: 54×92 ink tiles, seam line, white SF Pro Bold 60 digits, spinning
  (three blurred digits) until they lock left→right across the spoken number, the last digit on the unit word.
- **Shootout** (`parts/shootout.py`): Claude + SMG vs a 3×2 wall of official app icons (150 px), three rounds per tile,
  tile shatters on its third round, the gun aims per target.
- **"Acting as a service company"** = a recreated Google local pack: query typed, two firms listed, the AI company
  (Claude tile, "AI · Accounting service · Open now", Book) slides in at the top on "acting", Book → "Booked ✓".
- Cursor picks: at least 0.4 s apart, cursor glides between targets; adjacent targets when possible.
- No grey sub-line under row titles or card headlines (one line per row). Question beats use the 4K-keyed Apple 🤔.
  Dismissed props get thrown off the table one per word; reveals within 0.2 s of the last throw. Cards are sized so
  nothing leaves the frame at the top (940×620 max in split mode; the element bounces off the ceiling).

## Additions 22 Sep 2026 (AI-killed-software reel, final v8)

- **Machine gun** (`examples/mg_hook.py`): SMG silhouette 380×190 (`#111113` / `#3A3A3F`), grip pivot (130,130), muzzle
  (376,74); full auto = one round every 75 ms; per round a 2-frame flash (200 px), 7 px tracer with a 3 px white core, recoil
  `exp(-t/.06)` + a 1.2° shudder while firing, brass up-and-back, a 14 px hole with a steel-blue scorched ring (reads on white
  and on colour), 6 chips, ±7 px camera kick for 2 frames. Shards on the last round. Sound −19 dB/round, −16 first, pistol
  crack −15 + whoosh −23 on the break.
- **Shell game** (`cupsgame`): table board `#ECECEF` on `#D8D8DD` with a blurred shadow; cups 160×150 with a 58→20 grey
  gradient, rim band `(70,70,76)`, blurred specular, dark foot; Claude tile 150 px behind, Apple 🎩 at 140 px with a shadow
  under the brim; arms 24 px `#D97757` quadratic curves from the tile's sides, hands r=17 `#C4653F`; both hands work and
  cross on shuffles; throws: grab 0.10 s (+26 px), then 1500 px/s sideways, −900 px/s up, g = 1900, spin −420°/s, fade in
  0.45 s; hat off in 0.16 s (130 px right, 50 up, −28°), 💵 150 px on the head with a green glow, green pulse on the payoff word.
- **Split-flap counter**: 54×92 `#1D1D1F` tiles, seam `#3A3A3F`, white SF Pro Bold 60; spinning = three blurred digits;
  tiles flip in (y-scale) already spinning; lock left→right across the spoken number, last digit on the unit word, ink frame.
- **Country outline**: GeoJSON → equirectangular, lat stretched 1.3, ink fill, 2 px white state lines at 2×; wipes in on the
  country word; Fluent `office_building` 52 px on real city coordinates, staggered 60 ms.
- **Google local pack**: wordmark in Google's four colours (SF Pro Bold), field `#DFE1E5` outline, tabs `#1A73E8` active,
  rows with stars `#FBBC05`, category chip, "Book" `#1A73E8` → "Booked ✓" green; autocomplete dropdown while typing.
- **Tabs closing**: 10 tabs share the bar width; active tab white, others `#E2E2E6`; the cursor closes the first tab each
  time (its × drifts right as tabs widen); page swap flash; the empty window scales to 0.08 and fades.
- **MacBook app beat**: window chrome `#F0F0F2`, task rows with ring → green check, terracotta primary button 330×72 that
  depresses (0.96) and shows a spinner + "Working…", a 420×270 sheet with a 48 px check, "Complete", an OK pill, dimmed backdrop.
- **Cards in split mode may be 940×620** (bottom at scene y 724, just above the chip); size the card to the tallest element.
- **Question beat**: `think(380)` — the 4K keyed 🤔 — pops (spring .3), rocks ±7°, hops 40 px on the question word, shakes on the last.
- Fictional brand: **Shiney.ai**. No sub-lines under titles. Cursor picks ≥ 0.4 s apart.

## Additions 23 Sep 2026 (Opus 5.5 / CLAUDE.md reel, v8 after eight revision rounds)

- **Held bazooka hook** (`examples/bazooka_hook.py`): 380 px photo boxes at x 20 / 680, y 300, 18 px corners, hairline
  (0,0,0,40); names SF Pro Semibold 44 at +62; 116 px app-tile badges (holder: top corner; target: bottom-right). Launcher
  520×150 logical at 4×: tube gradient (84,84,94)→(42,42,48)→(12,12,15), wood (150,104,64)→(58,36,22), warhead
  (120,150,104)→(34,52,32), ochre nose (214,172,90)→(96,66,26), sight glint (120,170,220)/(220,240,255); pivot (200,95)
  placed at (box.x+0.60·BS, box.y+0.83·BS), levels from −22° over .42 s, recoil 7°·exp(−t/.07). Sleeves (30,42,72) 28 px
  with a (52,68,108) 9 px core from the box's right edge at 0.68·BS and 0.86·BS to the grips; hands r=16 (232,190,160)
  with a (196,146,116) 3 px ring. Launch lead .05 s, flight .26 s, muzzle flash 260 px, backblast mirrored. Fireball at 1/4
  res: R = 1900·smooth(u/.42), cools .42–.62 s, fades .52–.86 s, white flash .16 s, shockwave ring .30 s.
- **Tile drop after a transition:** free fall from y −400 timed to land on the first spoken word (v0 from g = 2600),
  squash sy = 1 − .16·e^(−v/.1)·cos(28v), dust 3 puffs a side, 2-frame 8 px kick, thud −15 dB; a 120 px jump lands again on
  the literal word. No pills under the wordmark.
- **Claude's drawn hand** (`scenes.fist(ext)`, 220×270 logical at 4×): fist (30,112)-(190,214) r 42; knuckles (34,94)-(80,142),
  (118,96)-(160,142), (156,108)-(192,150); middle finger x 84–124 from y 112 up by 12+90·ext, r 20; thumb (22,146)-(102,190)
  r 22; outline = every shape once in (150,72,42) 3 px larger, then (217,119,87); creases 3 px; highlight (236,152,120).
  Shown at 0.62×. Arm: quadratic bezier from (tile.x+TS−10, tile.y+0.58·TS) to (tile.x+TS+24+96·rise, tile.y+0.62·TS−0.16·TS·rise),
  48 discs r 14.5 outline / 13 fill; the fist placed with canvas (110,198) on the arm's end. Timing: arm out spring .36 s on
  the feeling word, finger spring .26 s on the next, pumps 16/16/28 px, wag ±10° decaying .55 s.
- **Meme cards:** 940 px wide, 26 px corners, watermark cropped (crop as fractions of the frame width), pop .34 s with the
  card already moving on frame 0; a GIF named for a line replaces the whole split panel (cover-crop, 30 px corners).
- **Curvy connectors:** cubic bezier P0 (cx, 335) · P1 (cx, 445) · P2 (x, 400) · P3 (x, 510), 40 points, #C7C7CC 5 px, drawn
  progressively over .26 s per card.
- **Motion-gate helpers:** `sweep()` (a blurred white band gliding across a card), hover highlights that move, a save wash,
  a model-changed banner, tile bounces/hops on the words before a payoff - what registers at 270 px.
