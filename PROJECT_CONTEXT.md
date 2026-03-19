# PKclaw Project Context

## Project Goal
- Build a product-oriented 8-max No-Limit Texas Hold'em bot core for a closed/local environment.
- Prioritize stability, controllability, explainability, modularity, and style-driven behavior over solver-level optimality.
- Support local simulation, data generation, and a mature-looking demo UI.

## Current Progress
- Preflop v2 repair phase has started.
- New preflop-specific modules now exist:
  - `pkbot/preflop_labeling.py`
  - `pkbot/preflop_teacher_v2.py`
  - `pkbot/preflop_validation.py`
- `PreflopTeacherV2` is now wired into `pkbot/strategy/preflop_policy.py`.
- Preflop context building now attaches explicit preflop spot labels through `pkbot/strategy/context_builder.py`.
- Policy dataset export now uses explicit preflop spot labeling and records `action_context_subtype`, reducing the old preflop collapse problem in future exports.
- A dedicated CLI flow now exists:
  - `main.py validate-preflop-v2`
  - it exports a preflop-only teacher dataset, a preflop spot report, and a preflop sanity report
- Latest smoke validation artifacts now exist under:
  - `outputs/preflop_v2_smoke3/preflop_teacher_v2_dataset.jsonl`
  - `outputs/preflop_v2_smoke3/preflop_teacher_v2_dataset.csv`
  - `outputs/preflop_v2_smoke3/preflop_spot_report.json`
  - `outputs/preflop_v2_smoke3/preflop_sanity_report.json`
- A longer fixed-seed preflop v2 validation run has now completed under:
  - `outputs/preflop_v2_validation_2000/preflop_teacher_v2_dataset.jsonl`
  - `outputs/preflop_v2_validation_2000/preflop_teacher_v2_dataset.csv`
  - `outputs/preflop_v2_validation_2000/preflop_spot_report.json`
  - `outputs/preflop_v2_validation_2000/preflop_sanity_report.json`
- The longer run materially confirms that the old preflop collapse has been repaired:
  - `unopened_preflop_open 6740`
  - `late_position_steal 910`
  - `facing_open 3463`
  - `facing_3bet 1565`
  - `blind_defense 3348`
  - `squeeze_opportunity 676`
  - `facing_squeeze 961`
- Key coverage from the longer run is now real rather than only intended:
  - `sb_first_in 54`
  - `co_first_in 591`
  - `btn_first_in 319`
  - `bb_vs_late_open 322`
  - `sb_vs_late_open 400`
  - `vs_late_open 272`
  - `opener_or_caller_facing_3bet 1011`
- The long-run preflop sanity report currently emits no warnings.
- `PreflopTeacherV2` is now the formal v2 preflop teacher source.
- Broad preflop relabeling is no longer the active path.
- The next targeted preflop calibration spot is explicitly recorded as:
  - `opener_or_caller_facing_3bet`
- Heads-up postflop v2 work has now started with dedicated modules:
  - `pkbot/postflop_labeling.py`
  - `pkbot/heads_up_postflop_teacher_v2.py`
  - `pkbot/heads_up_postflop_validation.py`
- The strategy layer now routes:
  - `preflop` -> `PreflopTeacherV2`
  - `heads-up postflop` -> `HeadsUpPostflopTeacherV2`
  - `multiway postflop` -> existing multiway heuristic policies
- Policy dataset tagging now uses explicit postflop spot labeling, so future heads-up postflop datasets do not rely on the older generic postflop tags.
- A dedicated CLI flow now exists:
  - `main.py validate-heads-up-postflop-v2`
  - it exports a heads-up-only postflop teacher dataset, a spot report, and a sanity report
- Initial heads-up postflop smoke validation artifacts now exist under:
  - `outputs/heads_up_postflop_v2_smoke/heads_up_postflop_teacher_v2_dataset.jsonl`
  - `outputs/heads_up_postflop_v2_smoke/heads_up_postflop_teacher_v2_dataset.csv`
  - `outputs/heads_up_postflop_v2_smoke/heads_up_postflop_spot_report.json`
  - `outputs/heads_up_postflop_v2_smoke/heads_up_postflop_sanity_report.json`
- Initial heads-up postflop smoke summary:
  - `729` heads-up postflop samples
  - street coverage:
    - `flop 320`
    - `turn 235`
    - `river 174`
  - key spot coverage:
    - `flop_cbet_opportunity 128`
    - `flop_facing_cbet 57`
    - `turn_barrel_opportunity 28`
    - `turn_facing_barrel 45`
    - `river_bluff_catch 41`
  - current smoke sanity report emits no warnings
