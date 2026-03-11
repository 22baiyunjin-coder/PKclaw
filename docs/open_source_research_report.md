# Open-Source Texas Hold'em Research Report

## Context

PKclaw is not trying to become a solver clone, an academic CFR project, or a browser/OCR automation tool.

The current product goal is narrower and more practical:

- build a stable 8-max No-Limit Texas Hold'em local decision core
- support multiple bot personalities through style parameters
- run large volumes of closed-environment self-play
- generate structured hand-history and decision datasets
- preserve modularity so the system can later support dashboards, tuning, and UI controls

Because of that goal, the correct open-source strategy is not to import a single large poker AI repo wholesale. The correct strategy is to combine the best parts of several project categories:

- evaluator libraries
- simulation / engine frameworks
- bot interface patterns
- solver-adjacent calibration ideas

## Executive Summary

### Recommendation

PKclaw should continue using its own product-oriented decision layer, but it should stop relying purely on hand-written internal abstractions when mature open-source components already exist.

The most practical direction is:

1. adopt a mature hand evaluator / equity library
2. refactor the simulator and bot interface based on proven poker-engine patterns
3. keep PKclaw's style-driven decision logic as the product-specific layer
4. use solver/CFR projects only for selective calibration, not as the core architecture

### Primary conclusion

The best immediate open-source leverage is:

- `pyeval7` for hand evaluation, ranges, and equity work
- `PyPokerEngine` for emulator / bot callback ideas
- `MIT Pokerbots Engine` for engine-bot separation and competition-style interfaces
- `PokerKit` as a modern reference for state management and variant support
- `Treys` as a lightweight fallback reference for evaluator design

### What not to do

At the current stage, PKclaw should not:

- build around OCR or screen-reading poker bots
- put an LLM in the action-selection loop
- rebuild a full CFR / DeepStack / ReBeL style system
- depend on heads-up solver projects as the main product architecture

## Research Scope

The following open-source projects were reviewed at a first-pass architecture level:

1. PyPokerEngine
2. MIT Pokerbots Engine
3. pyeval7
4. Treys
5. PokerKit

This report focuses on product applicability, not academic strength.

## Project-by-Project Findings

### 1. PyPokerEngine

Source:

- https://github.com/ishikota/PyPokerEngine
- https://github.com/ishikota/PyPokerEngine/blob/master/AI_CALLBACK_FORMAT.md

What it is:

- a Python poker framework for building poker AIs
- includes engine concepts, emulation ideas, and bot callback structure

Why it matters:

- it is close to the kind of local simulation workflow PKclaw needs
- it has a clear separation between game engine concerns and bot decision callbacks
- it demonstrates how to let bots operate on structured round-state inputs instead of raw UI signals

What PKclaw should learn from it:

- bot callback design
- emulator / simulation workflow
- clean structured state handoff into bot logic
- scenario-style replay and controlled local testing

Limitations:

- older project, not a modern product architecture out of the box
- not specifically optimized for PKclaw's style-driven 8-max product use case
- should be treated as a pattern source, not as the final system

Verdict:

- high value as an engine-interface reference
- not recommended as a wholesale dependency

### 2. MIT Pokerbots Engine

Source:

- https://github.com/mitpokerbots/engine
- https://github.com/mitpokerbots/engine/blob/master/python_skeleton/player.py

What it is:

- competition-oriented poker engine with bot skeletons and engine/bot separation

Why it matters:

- the architecture strongly reinforces the correct idea that the engine should own state progression and legality, while the bot should own action choice
- this is directly aligned with PKclaw's current needs

What PKclaw should learn from it:

- engine/bot contract design
- standardized bot entrypoints
- batch competition / tournament style evaluation workflow
- cleaner testing harnesses for comparing personalities and revisions

Notable signal:

- the project directly uses `eval7`, which reinforces that mature evaluator reuse is standard practice rather than a shortcut

Limitations:

- not a product bot core by itself
- more useful as a design reference than as a direct foundation for 8-max productization

Verdict:

- very useful for interface and simulation architecture
- should influence refactoring of PKclaw's engine/bot boundaries

### 3. pyeval7

Source:

- https://github.com/julianandrews/pyeval7

What it is:

- a poker hand evaluation and analysis library with hand ranking and range support

Why it matters:

- this is the strongest candidate for immediate adoption into PKclaw
- it helps replace fragile homemade evaluation logic with battle-tested primitives
- it also opens the door to approximate equity estimation and range-aware heuristics

What PKclaw should use it for:

- hand ranking
- board interaction checks
- range parsing and rough matchup calibration
- future preflop and postflop heuristic improvement

Strategic value:

- lets PKclaw focus on the product layer: style mapping, decision heuristics, simulation, and logging
- reduces the risk of silently incorrect internal evaluator logic

