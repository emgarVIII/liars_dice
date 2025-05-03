# Current Policy Generation Steps

Below are the exact steps ran to produce and load the one-turn MCCFR⁺ policy currently used in the UI:

1. **Generate the one-turn game JSON**

   ```bash
   cd cfr_files
   python generate_liarsdice.py
   ```

   - Outputs: `games/liarsdice_5die_1bid.json`
   - This file describes the extensive-form one-turn Liar’s Dice game (5 dice per player, single claim then accept/call).

2. **Train MCCFR⁺ policy**

   ```bash
   cd cfr_files
   python mccfr_train.py \
     --iters 500000 \
     --out-policy ../policies/liarsdice_5die_mccfr_policy.json
   ```

   - Uses: `games/liarsdice_5die_1bid.json` as the game definition.
   - Runs 500,000 iterations of MCCFR⁺ self-play with sampling.
   - Outputs: `policies/liarsdice_5die_mccfr_policy.json`
     - A JSON mapping each sorted 5-dice hand key to a distribution over `claim_Q_F` actions.

3. **Load policy in Flask UI**

   - In `cfr_web/app.py`, at startup:
     ```python
     with open(
         os.path.join(__file__, "../policies/liarsdice_5die_mccfr_policy.json")
     ) as f:
         policy_pl1 = json.load(f)
     ```
   - Every `/action` POST for `player='pl1'` samples from this policy.

Now your front-end is wired to use the MCCFR⁺-derived strategy for Player 1 in the one-turn Liar’s Dice variant.