- A longer fixed-seed heads-up postflop v2 validation run has now completed under:
  - `outputs/heads_up_postflop_v2_validation_2000/heads_up_postflop_teacher_v2_dataset.jsonl`
  - `outputs/heads_up_postflop_v2_validation_2000/heads_up_postflop_teacher_v2_dataset.csv`
  - `outputs/heads_up_postflop_v2_validation_2000/heads_up_postflop_spot_report.json`
  - `outputs/heads_up_postflop_v2_validation_2000/heads_up_postflop_sanity_report.json`
- Long-run heads-up postflop v2 coverage:
  - `4552` heads-up postflop samples
  - `flop 2113`
  - `turn 1459`
  - `river 980`
  - key spots:
    - `flop_cbet_opportunity 827`
    - `flop_facing_cbet 399`
    - `flop_probe_or_delayed_cbet 562`
    - `turn_barrel_opportunity 240`
    - `turn_facing_barrel 279`
    - `river_value_decision 115`
    - `river_bluff_catch 226`
    - `river_bluff_or_giveup 618`
- Long-run heads-up postflop sanity summary:
  - no built-in warnings were emitted
  - flop c-bet shares are now materially more active than the first smoke:
    - `single_raised_pot_ip 31.69%`
    - `single_raised_pot_oop 38.12%`
    - `three_bet_pot_ip 56.00%`
    - `three_bet_pot_oop 47.92%`
  - however the current threshold path has over-tightened:
    - `turn:medium_made_hand:medium` -> `100% fold`
    - `turn:medium_made_hand:small` -> `100% fold`
    - `river:medium_made_hand:medium` -> `100% fold`
    - `river bluff-catch` samples for `medium_made_hand` and `weak_showdown_value` are also `100% fold`
- A narrow local calibration pass for `HeadsUpPostflopTeacherV2` has now been completed without changing the improved flop c-bet structure.
- The current best local candidate is the final fixed-seed run under:
  - `outputs/heads_up_postflop_v2_calibration_local_2000f/heads_up_postflop_spot_report.json`
  - `outputs/heads_up_postflop_v2_calibration_local_2000f/heads_up_postflop_sanity_report.json`
- Final local calibration summary on `2000` hands with fixed seed `42`:
  - flop stayed unchanged:
    - `single_raised_pot_ip c-bet 31.69%`
    - `single_raised_pot_oop c-bet 38.12%`
  - overall turn/river action mix moved only modestly:
    - turn `call 9.94% / fold 15.08%`
    - river `call 13.80% / fold 11.78%`
  - targeted medium-strength collapse is materially improved:
    - `turn:medium_made_hand:medium` -> `51.11% call / 48.89% fold`
    - `river:medium_made_hand:medium` -> `33.33% call / 66.67% fold`
  - weak-showdown bluff-catch is still tight:
    - `river:weak_showdown_value:medium` -> `100% fold`
    - `river:weak_showdown_value:small` -> `100% fold`
  - remaining warning:
    - `turn:medium_made_hand:small` -> `100% call`
    - current interpretation is that this is a low-sample pressure bucket edge case, not a broad collapse
- Main Interface v1 now exists in `demo/` with a three-column product layout:
  - left = bot control / preset / custom profile
  - center = current poker state + decision + evaluator/policy summary
  - right = context-aware poker explanation chat
- The 8-bot replay interface now lives separately in `demo/training.html` for internal testing and validation.
- The chat layer is no longer attached to the training UI; it now lives in the main product interface.
- The chat layer now supports a real OpenAI provider path in addition to mock and generic OpenAI-compatible backends.
- The chat layer now explicitly supports a remote fine-tuned model backend as the main production path.
- The current default remote chat target is now the live S5000 inference service:
  - base URL: `http://10.10.142.113:8001/v1`
  - model: `Qwen3-4B-Instruct-2507`
  - API shape: OpenAI-compatible `POST /chat/completions`
- The direct `transformers` path on the remote machine produced sane output, while the current `vLLM` path remained unstable.
- A lightweight fallback service now exists for the remote Qwen deployment:
  - `tools/transformers_qwen_openai_server.py`
  - docs: `docs/remote_transformers_service.md`
- Current recommendation:
  - stop spending time on `vLLM` for this phase
  - run the lightweight `transformers` OpenAI-compatible service on S5000
  - keep PKclaw local chat integration unchanged
- `pkbot/chat_service.py` now accepts both the shorter production env vars and legacy aliases:
  - `PKCLAW_CHAT_PROVIDER`
  - `PKCLAW_BASE_URL` / `PKCLAW_CHAT_BASE_URL`
  - `PKCLAW_API_KEY` / `PKCLAW_CHAT_API_KEY`
  - `PKCLAW_MODEL` / `PKCLAW_CHAT_MODEL`
