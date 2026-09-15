### Eval

**You own the experiment design. Plan, blind, run, synthesize.**

**Non-negotiables for blinding:**

- No `eval`, `test`, `judge`, `experiment`, `rubric`, `score`, `compare`, `benchmark`, `candidate`, or `arena` in any directory, file, or prompt the candidate sees.
- The candidate prompt looks like an organic user request. State the goal, not the meta.
- No chain-eliciting cues. Don't ask the candidate to list which skills, principles, or files they applied. Ask for design notes generally and grade chain-following from code shape, not self-report.
- Sanitize directory and slug names. Use project-shaped names a user might pick.
- Don't tell the candidate other candidates exist.
- The judge can know it's judging but sees outputs by sanitized label only, never by model name.
- Comparing two variants: one judge scores both sets in a single pass on one scale, blind to which set each came from.

**Steps:**

1. **Frame.** State what variant is under test and what behavior counts as success. Write the rubric (3-6 concrete criteria) for the judge only. Hold it back from candidates.
2. **Set up sanitized environments.** Per-candidate working dir with the variant in place. Plant any context an organic task would have: a project skeleton, the skills the candidate would naturally read.
3. **Author one organic prompt.** What a user would type. No leakage of what's being measured.
4. **Spawn N candidates** per the **arena** skill's Phase B, using supported models and bounded concurrency. Each works in its own sanitized directory with the same prompt. Record actual model choices and disclose when all candidates use one model.
5. **Spawn one blinded judge** per the **arena** skill's Phase C. Prefer a different available model family and record when unavailable. Judge sees outputs by sanitized label and the rubric, never a model name.
6. **Verify chain-following from execution evidence.** Use candidate tool-call logs or transcripts exposed by the host for these exact candidate sessions. Scope access to this project and the explicitly selected run; never search unrelated conversation history. Check which files the candidates actually opened. If reliable tool-call evidence is unavailable, mark chain-following as unmeasured and assess the artifact separately. A candidate's claim that it read a skill is not proof.
7. **Read every candidate output yourself** end to end. Compare to the judge's verdict. Disagreement means a model is biased or the rubric is ambiguous. Synthesize.

**Reply:** variant under test, rubric, per-candidate notes, judge's verdict, your synthesis, and a recommendation for whether to promote the variant.
