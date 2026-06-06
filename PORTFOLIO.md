# Portfolio Notes

Project: Liar's Dice CFR Lab  
Author: Mauricio Garcia Villanueva  
Live demo: https://emgarviii.github.io/liars_dice/  
GitHub: https://github.com/emgarVIII/liars_dice  
LinkedIn: https://www.linkedin.com/in/emgar/

## Resume Bullets

Use one to three, depending on space.

- Built an end-to-end imperfect-information game-solving lab for a simplified Liar's Dice variant, combining Python sampled CFR+ self-play, deterministic evaluation, TypeScript visualization, and GitHub Pages deployment.
- Implemented a sampled CFR+ policy pipeline that conditions on remaining dice counts and private dice, exports normalized JSON artifacts for a static browser demo, and improves benchmark average win rate from 45.3% to 73.0% across seeded opponent profiles.
- Added best-response-style diagnostics to stress test policy robustness, surfacing exploitability tradeoffs rather than overstating equilibrium claims.
- Designed a playable educational interface that contrasts a validated one-claim CFR abstraction with a separate classic raise/challenge Liar's Dice comparison mode.
- Curated original university research papers into a public archive while aligning the live demo, README, tests, and metrics around verified claims.

## LinkedIn Draft

I turned one of my university research projects into a public portfolio artifact:

Liar's Dice CFR Lab, an imperfect-information game-solving demo built around self-play, sampled CFR+ regret minimization, benchmark evaluation, and a playable TypeScript site.

What I focused on:

- modeling hidden information through private dice and public claims,
- training sampled CFR+ policies offline in Python,
- exporting static policy and metrics JSON for GitHub Pages,
- adding benchmark and best-response-style evaluation,
- making the demo educational without overstating the results.

The strongest lesson was not just "make the AI win more." The updated policy improved benchmark average win rate from 45.3% to 73.0%, but the best-response diagnostic still shows exploitable pressure. That tradeoff is exactly why evaluation matters.

Live demo: https://emgarviii.github.io/liars_dice/  
Code: https://github.com/emgarVIII/liars_dice

## Interview Talking Points

- The project is about imperfect-information decisioning: each player sees private dice and must act under uncertainty.
- I intentionally separated Python research code from the static website. Python trains and evaluates, the browser only loads frozen artifacts.
- The current policy is not claimed to be Nash equilibrium. I added exact one-round best-response diagnostics to avoid overselling.
- The remaining-dice-aware policy improves benchmark play because it no longer reuses a fixed five-dice policy as dice counts change.
- The classic mode is included for education and comparison. It is heuristic, not CFR-solved.
- The project maps well to AI/ML and quant-style thinking because it combines hidden state, adversarial incentives, probabilistic policies, and stress testing.

## Honest Limitations

- The main solver targets a simplified one-claim challenge abstraction, not full classic Liar's Dice.
- Benchmark win rates are not equilibrium proof.
- Best-response pressure remains high on the claimant side.
- The policy artifact is static and trained offline, not updated live in the browser.
- A deeper future version should train directly against exploitability and support the classic raise/challenge game tree.