- The main UI chat sidebar already sends:
  - current `GameState`
  - current `StyleProfile`
  - evaluator outputs
  - policy outputs
  - chosen action
  - size bucket
  through `/api/chat`, which then routes the request through `chat_service`
- The right-side chat sidebar is now product-oriented rather than generic:
  - explain current hand
  - why not another action
  - compare tighter / more aggressive styles
  - replay-style hand review
- The chat layer now also supports messy pasted hand-history input for short first-pass analysis.
- Chat interactions are now logged for future SFT prep under:
  - `outputs/chat_logs/chat_events.jsonl`
- A first SFT export path now exists:
  - `main.py export-chat-sft-dataset`
  - default output: `outputs/chat_logs/chat_sft_dataset.jsonl`
- Rule-driven bot core exists for 8-max NLH and can run single-hand and batch simulations.
- Eight style presets are available and drive different decision tendencies.
- Batch simulation exports hand history and decision datasets under `outputs/`.
- `eval7` has been integrated to improve underlying hand evaluation quality.
- A formal evaluator v1 pipeline now exists:
  - `feature_builder.py` for flat tabular ML features
  - `rollout_labeler.py` for reproducible Monte Carlo labels with fixed assumptions and a first rule-based range policy
  - `dataset_export.py` for stratified dataset v1 export with raw state + feature + label retention
  - `train_evaluator.py` for formal LightGBM training + report output
  - `model_interface.py` for load/save/predict abstraction
- The evaluator layer is now a standard component via `evaluator_service.py`.
- A modular strategy-layer framework now exists:
  - `strategy/context_builder.py`
  - `strategy/layer.py`
  - `strategy/preflop_policy.py`
  - `strategy/flop_policy.py`
  - `strategy/turn_policy.py`
  - `strategy/river_policy.py`
- The decision engine now acts as an orchestrator over evaluator service + strategy layer instead of holding all street logic inline.
- The strategy layer consumes `GameState + StyleProfile + evaluator outputs` and returns action weights plus a size bucket.
- A first learned-policy closed loop now exists:
  - `policy_interface.py` for policy model abstractions and LightGBM load/save
  - `policy_adapter.py` for plugging learned policy outputs into `StrategyLayer`
  - `policy_dataset_export.py` for exporting imitation-learning targets from the current teacher strategy pipeline
  - `train_policy.py` for a first baseline LightGBM policy trainer
- Formal Policy Dataset v1 and Policy Baseline v1 now exist:
  - `outputs/policy_v1/policy_dataset_v1.jsonl`
  - `outputs/policy_v1/policy_dataset_v1.csv`
  - `outputs/policy_v1/policy_dataset_v1_metadata.json`
  - `outputs/policy_v1/policy_model_v1.joblib`
  - `outputs/policy_v1/policy_model_v1_report.json`
  - `outputs/policy_v1/policy_validation.json`
- Frozen Policy Baseline v1 artifacts now exist:
  - `outputs/policy_baseline_v1/policy_baseline_v1.joblib`
  - `outputs/policy_baseline_v1/policy_baseline_v1_report.json`
  - `outputs/policy_baseline_v1/policy_baseline_v1_validation.json`
- Targeted Policy Dataset v1.1 and Policy Baseline v1.1 now exist:
  - `outputs/policy_v1_1/policy_dataset_v1_1.jsonl`
  - `outputs/policy_v1_1/policy_dataset_v1_1.csv`
  - `outputs/policy_v1_1/policy_dataset_v1_1_metadata.json`
  - `outputs/policy_v1_1/policy_model_v1_1.joblib`
  - `outputs/policy_v1_1/policy_model_v1_1_report.json`
  - `outputs/policy_v1_1/policy_validation_v1_1.json`
- A/B comparison now exists for heuristic-only vs evaluator-assisted engine behavior.
- Formal Evaluator v1 baseline training has now been run on the current `outputs/evaluator_v1/dataset_v1.jsonl`.
- Current baseline artifacts:
  - `outputs/evaluator_v1/evaluator_model.joblib`
  - `outputs/evaluator_v1/evaluator_model_report.json`
  - `outputs/evaluator_v1/ab_test_summary.json`
- The frozen evaluator baseline artifact is:
  - `outputs/evaluator_v1/evaluator_v1_baseline.joblib`
  - `outputs/evaluator_v1/evaluator_v1_baseline_report.json`
- Decision-engine calibration sweep artifacts now exist:
  - `outputs/evaluator_v1/calibration/calibration_sweep.json`
  - `outputs/evaluator_v1/calibration/calibration_sweep.csv`
- Second-pass local calibration artifacts now exist:
  - `outputs/evaluator_v1/calibration_local/calibration_sweep.json`
  - `outputs/evaluator_v1/calibration_local/calibration_sweep.csv`
