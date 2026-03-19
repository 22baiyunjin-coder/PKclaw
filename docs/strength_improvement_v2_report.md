# PKclaw 8-Handed Strength Improvement Report (V2 Plan)

## Scope

This report freezes the current formal v1.1 evaluator and policy artifacts as baseline and defines the next training path for actual 8-handed strength improvement.

This is not a solver roadmap.
This is a practical teacher-quality and data-quality upgrade plan.

Frozen baselines:

- `outputs/policy_baseline_v1/`
- `outputs/policy_v1_1/`
- `outputs/evaluator_v1/evaluator_v1_baseline.joblib`

## Executive Diagnosis

The main bottleneck is no longer model plumbing.
The main bottleneck is that the current teacher still produces weak or distorted behavior in important 8-handed spots, and the learned policy is mostly learning a cleaner version of that behavior.

The biggest issues are:

1. preflop teacher quality is too weak in core 8-handed spots
2. current policy data export still collapses important preflop spot types
3. heads-up and multiway postflop are still mixed too aggressively in one generic path
4. turn and river threshold decisions are still driven by coarse bucket logic rather than dedicated hard-spot treatment

## 1. Weakness Diagnosis

### 1.1 Preflop open / defend / 3-bet

This is currently the weakest area and should be treated as a separate teacher problem.

Evidence:

- In `outputs/policy_v1_1/policy_validation_v1_1.json`, the fixed scenario mismatches are still:
  - `preflop unopened pot`: teacher opens, learned checks
  - `late-position steal spot`: teacher opens, learned checks
- In `outputs/policy_v1_1/policy_dataset_v1_1_metadata.json`, the exported preflop set is effectively:
  - `unopened_preflop_open`: `279`
  - `facing_3bet`: `1121`
  - and none of the intended explicit preflop buckets such as `btn_steal`, `co_open`, `sb_complete_raise`, `bb_defend_vs_late_open` actually survive into the exported spot summary
- In the current preflop teacher labels, full-ring preflop action mix is:
  - `fold 0.11`
  - `call 0.74`
  - `raise 0.15`
  This is too call-heavy for sane 8-handed preflop ranges.

More severe evidence from the exported policy data:

- `facing_3bet` samples are effectively:
  - `fold 0.02`
  - `call 0.93`
  - `raise 0.05`
- By position and hand class, many preflop response samples are literally `call:1.00`, including:
  - `BB weak facing_3bet`
  - `CO weak facing_3bet`
  - `BTN weak facing_3bet`
  - `HJ weak facing_3bet`
  - `MP weak facing_3bet`
  - `SB weak facing_3bet`

This is not sane 8-handed behavior.
It strongly suggests two problems at once:

- the preflop teacher is too permissive
- the preflop spot labeling is conflating `facing open` and `facing 3-bet`

Concrete bad examples already present in `outputs/policy_v1_1/decision_samples.jsonl`:

- `TAG` opens `T3o` from `UTG+1` as a raise with `0.98` raise probability
- multiple weak and speculative hands cold-call an early open through the field

That means the next policy cycle should not keep treating preflop as one generic imitation target.

### 1.2 Heads-up postflop

Heads-up postflop is not completely broken, but it is still too bucket-driven and too discrete.

Observed heads-up flop behavior from the v1.1 policy dataset:

- `air`: `fold 1.00`
- `weak_showdown_value`: `call 0.74`, `fold 0.26`
- `medium_made_hand`: `call 1.00`
- `strong_draw`: `call 1.00`
- `strong_made_hand`: `raise 0.84`, `call 0.16`

This is structurally clean, but too rigid.
It is missing a lot of sane middle behavior:

- strong draws need some semi-bluff aggression, not pure calling
- medium strength hands need more check/bet mix and more context sensitivity
- air should not be pure give-up in every heads-up line

Diagnosis:

- heads-up postflop is not weak because the model is small
- it is weak because the current teacher buckets are too coarse and the line selection is too deterministic

