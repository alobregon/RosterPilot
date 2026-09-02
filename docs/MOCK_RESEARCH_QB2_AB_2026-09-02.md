# Draft Companion QB2 Suppression A/B — 2026-09-02

## Goal

Evaluate the first roster-construction change identified by the 100-mock behavior study: the engine carried at least two quarterbacks in 61% of drafts despite a 10-team, one-QB format.

The A/B replay used the exact same Sept. 2 FantasyPros ranking snapshot, the same 100 stochastic seeds, the same scenario mix, and the same historical-manager assignment algorithm as the original study. The provider fixture was restored only long enough to execute this replay and is removed again afterward.

## Change under test

The on-clock decision layer now applies a bounded QB2 roster-cost penalty in one-QB formats.

The rule is intentionally not a hard ban:

- no penalty applies to QB1;
- QB2 is strongly suppressed while RB/WR/TE/FLEX starters are incomplete;
- at ordinary value, QB2 receives a 10-point raw-score penalty;
- the penalty declines when the quarterback has fallen materially beyond ECR or market ADP;
- a 20+ pick value fall retains only a 2-point residual penalty, allowing genuinely exceptional QB2 value to win.

If a QB2 still appears in the recommendation set despite the penalty, the recommendation reasons surface the roster-cost warning rather than applying it silently.

## Same-seed result

| Metric | Baseline | After QB2 rule | Delta |
| --- | ---: | ---: | ---: |
| 100 mocks completed | 100 | 100 | 0 |
| Legal rosters | 100 | 100 | 0 |
| Unique rosters | 100 | 100 | 0 |
| Average QB count | 1.65 | **1.38** | -0.27 |
| Drafts with QB2+ | 61 | **38** | -23 |
| Average RB count | 4.89 | 4.92 | +0.03 |
| Average WR count | 6.44 | **6.68** | +0.24 |
| Average TE count | 1.02 | 1.02 | 0 |
| Drafts with TE2+ | 2 | 2 | 0 |
| Drafts with 6+ RB | 12 | 13 | +1 |
| Drafts with 7+ WR | 45 | **67** | +22 |
| Context changed winner | 296 | 299 | +3 |
| Context-induced tier drops | 0 | 0 | 0 |
| Max positive skill-player ECR reach | 10 | 10 | 0 |
| 90th percentile positive skill reach | 6 | 6 | 0 |

The rule materially reduced backup-quarterback frequency without harming draft completion, legality, rank discipline, or the context tier guardrail.

## Scenario breakdown

QB2 frequency after the change:

| Scenario | QB2+ drafts |
| --- | ---: |
| Normal + historical managers | 12 / 40 (30%) |
| RB rush | 9 / 20 (45%) |
| WR rush | 7 / 20 (35%) |
| QB rush | 3 / 10 (30%) |
| TE rush | 7 / 10 (70%) |

The remaining QB2 behavior is therefore not simply a QB-rush artifact. TE-rush rooms in particular still create enough downstream value movement for the engine to carry a second quarterback frequently.

## Neutral control

Before the rule, the neutral control ended with Tyler Shough as QB2 in Round 14.

After the rule, the same control became:

```text
1.07  Amon-Ra St. Brown   WR  rank 8
2.04  Kenneth Walker III RB  rank 15
3.07  Kyren Williams      RB  rank 28
4.04  Colston Loveland    TE  rank 40
5.07  Drake Maye          QB  rank 49
6.04  DJ Moore            WR  rank 57
7.07  Marvin Harrison Jr. WR  rank 68
8.04  Brian Thomas Jr.    WR  rank 75
9.07  Stefon Diggs        WR  rank 85
10.04 Jayden Reed         WR  rank 88
11.07 Kenny Gainwell      RB  rank 107
12.04 Aaron Jones Sr.     RB  rank 119
13.07 Jalen Coker         WR  rank 128
14.04 Jonah Coleman       RB  rank 135
15.07 Ka'imi Fairbairn    K   rank 209
16.04 Baltimore Ravens    DST rank 232
```

That is a more defensible one-QB roster shape than the prior Tyler Shough QB2 outcome.

## Collateral effect: WR depth

The largest side effect is that the freed QB2 roster spot moved primarily to wide receiver:

- average WR count increased from 6.44 to 6.68;
- drafts with at least seven WRs increased from 45% to 67%.

This does **not** prove the QB2 rule is too strong. In a 3-WR + FLEX format, WR bench depth can be rational. But it means further increasing QB2 suppression in isolation would likely continue pushing the engine toward WR7/RB depth rather than solving roster construction holistically.

For that reason, do not increase the QB2 penalty again solely to chase a lower QB2 percentage. The next manual golden mock should judge the marginal value of QB2 versus RB5/RB6 and WR6/WR7 at the actual decision points.

## Other signals remained stable

The most important safety rails were effectively unchanged:

- all 100 drafts remained legal;
- context winner flips moved only from 296 to 299;
- context still caused zero tier drops;
- maximum positive skill-player ECR reach remained 10;
- the 90th-percentile positive reach remained 6;
- MarShawn Lloyd remained on 97% of rosters, confirming that concentration is independent of the QB2 change and still primarily reflects current ranking/ADP/opportunity inputs.

## Conclusion

Keep the first QB2 suppression rule for the manual evaluation. It fixes the clearest neutral-control failure and reduces QB2 frequency by 23 percentage points without weakening ranking or context guardrails.

Do **not** tune it more aggressively yet. The next useful step is the manual golden mock from slot #7 using the same updated rankings, with special attention to:

1. the first QB decision;
2. any later QB2 recommendation;
3. WR6/WR7 versus RB depth tradeoffs;
4. representative context-backed recommendations;
5. whether the recommendation explanations make the tradeoff obvious enough for draft-night use.