- Long fixed-seed validation artifacts now exist:
  - `outputs/evaluator_v1/validation/candidate_validation.json`
  - `outputs/evaluator_v1/validation/candidate_validation.csv`

## Decisions Made And Why
- Use a rule/heuristic core first instead of LLMs, OCR, solver-first, or full RL.
  - Reason: fastest path to a stable, explainable MVP.
- Use open-source components selectively rather than importing a full poker stack.
  - Reason: preserve product-level control while reusing mature infrastructure.
- Integrate `eval7` first.
  - Reason: hand evaluation is foundational and safer to outsource to a mature library.
- Keep style profiles as a first-class product feature.
  - Reason: user-facing bot personality is a core differentiator.
- Keep the evaluator pipeline modular and separate from the rule engine.
  - Reason: future model swaps should not require rewriting decision logic.
- Build a model-agnostic strategy layer before any learned policy.
  - Reason: a later XGBoost/MLP/Transformer policy should plug into stable interfaces, not replace the engine ad hoc.
- Build the first learned policy as a minimal imitation loop from the current strategy pipeline.
  - Reason: establish a clean closed loop before exploring larger policy architectures.
- Use the model as a decision aid, not a full engine replacement.
  - Reason: maintain stability while improving edge cases and medium-strength handling.
- Finalize v1 labels as `equity_estimate` and `showdown_strength_proxy`.
  - Reason: they map cleanly to continue/fold and value/bluff decisions without overfitting the label space.
- Build dataset v1 with stratified sampling and forced coverage instead of naive natural-frequency sampling.
  - Reason: evaluator quality depends more on coverage of high-value spots than on raw frequency realism.

## Unresolved Problems
- The old preflop labeling collapse is now materially fixed in the long `validate-preflop-v2` run, and the report no longer emits collapse warnings.
- PreflopTeacherV2 now looks strong enough to serve as the formal v2 preflop teacher source, but future calibration should still watch one hot spot:
  - `opener_or_caller_facing_3bet` remains aggressive at `56.48% raise`
- `sb_first_in` now appears in the long validation run and no longer blocks adoption, but it still has much smaller sample count than `UTG/UTG+1/MP/HJ/CO` first-in spots.
- `HeadsUpPostflopTeacherV2` is now built, integrated, and locally calibrated, but it is not fully ready for final promotion yet.
- The original broad medium-strength collapse is materially improved.
- The remaining heads-up postflop failure mode is now much narrower:
  - weak-showdown river bluff-catch still folds too often
  - small-pressure turn medium-strength coverage is still thin and noisy
- Some profiles are still too loose in self-play.
- Multiway logic is still crude.
- Side-pot handling is not yet complete.
- Engine/bot interface can be cleaned up further.
- Statistics are useful but still incomplete for serious calibration.
- `showdown_strength_proxy` is materially harder to fit than equity on small/medium datasets.
- Current A/B flow compares behavior, but not yet long-run profitability or exploitability.
- Current dataset stratification forces broad coverage, but does not yet enforce every quota the product design wants at exact target percentages.
- The current trained evaluator materially loosens the bot:
  - A/B on 200 hands increased showdown rate from `0.36` to `0.63`
  - Average pot increased from `128.712` to `197.241`
  - Calls increased from `1522` to `1910`
  - River reach increased from `0.305` to `0.565`
  This is useful signal, but it likely means the evaluator needs calibration before it should be treated as production-safe.
- Calibration sweep over evaluator influence / continue thresholds / river call threshold / call penalty / fold bonus has been run on 120 hands at fixed seed `42`.
- Best anti-sticky candidate from the first sweep is currently `strong_fold_bias`:
  - `average_pot 188.368`
  - `showdown_rate 0.575`
  - `river_reach_rate 0.500`
  - `call_frequency 0.4344`
  - `fold_frequency 0.2914`
  - `aggression_ratio 0.4725`
  It still runs looser than heuristic-only, but is materially tighter than the untuned evaluator path.
- A second-pass local sweep around `strong_fold_bias` has now been run on `200` hands at fixed seed `42`.
- The tightest current local candidate is `river_clamp_candidate`:
  - `average_pot 178.442`
  - `showdown_rate 0.500`
  - `river_reach_rate 0.470`
  - `call_frequency 0.4277`
  - `fold_frequency 0.2989`
  - `aggression_ratio 0.4724`
  This is tighter than `strong_fold_bias_center`, but still clearly looser than heuristic-only.
- The current middle-ground local candidate is `balanced_middle_candidate`:
  - `average_pot 179.440`
  - `showdown_rate 0.510`
  - `river_reach_rate 0.480`
  - `call_frequency 0.4282`
  - `fold_frequency 0.2982`
  - `aggression_ratio 0.4719`
  It preserves most evaluator lift while reducing stickiness relative to both `current_like` and `strong_fold_bias_center`.