### 1.3 Multiway postflop

Multiway postflop is still one of the least mature parts of the system.

Observed multiway flop behavior:

- overall `multiway_flop`:
  - `fold 0.54`
  - `check 0.31`
  - `call 0.07`
  - `bet 0.06`
  - `raise 0.01`

By hand class:

- `weak_showdown_value`:
  - `fold 0.59`
  - `check 0.40`
- `strong_draw`:
  - `fold 0.44`
  - `call 0.33`
  - `bet 0.23`
- `medium_made_hand`:
  - `fold 0.17`
  - `call 0.55`
  - `bet 0.28`
- `strong_made_hand`:
  - `raise 0.69`

Diagnosis:

- multiway folds too often with hands that should still realize equity
- strong draws are not handled consistently
- strong made hands are over-polarized into aggressive lines
- there is not enough distinction between:
  - equity realization
  - nutted protection
  - showdown-oriented checking

This part should not share the same postflop policy path as heads-up.

### 1.4 Turn / river threshold decisions

Later-street threshold logic is still usable, but too blunt.

Observed behavior:

- `facing_second_barrel`: `call 0.63`, `fold 0.33`
- `river_bluff_catch`: `call 0.69`, `fold 0.30`
- heads-up `turn weak_showdown_value`:
  - `check 0.41`
  - `call 0.35`
  - `fold 0.24`
- heads-up `river weak_showdown_value`:
  - `check 0.49`
  - `fold 0.46`
  - `call 0.05`

Diagnosis:

- turn and river behavior is still dominated by coarse class thresholds
- medium-strength and bluff-catch spots need dedicated treatment
- the current teacher is too dependent on hand bucket + evaluator score, and not sensitive enough to:
  - blocker effects
  - price
  - player count
  - line strength
  - capped vs uncapped range context

## 2. Root Causes

### 2.1 Preflop teacher is too permissive

Current preflop thresholds are too soft for a full-ring product bot, especially after style offsets are added.
This allows weak opens and weak continues that should not survive in a sane 8-handed baseline.

### 2.2 Preflop spot classification is not strong enough

The current export path relies too much on broad booleans like `facing_raise`.
In practice this causes many preflop response spots to collapse into `facing_3bet`, even when the real decision is only `facing open`.

That contaminates both:

- teacher diagnostics
- policy supervision

### 2.3 Unified policy training is still too broad

The current learned policy is cleaner than before, but it still learns from:

- preflop and postflop in one target family
- heads-up and multiway postflop in the same postflop teacher
- threshold-heavy later-street spots without dedicated corrective sampling

### 2.4 Simulator is good enough for iteration, but not perfect

The internal simulator is already aligned with the product action space and current export pipeline, which is valuable.
But it still has meaningful limitations:

- no side pots
- simplified multiway progression
- simplified state evolution for range filtering

So the simulator is usable for v2 iteration, but should not be treated as the final reference engine.

## 3. Proposed V2 Training Architecture

The next training phase should be split by decision family, not trained as one broad imitation problem.

### 3.1 Teacher stack

Build a stronger teacher in layers:

1. `PreflopTeacherV2`
   - spot-specific range logic
   - explicit 8-handed preflop groups
   - style modulation applied after sane baseline ranges, not before

2. `HeadsUpPostflopTeacherV2`
   - used only when active players <= 2
   - evaluator-driven but with line-aware rules

3. `MultiwayPostflopTeacherV2`
   - stricter than heads-up
   - lower bluff frequency
   - stronger equity-realization logic

4. `ThresholdReviewTeacherV2`
   - dedicated correction logic for:
     - turn continue / fold
     - river bluff-catch
     - thin value vs check-back

### 3.2 Policy stack

Route the next learned policy through separate paths:

1. `PreflopPolicyPath`
2. `HeadsUpPostflopPolicyPath`
3. `MultiwayPostflopPolicyPath`