Limitations:

- not a complete poker engine
- still requires PKclaw to define its own bot strategy layer

Verdict:

- highest-priority open-source component to integrate next

### 4. Treys

Source:

- https://github.com/ihendley/treys

What it is:

- a pure Python hand evaluation library derived from Deuces-style evaluator ideas

Why it matters:

- useful as a lightweight evaluator reference
- attractive when a pure Python implementation is preferred

What PKclaw should learn from it:

- evaluator structure
- compact card encoding ideas
- simple and efficient ranking patterns

Limitations:

- narrower than `pyeval7`
- less compelling if `pyeval7` is available

Verdict:

- good fallback or reference
- not the first-choice integration target if `pyeval7` works cleanly

### 5. PokerKit

Source:

- https://github.com/uoftcprg/pokerkit

What it is:

- a modern Python poker library with broad game-state modeling coverage

Why it matters:

- useful as a reference for richer state progression and rules handling
- valuable if PKclaw later expands into more robust simulation and rules correctness

What PKclaw should learn from it:

- modern state modeling
- extensible variant architecture
- cleaner rule / state representations than many older poker repos

Limitations:

- broader than what PKclaw currently needs
- may be too heavy to adopt wholesale for this milestone

Verdict:

- valuable reference for future engine hardening
- probably not the immediate next dependency

## Categories We Should Avoid As Core Dependencies

### Solver / CFR Projects

Examples include heads-up CFR and solver repos.

Why not now:

- mostly optimized for heads-up play or research workflows
- high complexity and low product payoff for the current milestone
- poor fit for an 8-max style-driven bot MVP

Correct use later:

- selective spot calibration
- sanity checks for edge cases
- offline comparison, not runtime dependency

### OCR / Real-Client Automation Projects

Why not now:

- they solve the wrong problem for the current milestone
- they increase instability and reduce testability
- they distract from the decision-core objective

### LLM-Centric Poker Agents

Why not now:

- unstable action selection
- poor reproducibility
- weak fit for frequency-sensitive structured poker decisions
- difficult to map to style controls like VPIP, PFR, hero call, and bluff tendencies

## What This Means For PKclaw

### Keep

PKclaw should keep owning:

- style profiles
- decision heuristics
- action probability generation
- reason tags / explainability
- simulation logging
- product-facing personality controls

These are product differentiators.

### Replace or upgrade

PKclaw should replace or strengthen:

- internal evaluator primitives
- some range / equity assumptions
- engine/bot interface design
- simulation harness and statistical evaluation workflow

These are infrastructure, not differentiators.

## Recommended Integration Plan

### Phase 1: Evaluator upgrade

Priority: highest

Actions:

- integrate `pyeval7`
- replace or validate current hand-strength evaluation
- use it to improve hand classing, draw recognition, and board interaction checks
- keep PKclaw's public decision output format stable

Expected result:

- more trustworthy postflop evaluation
- reduced noise from homemade evaluator shortcuts

### Phase 2: Engine / bot interface cleanup

Priority: high

Actions:

- refactor PKclaw's engine toward a clearer `engine -> bot -> action` contract
- model bot decision entry similar to PyPokerEngine / MIT Pokerbots patterns
- make the simulator easier to batch-run and compare across bot profiles

Expected result:

- easier large-scale self-play
- easier regression testing
- easier swapping between heuristic bots and future learned models

### Phase 3: Statistical validation layer

Priority: high

Actions:

- add aggregate metrics by profile: VPIP, PFR, 3-bet rate, fold-to-cbet, WTSD, aggression factor
- compare observed frequencies against intended style targets
- use this layer to tune the bot rather than adjusting heuristics blindly

Expected result:

- strategy tuning becomes measurable instead of subjective
- profile drift becomes visible

### Phase 4: Solver-adjacent calibration

Priority: medium

Actions:

- choose a small set of representative spots
- compare PKclaw heuristics against external baseline outputs or published solver-style guidance
- use discrepancies for bounded adjustment only

Expected result:

- better realism without turning the project into a solver stack

## Practical Recommendation For The Next Development Cycle

The next development cycle should focus on three deliverables:

1. integrate `pyeval7`
2. refactor the engine/bot boundary based on PyPokerEngine and MIT Pokerbots patterns
3. add batch simulation summary metrics so style parameters can be measured against actual bot frequencies

This is the highest-leverage combination of open-source learning and product-focused implementation.

## Final Recommendation

PKclaw should not try to copy one open-source poker AI project end to end.

Instead, it should become a hybrid system:

- evaluator quality from mature libraries
- engine patterns from proven simulation frameworks
- product logic and personality controls from PKclaw itself

That is the best path to a stable, extensible 8-max decision core that can later support dataset generation, tuning, and model-assisted upgrades without collapsing into solver complexity.