- Long fixed-seed validation has now been run on `2000` hands at fixed seed `42` for:
  - `heuristic_only`
  - `river_clamp_candidate`
  - `balanced_middle_candidate`
- Long-run validation result:
  - `heuristic_only`
    - `average_pot 141.968`
    - `showdown_rate 0.372`
    - `river_reach_rate 0.292`
    - `call_frequency 0.3976`
    - `fold_frequency 0.3234`
    - `aggression_ratio 0.5125`
  - `river_clamp_candidate`
    - `average_pot 186.671`
    - `showdown_rate 0.537`
    - `river_reach_rate 0.478`
    - `call_frequency 0.4273`
    - `fold_frequency 0.2873`
    - `aggression_ratio 0.4856`
  - `balanced_middle_candidate`
    - `average_pot 187.356`
    - `showdown_rate 0.540`
    - `river_reach_rate 0.479`
    - `call_frequency 0.4280`
    - `fold_frequency 0.2867`
    - `aggression_ratio 0.4843`
- Current interpretation:
  - both evaluator-assisted candidates are stable across a longer run
  - both remain materially looser than heuristic-only
  - `river_clamp_candidate` is the slightly tighter and safer of the two
  - `balanced_middle_candidate` preserves marginally more evaluator-driven continuation, but the practical difference is small
- Strategy-layer framework smoke tests have passed:
  - `main.py scenarios`
  - `main.py scenarios --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib`
  - `main.py simulate --hands 1 --seed 42 --export-dir outputs\strategy_smoke`
- Learned-policy smoke loop has passed:
  - `main.py export-policy-dataset --hands 25 --seed 42 --export-dir outputs\policy_smoke --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib`
  - `main.py train-policy --dataset outputs\policy_smoke\policy_dataset.jsonl --model-out outputs\policy_smoke\policy_model.joblib --seed 42`
  - `main.py scenarios --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib --policy-path outputs\policy_smoke\policy_model.joblib`
- Current policy smoke metrics on `outputs\policy_smoke\policy_dataset.jsonl`:
  - `action accuracy 0.93458`
  - `action log_loss 0.27465`
  - `size_bucket accuracy 0.92523`
  - `size_bucket log_loss 0.32144`
- Policy adapter now enforces street-valid size buckets so the learned policy cannot emit structurally invalid bucket labels across streets.
- Formal Policy Dataset v1 summary:
  - `4600` samples
  - street coverage:
    - `preflop 1200`
    - `flop 1600`
    - `turn 1000`
    - `river 800`
  - preserves:
    - raw state
    - style profile
    - evaluator outputs
    - teacher action target
    - teacher size bucket target
    - legal action mask
    - legal size bucket mask
- Formal Policy Baseline v1 metrics on `policy_dataset_v1.jsonl`:
  - `action accuracy 0.97609`
  - `action log_loss 0.08513`
  - `size_bucket accuracy 1.00000`
  - `size_bucket log_loss 0.00004`
  - `size_bucket non_none_accuracy 1.00000`
  - `size_bucket non_none_log_loss 0.00018`
- Teacher vs learned validation on `300` hands with fixed seed `42`:
  - teacher:
    - `average_pot 182.659`
    - `showdown_rate 0.527`
    - `river_reach_rate 0.493`
    - `call_frequency 0.4294`
    - `fold_frequency 0.2930`
    - `aggression_ratio 0.4650`
  - learned:
    - `average_pot 172.754`
    - `showdown_rate 0.497`
    - `river_reach_rate 0.483`
    - `call_frequency 0.4188`
    - `fold_frequency 0.2991`
    - `aggression_ratio 0.4863`
  - structure:
    - `teacher_action_agreement 0.9827`
    - `teacher_size_bucket_agreement 0.8981`
    - `raw_top1_illegal_action_rate 0.0000`
    - `raw_top1_illegal_size_bucket_rate 0.0075`
  - interpretation:
    - learned policy tracks teacher fairly closely
    - it does not produce illegal top-1 actions
    - raw illegal size-bucket top-1 rate is low but non-zero, and adapter masking/fallback remains important
    - current drift is toward a slightly tighter line than the teacher, especially fewer calls and lower river reach
- Main drift-heavy preflop spots from Policy Baseline v1 validation:
  - `preflop unopened pot`: teacher opened, learned checked
  - `late-position steal spot`: teacher opened, learned checked