Within `PreflopPolicyPath`, split by spot family:

- unopened open
- facing open
- facing 3-bet
- late-position steal
- blind defense
- squeeze opportunity

Within postflop:

- route first by `heads_up` vs `multiway`
- then allow turn/river threshold correction heads or auxiliary classifiers

### 3.3 Practical v2 target decomposition

Recommended first v2 learned-policy tasks:

1. `Preflop Open Model`
   - unopened spots only
2. `Preflop Response Model`
   - facing open / facing 3-bet / blind defense / squeeze
3. `HeadsUp Postflop Model`
   - flop / turn / river action distribution
4. `Multiway Postflop Model`
   - more conservative, with explicit continue/fold emphasis
5. optional `Threshold Assist Models`
   - binary or ternary heads for:
     - turn continue vs fold
     - river call vs fold
     - river value bet vs check

## 4. Preflop Teacher V2 Plan

Preflop should not keep using the current generic score/threshold setup as its main teacher.

Recommendation:

- define explicit baseline range groups for each 8-handed spot family
- then apply style deltas around those ranges
- do not let style offsets create obviously bad opens or calls by themselves

Required preflop spot groups:

- unopened open
- facing open
- facing 3-bet
- late-position steal
- blind defense
- squeeze opportunities

Preflop teacher output should be driven by:

- position
- prior aggressor position
- action count
- raise count
- open size
- effective stack
- hand class
- style deltas

But the teacher should be gated by sane range priors first.

## 5. Targeted Hard-Spot Dataset Plan

The next policy iteration should not be broad imitation-first.
It should be hard-spot-first.

### 5.1 Preflop dataset v2

Oversample:

- unopened preflop opens
- CO late opens
- BTN steals
- SB open / complete / raise
- BB defend vs late opens
- facing open from early position
- facing open from late position
- 3-bet opportunities
- facing 3-bet
- squeeze opportunities

Critical requirement:

- export explicit `preflop_spot_group`
- do not infer this later from weak booleans
- ensure each preflop spot group has its own hard count target

### 5.2 Postflop dataset v2

Split into two separate exports:

1. `postflop_heads_up_v2`
2. `postflop_multiway_v2`

Oversample especially:

- multiway flop continue / fold
- multiway strong draws
- multiway medium made hands
- heads-up strong draw semi-bluff spots
- turn medium-strength hands
- river bluff-catch
- river thin value
- turn/river showdown-oriented hands

### 5.3 Suggested v2 hard-spot emphasis

If we keep the next policy iteration modest, the first oversampling priorities should be:

1. unopened preflop opens
2. CO / BTN opens and steals
3. SB decisions
4. BB defend vs late open
5. 3-bet / facing 3-bet
6. multiway flop continue / fold
7. turn / river medium-strength hands

## 6. DAgger-Style Corrective Loop Design

The next iteration should include a targeted corrective loop instead of only replaying teacher behavior.

### 6.1 Loop design

1. run the current learned policy in simulation
2. detect bad or high-risk states
3. relabel those states with stronger teacher logic
4. export a corrective dataset
5. mix corrective data into the next training round with upweighting

### 6.2 What to flag as corrective states

Flag states when any of the following is true:

- learned action disagrees with stronger teacher in a high-priority spot group
- learned top action is structurally strange even if legal
- unopened preflop open turns into check/fold too often in CO/BTN/SB
- blind defense continues too wide or too passively
- weak hands over-continue in preflop response trees
- strong draws over-fold multiway
- medium-strength turn/river hands choose unstable call/check/bet lines

### 6.3 Corrective dataset format

Save a separate corrective export, for example:

- `outputs/policy_v2_corrections/corrective_samples.jsonl`

Each row should include:

- raw state
- evaluator outputs
- current policy outputs
- stronger teacher target
- divergence reason
- spot group
- priority weight

### 6.4 Why this matters

This lets us train on the states the learned policy actually mishandles, instead of repeatedly training on broad teacher data that mostly contains easy spots.

