# Training Research — why the programs look the way they do

Compiled August 2026 for a two-person home gym (barbell, trap bar, dumbbells,
adjustable bench, dip bar, pull-up bar, med balls, bands, treadmill) with three
goals: golf performance, strength, general fitness. Sources at the bottom.

## 1. What actually drives golf clubhead speed

A 2024 systematic review with meta-analysis (Sports Medicine) found clubhead
speed significantly associated with **lower-body strength, upper-body strength,
jump displacement, jump impulse, jumping peak power, and upper-body explosive
strength** — with **jump impulse the strongest association** of all measures.
Flexibility and balance showed **no significant association** with speed
(mobility still matters for mechanics and injury risk — it just isn't the speed
lever). Rotational med-ball throw distance correlates r ≈ 0.6–0.7 with clubhead
speed. Training interventions improve speed in as little as 6 weeks; a common
rule of thumb: ~3 mph clubhead ≈ ~10 yards of carry.

**Programming implication:** heavy lower-body strength (trap-bar deadlift,
squat, split squat) + max-intent jumps and rotational med-ball throws are the
golf work. That's why every lifting session in these programs opens with
10–15 jumps/throws at ≤3 reps per set, full rest, maximum intent — Wendler's
own athlete prescription, and TPI's.

Golf is year-round in Barbados, so the programs treat every week as in-season:
volume is controlled rather than intensity, and heavy lower-body work sits
≥48h before a planned round (the app's "Round tomorrow" flag swaps it out).

## 2. Why 5/3/1 Leader/Anchor for the intermediate program

5/3/1 trains at percentages of a **training max (TM = ~90% of true 1RM)** in
3-week waves, adding +5 lb (upper) / +10 lb (lower) to the TM per cycle.
The Leader/Anchor structure maps exactly onto 12 weeks:

- **Weeks 1–3 (Leader 1):** 5s PRO (straight fives, no grinding) + 5×5
  First-Set-Last supplemental volume.
- **Week 4:** deload (40/50/60% × 5).
- **Weeks 5–7 (Leader 2):** same, heavier TM.
- **Week 8:** deload.
- **Weeks 9–11 (Anchor):** classic 5/3/1 with AMRAP PR sets, capped at RPE 9
  (always a rep in the tank) + 3×5 FSL.
- **Week 12:** TM test — work to 5 clean reps at 90% TM; the app proposes new
  TMs from the result.

FSL was chosen over Boring-But-Big because its lower fatigue cost preserves
golf freshness. The AMRAP-at-RPE-9 cap enforces a no-grinders rule at the
engine level.

## 3. Why GZCLP for the beginner program

GZCLP is the best-regarded novice linear progression because **stalls are
planned transitions, not failures**:

- **T1 (main lift):** 5×3 (last set AMRAP) → fails → 6×2 → fails → 10×1 →
  fails → reset at 90% of the day's best e1RM and restart. Load climbs +10 lb
  (squat/deadlift) or +5 lb (bench/press) every successful session.
- **T2 (supporting lift):** 3×10 → 3×8 → 3×6 stages.
- **T3 (accessories):** double progression in a rep range; add load when every
  set hits the top.

Research on women novices supports: higher rep tolerance at the same relative
load (fatigue-resistance advantage), faster lower-body than upper-body
progress, and the importance of small jumps on pressing movements. The
Foundations program honors all three — plus two technique-first weeks before
loading begins, because pattern quality beats early load.

Realistic 12-week milestones for a novice: meaningful strength on every lift,
first full push-up, first (band-assisted → unassisted) chin-up. Visible body
change typically starts after week 6; the scale is weather, trends are climate.

## 4. Periodization shape

12 weeks = 3 × 4-week blocks (accumulate → intensify → realize) with deloads
at weeks 4 and 8 (roughly halved volume) and a test/realization week 12.
Deloads are content, not code: the program data carries lighter percentages
and fewer sets, so "week 4 is easy" is visible right in the plan. Honest
caveat: meta-analyses find little difference between periodization styles —
the real value here is fatigue management and a clean test date.

## 5. Conditioning

- **Zone 2:** 2–3 treadmill sessions/week, 30–45 min at 1–4% incline, at a
  pace where full sentences are possible. Target 150+ min/week.
- **Norwegian 4×4 (optional):** 4 × (4 min hard + 3 min easy), 1×/week max
  alongside this much lifting, ≥24 h from heavy lower work. Proven ~7% VO₂max
  improvement in 8 weeks.
- **Steps:** 8–10k/day is where the mortality-risk curve flattens (Lancet
  meta-analysis, ~50k participants). A walked 18 holes ≈ 10–12k steps — golf
  days take care of themselves.

## 6. Logging design (the Hevy teardown)

The features that make Hevy-style loggers work, all replicated here:
previous-session ghost values (the progressive-overload engine), per-exercise
rest timers, set types (warmup/working/AMRAP), supersets, plate calculator,
e1RM trend charts, PR detection, volume by muscle group, body measurements,
rep-range targets, per-set RPE. Two deliberate differences: programs are
first-class (the app prescribes tonight's exact sets and reacts to results),
and everything lives local-first with a clean JSON export instead of a cloud
account.

## Sources

- Associations Between Physical Characteristics and Golf Clubhead Speed:
  Systematic Review with Meta-Analysis — Sports Medicine / PMC11239735
- Effects of Resistance Training Methods on Golf Clubhead Speed and Hitting
  Distance — Journal of Strength & Conditioning Research
- TPI articles: Best Exercises to Increase Clubhead Speed; 7 Anti-Rotation
  Exercises; Off-Season Periodization for Golf Fitness; T-Spine Mobility
- Jim Wendler — 5/3/1 Forever (Leader/Anchor, 5s PRO, FSL, 7th-Week Protocol);
  thefitness.wiki 5/3/1 Primer; Lift Vault Leader/Anchor guide
- Cody Lefever — GZCL method & GZCLP (Lift Vault / Boostcamp guides)
- Sex differences in fatigue resistance & recovery — PMC8618037, PMC6206044,
  PeerJ 20542; lower- vs upper-body gains in trained women — PLOS One 0284216
- Paluch et al., Daily steps and all-cause mortality — The Lancet Public
  Health (2022)
- Norwegian 4×4 — Helgerud et al. protocol via myworkout.com; Zone 2 —
  Uphill Athlete training zones
- Hevy feature documentation — hevyapp.com