- Formal Policy Dataset v1.1 was built specifically to reduce that preflop tightening drift:
  - `4800` samples
  - street coverage:
    - `preflop 1400`
    - `flop 1600`
    - `turn 1000`
    - `river 800`
  - targeted extra preflop coverage:
    - `unopened_preflop_open 279`
    - `CO 694`
    - `BTN 681`
    - `SB 978`
    - `BB 640`
  - target distribution improvements:
    - `raise` targets increased from `213` in v1 to `344` in v1.1
    - `preflop_open` size-bucket targets increased from `19` in v1 to `153` in v1.1
- Formal Policy Baseline v1.1 metrics on `policy_dataset_v1_1.jsonl`:
  - `action accuracy 0.97813`
  - `action log_loss 0.06167`
  - `size_bucket accuracy 0.99896`
  - `size_bucket log_loss 0.01101`
  - `size_bucket non_none_accuracy 0.99487`
  - `size_bucket non_none_log_loss 0.05413`
- Teacher vs learned validation on `300` hands with fixed seed `42` for Policy Baseline v1.1:
  - teacher:
    - `average_pot 182.659`
    - `showdown_rate 0.527`
    - `river_reach_rate 0.493`
    - `call_frequency 0.4294`
    - `fold_frequency 0.2930`
    - `aggression_ratio 0.4650`
  - learned:
    - `average_pot 180.563`
    - `showdown_rate 0.517`
    - `river_reach_rate 0.487`
    - `call_frequency 0.4281`
    - `fold_frequency 0.2940`
    - `aggression_ratio 0.4669`
  - structure:
    - `teacher_action_agreement 0.9905`
    - `teacher_size_bucket_agreement 0.9087`
    - `raw_top1_illegal_action_rate 0.0000`
    - `raw_top1_illegal_size_bucket_rate 0.0068`
  - interpretation:
    - overall learned-policy drift is materially reduced versus Policy Baseline v1
    - structural sanity is preserved
    - the two fixed scenario examples still show an open-vs-check mismatch, so the preflop drift is improved globally but not fully eliminated on edge examples

## Key Files
- `docs/strength_improvement_v2_report.md`
- `main.py`
- `pkbot/game_state.py`
- `pkbot/style_profile.py`
- `pkbot/presets.py`
- `pkbot/hand_evaluator.py`
- `pkbot/feature_builder.py`
- `pkbot/rollout_labeler.py`
- `pkbot/dataset_export.py`
- `pkbot/model_interface.py`
- `pkbot/evaluator_service.py`
- `pkbot/policy_interface.py`
- `pkbot/policy_adapter.py`
- `pkbot/policy_dataset_export.py`
- `pkbot/policy_validation.py`
- `pkbot/preflop_labeling.py`
- `pkbot/preflop_teacher_v2.py`
- `pkbot/preflop_validation.py`
- `pkbot/postflop_labeling.py`
- `pkbot/heads_up_postflop_teacher_v2.py`
- `pkbot/heads_up_postflop_validation.py`
- `pkbot/product_entry.py`
- `pkbot/strategy/context_builder.py`
- `pkbot/strategy/layer.py`
- `pkbot/strategy/preflop_policy.py`
- `pkbot/strategy/flop_policy.py`
- `pkbot/strategy/turn_policy.py`
- `pkbot/strategy/river_policy.py`
- `pkbot/train_evaluator.py`
- `pkbot/train_policy.py`
- `pkbot/chat_service.py`
- `pkbot/ab_test.py`
- `pkbot/decision_engine.py`
- `pkbot/engine.py`
- `pkbot/exporter.py`
- `pkbot/test_scenarios.py`
- `demo/index.html`
- `demo/training.html`
- `demo/app.js`
- `demo/training.js`
- `demo/styles.css`
- `demo/training.css`
- `outputs/profile_summary.csv`
- `outputs/profile_summary.json`