## 7. Simulator / Engine Recommendation

### 7.1 Recommendation

For the next phase, keep the current internal simulator as the main 8-handed data-generation engine, but treat it as an iterative product-aligned engine, not the final correctness oracle.

Use:

- internal simulator as the primary state/data pipeline
- `PokerKit` as the strongest external correctness reference candidate
- `clubs` as a lightweight external n-player comparison candidate
- `RLCard` only as a simplified RL sandbox, not as the main product policy engine

### 7.2 Why keep the internal simulator for v2

The internal simulator already matches:

- 8-handed positions
- current action space
- current `GameState`
- current dataset export path
- current evaluator and policy integration

That makes it the fastest way to build v2 targeted datasets and DAgger correction loops.

### 7.3 Why RLCard should not be the main engine

`RLCard` is useful as an RL environment and benchmarking sandbox, but its No-Limit Hold'em environment is still built around a simplified discrete action formulation.
That makes it a weak fit for directly defining the full product policy we want to ship.

Sources:

- [RLCard GitHub](https://github.com/datamllab/rlcard)
- [RLCard no-limit-holdem env docs](https://github.com/datamllab/rlcard/blob/master/docs/games.md)

### 7.4 Why clubs is worth evaluating, but not as the immediate primary engine

`clubs` is promising because it explicitly targets community-card poker environments and n-player configurations.
It is a better structural fit than RLCard for comparing multi-player poker dynamics.

But it would still require adaptation work to:

- align with PKclaw state snapshots
- align with current size buckets
- align with current export and replay flows

Source:

- [clubs GitHub](https://github.com/fschlatt/clubs)

### 7.5 Why PokerKit is the strongest external reference candidate

`PokerKit` is the strongest candidate if we need a richer rules/state engine for validation or future replacement support.
It offers more explicit state-machine fidelity than the current simulator and better long-term correctness potential for n-player poker states.

Source:

- [PokerKit GitHub](https://github.com/uoftcprg/pokerkit)

### 7.6 Practical engine decision

Short-term:

- keep internal simulator as primary
- add targeted validations against stronger reference logic

Medium-term:

- evaluate `PokerKit` first if simulator correctness becomes the main blocker
- evaluate `clubs` as a lighter-weight multi-player comparison engine

Do not make `RLCard` the primary 8-handed data engine for product policy training.

## 8. Recommended Implementation Order

### Phase A: diagnosis and teacher cleanup

1. freeze current v1.1 artifacts and keep them untouched
2. fix preflop spot-group labeling so `facing open` and `facing 3-bet` are explicit and separate
3. build `PreflopTeacherV2` with explicit spot-group priors
4. add a diagnostic report command that breaks behavior out by:
   - preflop open / defend / 3-bet
   - heads-up postflop
   - multiway postflop
   - turn / river threshold spots

### Phase B: split the training path

5. split policy export into:
   - `preflop_policy_v2`
   - `postflop_heads_up_v2`
   - `postflop_multiway_v2`
6. add hard-spot oversampling rules for the groups listed in this document
7. keep evaluator outputs and legal masks in every export

### Phase C: corrective data loop

8. run the current learned policy in simulation
9. detect divergence-heavy hard spots
10. relabel them with stronger teacher logic
11. export `corrective_samples_v2`
12. train next policy iteration with:
    - base teacher data
    - corrective data upweighted

### Phase D: simulator validation

13. keep internal simulator as main engine for now
14. evaluate `PokerKit` first as the external rules/correctness reference
15. evaluate `clubs` second as a lighter-weight n-player comparison engine

## Final Recommendation

Do not spend the next cycle making the model bigger.

The highest-leverage next move is:

- stronger specialized preflop teacher
- explicit heads-up vs multiway postflop split
- hard-spot dataset design
- DAgger-style corrective relabeling

That is the most practical path to a stronger 8-handed bot without turning PKclaw into a solver project.