## Run And Test Commands
```powershell
.\.venv\Scripts\python.exe main.py scenarios
.\.venv\Scripts\python.exe main.py simulate --hands 10 --seed 42 --export-dir outputs
.\.venv\Scripts\python.exe main.py build-dataset-v1 --max-hands 300 --batch-size 25 --seed 42 --export-dir outputs\evaluator_v1 --preflop-target 15000 --flop-target 30000 --turn-target 20000 --river-target 15000 --rollouts 120
.\.venv\Scripts\python.exe main.py train-evaluator --dataset outputs\evaluator_v1\dataset_v1.jsonl --model-out outputs\evaluator_v1\evaluator_model.joblib --seed 42
.\\.venv\\Scripts\\python.exe main.py export-policy-dataset --hands 50 --seed 42 --export-dir outputs\\policy_baseline --model-path outputs\\evaluator_v1\\evaluator_v1_baseline.joblib
.\\.venv\\Scripts\\python.exe main.py build-policy-dataset-v1 --max-hands 700 --batch-size 50 --seed 42 --export-dir outputs\\policy_v1 --model-path outputs\\evaluator_v1\\evaluator_v1_baseline.joblib --preflop-target 1200 --flop-target 1600 --turn-target 1000 --river-target 800
.\\.venv\\Scripts\\python.exe main.py train-policy --dataset outputs\\policy_baseline\\policy_dataset.jsonl --model-out outputs\\policy_baseline\\policy_model.joblib --seed 42
.\\.venv\\Scripts\\python.exe main.py train-policy --dataset outputs\\policy_v1\\policy_dataset_v1.jsonl --model-out outputs\\policy_v1\\policy_model_v1.joblib --seed 42
.\\.venv\\Scripts\\python.exe main.py build-policy-dataset-v1_1 --max-hands 900 --batch-size 50 --seed 42 --export-dir outputs\\policy_v1_1 --model-path outputs\\evaluator_v1\\evaluator_v1_baseline.joblib --preflop-target 1400 --flop-target 1600 --turn-target 1000 --river-target 800
.\\.venv\\Scripts\\python.exe main.py train-policy --dataset outputs\\policy_v1_1\\policy_dataset_v1_1.jsonl --model-out outputs\\policy_v1_1\\policy_model_v1_1.joblib --seed 42
.\.venv\Scripts\python.exe main.py scenarios --model-path outputs\evaluator_v1\evaluator_model.joblib
.\\.venv\\Scripts\\python.exe main.py scenarios --model-path outputs\\evaluator_v1\\evaluator_v1_baseline.joblib --policy-path outputs\\policy_baseline\\policy_model.joblib
.\\.venv\\Scripts\\python.exe main.py validate-policy-baseline --hands 300 --seed 42 --model-path outputs\\evaluator_v1\\evaluator_v1_baseline.joblib --policy-path outputs\\policy_v1\\policy_model_v1.joblib --output outputs\\policy_v1\\policy_validation.json
.\\.venv\\Scripts\\python.exe main.py validate-policy-baseline --hands 300 --seed 42 --model-path outputs\\evaluator_v1\\evaluator_v1_baseline.joblib --policy-path outputs\\policy_v1_1\\policy_model_v1_1.joblib --output outputs\\policy_v1_1\\policy_validation_v1_1.json
.\\.venv\\Scripts\\python.exe main.py validate-preflop-v2 --hands 250 --seed 42 --export-dir outputs\\preflop_v2_smoke3 --model-path outputs\\evaluator_v1\\evaluator_v1_baseline.joblib
.\\.venv\\Scripts\\python.exe main.py validate-preflop-v2 --hands 2000 --seed 42 --export-dir outputs\\preflop_v2_validation_2000 --model-path outputs\\evaluator_v1\\evaluator_v1_baseline.joblib
.\\.venv\\Scripts\\python.exe main.py validate-heads-up-postflop-v2 --hands 300 --seed 42 --export-dir outputs\\heads_up_postflop_v2_smoke --model-path outputs\\evaluator_v1\\evaluator_v1_baseline.joblib
.\\.venv\\Scripts\\python.exe main.py validate-heads-up-postflop-v2 --hands 2000 --seed 42 --export-dir outputs\\heads_up_postflop_v2_validation_2000 --model-path outputs\\evaluator_v1\\evaluator_v1_baseline.joblib
.\\.venv\\Scripts\\python.exe main.py validate-heads-up-postflop-v2 --hands 2000 --seed 42 --export-dir outputs\\heads_up_postflop_v2_calibration_local_2000f --model-path outputs\\evaluator_v1\\evaluator_v1_baseline.joblib
.\.venv\Scripts\python.exe main.py ab-test-evaluator --hands 50 --seed 42 --model-path outputs\evaluator_v1\evaluator_model.joblib --output outputs\evaluator_v1\ab_test_summary.json
.\.venv\Scripts\python.exe main.py calibration-sweep --hands 120 --seed 42 --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib --output-dir outputs\evaluator_v1\calibration
.\.venv\Scripts\python.exe main.py calibration-sweep-local --hands 200 --seed 42 --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib --output-dir outputs\evaluator_v1\calibration_local
.\.venv\Scripts\python.exe main.py validate-candidates --hands 2000 --seed 42 --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib --output-dir outputs\evaluator_v1\validation
.\.venv\Scripts\python.exe main.py evaluator-demo --hands 25 --seed 42 --export-dir outputs\evaluator_v1 --rollouts 80
.\.venv\Scripts\python.exe main.py ui
```

### Chat layer env setup

```powershell
$env:PKCLAW_CHAT_PROVIDER="remote"
$env:PKCLAW_BASE_URL="https://your-remote-qwen-service.example/v1"
$env:PKCLAW_API_KEY="your-api-key"
$env:PKCLAW_MODEL="your-finetuned-model-id"
.\.venv\Scripts\python.exe main.py ui
```

Legacy alias form also works:

```powershell
$env:PKCLAW_CHAT_BASE_URL="https://your-provider.example/v1"
$env:PKCLAW_CHAT_API_KEY="your-api-key"
$env:PKCLAW_CHAT_MODEL="your-model-id"
.\.venv\Scripts\python.exe main.py ui
```

### Optional local smoke mode for the chat UI

```powershell
$env:PKCLAW_CHAT_PROVIDER="mock"
.\.venv\Scripts\python.exe main.py ui
```

### OpenAI official provider example

```powershell
$env:PKCLAW_CHAT_PROVIDER="openai"
$env:OPENAI_API_KEY="your-openai-api-key"
$env:OPENAI_MODEL="gpt-5-mini"
.\.venv\Scripts\python.exe main.py ui
```

### UI entry points

- Main interface: `http://127.0.0.1:8000/demo/`
- Training replay: `http://127.0.0.1:8000/demo/training.html`

## Latest Baseline Metrics
- Evaluator v1 baseline on current `dataset_v1.jsonl`
  - `equity_estimate`: `MAE 0.06513`, `RMSE 0.08756`, `R2 0.92354`
  - `showdown_strength_proxy`: `MAE 0.06510`, `RMSE 0.08401`, `R2 0.86660`
- Top feature importance from the current model:
  - `hole_high_rank`
  - `pot_size_bb`
  - `hole_gap`
  - `hole_low_rank`
  - `max_raise_bb`
  - `active_player_count`

## Next Recommended Steps
- Use `docs/strength_improvement_v2_report.md` as the handoff document for the next strength-focused training phase.
- Keep `outputs/policy_baseline_v1/`, `outputs/policy_v1_1/`, and `outputs/evaluator_v1/evaluator_v1_baseline.joblib` frozen as baseline artifacts.
- Treat the next bottleneck as teacher quality and task decomposition, not model size.
- Continue iterating on `PreflopTeacherV2` as the separate teacher path before retraining another generic policy.
- Treat `PreflopTeacherV2` as the formal v2 preflop teacher source for the next training phase.
- If preflop tuning continues, target `opener_or_caller_facing_3bet` first rather than reopening broad preflop labeling work.
- Move the main v2 teacher path forward to `HeadsUpPostflopTeacherV2`.
- Keep the current local heads-up postflop calibration candidate as the active working branch.
- Do not reopen flop tuning.
- If heads-up postflop tuning continues, keep it narrowly focused on:
  - weak-showdown river bluff-catch under small and medium pressure
  - confirming that `turn:medium_made_hand:medium` remains near the current balanced middle on another fixed-seed run
- Split the next learned-policy path into:
  - preflop
  - heads-up postflop
  - multiway postflop
- Keep the new explicit preflop spot labeling and use it as the only source for future preflop policy exports.
- Add a DAgger-style corrective loop that runs the current learned policy, captures divergence-heavy hard spots, and relabels them with stronger teacher logic.
- Keep the internal simulator as the main short-term 8-handed data engine, and evaluate `PokerKit` first if a stronger external rules engine becomes necessary.
- Improve feature quality around action history, board interaction, and position-aware range pressure.
- Collect a larger evaluator dataset so `showdown_strength_proxy` stabilizes across turn/river spots.
- Tighten the sampling planner toward explicit spot quotas for c-bet, barrel, bluff-catch, blind defense, and 3-bet trees.
- Add more calibration metrics beyond VPIP/PFR so preset behavior can be measured properly.
- Tighten preflop defend and multiway continuation logic using stats rather than intuition.
- If a default evaluator-assisted preset is needed now, prefer `river_clamp_candidate` over `balanced_middle_candidate`.
- Next tuning work should focus on reducing turn/river reach without crushing evaluator gains, rather than rerunning broad sweeps.
- Next architecture work should build policy-model adapters against the new strategy-layer interfaces rather than putting learned logic directly into `decision_engine.py`.
- Next policy work should keep tightening preflop teacher imitation in open/steal spots, because the global drift is much smaller in v1.1 but the fixed unopened/late-steal examples still miss.
- Next policy work should improve dataset scale and target quality before trying a more expressive model family.
- Next product-layer work can swap chat providers or models without changing the UI contract, because the hand discussion panel now only depends on the local `/api/chat` interface.
- Next chat work should improve explanation quality and conversation UX, not move the chat back into the training interface.
- Evaluate whether PokerKit should replace or support parts of the current engine/state progression layer.
- Start defining a second-stage policy model only after evaluator quality is materially better.
