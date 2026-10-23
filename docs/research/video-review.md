# Supplied video and REA workflow review

Research date: 2026-10-16. These are research notes, not a finished product or a claim that REA was run against PictoBlox.

## Access and method

- All three supplied YouTube URLs were opened through the browser. Their transcripts were read; video pixels were not reviewed frame by frame and the demonstrations were not independently reproduced.
- `rw0fqnrZgNM`: initial transcript-export API reported no transcript, but opening YouTube's Show transcript panel exposed a complete English transcript through 12:11. Reviewed directly in the browser. A later export succeeded and is saved as `rw0fqnrZgNM-transcript.txt`.
- `dAzs_rU6080`: English auto-generated transcript exported through the browser's supported transcript operation and saved as `dAzs_rU6080-transcript.txt`.
- `fCSNcSHLyWc`: English-US transcript, labeled authored or unspecified by exporter, saved as `fCSNcSHLyWc-transcript.txt`; reviewed through final timestamp 44:34.
- Titles changed between initial browse and subsequent navigation (likely creator title changes or experiments). Video IDs are the stable references.
- No remote video/audio was downloaded. No tools installed and no global agent configuration changed.

## AI LABS — rw0fqnrZgNM

Source: https://www.youtube.com/watch?v=rw0fqnrZgNM

Initial title: Insane Ways To Actually Use GitHub's #1 Trending Repo REA. Later browser title: GitHub's #1 Trending Skill Is Insane (5 Use Cases). Description date: October 15, 2026.

Relevant transcript observations:

- 2:06–2:44: advocate evidence IDs and observed/inferred/unknown distinctions; browser-visible evidence cannot reveal a private server implementation.
- 3:24–4:19: installation involves MCP plus workflow instructions; native decompiler is separate, unnecessary for static JavaScript/Electron.
- 4:50–6:19: record behavior before implementation, including interaction details, and distinguish facts found in code from unknown behavior. The example intentionally changes deletion behavior rather than demanding literal reproduction.
- 8:29–10:11: write scenarios, exercise boundary cases, report observations and uncertainties. Presenter describes a billing demo with mismatched totals and clearly labels a suspected cause as a guess.
- 10:57–11:46: security demonstration uses deliberately planted issues; this is a demo, not a comprehensive guarantee of security.

Useful method: create a feature behavior contract with evidence and edge cases before implementing. For this user, appropriate contracts include block execution, save/load, extension lifecycle, model load/inference, board connection, upload, and disconnected/error states.

Qualification: the description claims tracing exact request code and preserving all outgoing/incoming data. Current official REA browser docs are narrower: passive observation, bounded evidence, metadata by default; optional JSON body shapes omit values. Use the installed version's contracts, not the video's generalized description.

## Nick Saraev — dAzs_rU6080

Source: https://www.youtube.com/watch?v=dAzs_rU6080

Observed title: I Tested The Viral Github Repo That Reverse Engineers Anything. Description date: October 11, 2026.

Relevant transcript observations:

- 1:08–2:07: REA is an interface for investigation tools; agent iterates over findings, pseudocode, evidence and unknowns.
- 3:43–5:25: compares a Preview-like app built with and without REA. Non-REA result finishes first; narrator reports faster drawing in REA result and demonstrates a limited group of functions.
- 6:08–7:26: presenter explicitly questions hype and says star counts are not evidence of usefulness.
- 9:12–10:37: acknowledges ordinary agents can reproduce visible behavior, not exact functions, and that REA is not always faster.

Qualification: this is one informal comparison, without published reproducible acceptance coverage, equal-resource controls or complete source/evidence trail. Claims that most software will become open source or upcoming agents will absorb all capabilities are predictions, not engineering facts. Do not infer complete Preview compatibility or general speed gains.

## Vivek Mishra — fCSNcSHLyWc

Source: https://www.youtube.com/watch?v=fCSNcSHLyWc

Observed title: I Tested the Viral Reverse Engineer Anything Skill | Complete Masterclass. Runtime 44:38.

Relevant transcript observations:

- 5:49–6:23: repeat evidence → explanation → implementation → testing → follow-up investigation. Long-running loops consume resources.
- 17:37–19:18: distinguishes JavaScript/Electron from native binary work; the video's broad platform claims need qualification by current provider support.
- 20:45–23:31: shows initial report and confusion over MCP registration/session reload. Check actual server/tool visibility after configuration.
- 26:40–27:01: Hopper demo expires, requiring a different provider; 29:38 onward describes Ghidra installation and native analysis.
- 30:40–31:25: native analysis times out; presenter recommends studying one feature instead of an entire application and notes costs and limits.
- 31:31–31:50: supplements binary inspection with official shortcut documentation and other feature evidence.
- 39:46 and 41:17: presenter explicitly says generated app is incomplete.
- 41:30–41:41: skips suggested verification of exported files in original MindNode through an MCP integration.
- 42:54–43:43: large function analysis completes, but layout agent remains in another pass.

Useful method: scope investigation narrowly; combine code, direct UI observations and official docs; validate interoperable files in both systems; keep unfinished tests visible.

Qualification: claims early in video that everything works are contradicted by later incomplete status and skipped round-trip verification. Do not use the demo as proof that whole-app parity or commercial readiness was achieved. Model subscription percentages, decompiler price/performance, automatic permission bypass and blanket legal statements are not recommendations for this project.

## Authoritative REA sources examined

- https://github.com/morluto/rea — tool orchestration and supported target summary; local analysis is separate from the agent provider's data handling.
- https://github.com/morluto/rea/blob/main/docs/javascript-artifact-reconstruction.md — directory/ASAR analysis without executing target, explicit input path, artifact digest, evidence and coverage. Exact source selection reduces analysis scope; omitted files remain unknown. Summary output is supported by retained MCP evidence, whereas CLI emits full results.
- https://github.com/morluto/rea/blob/main/docs/javascript-application-workflows.md — retained-evidence projections, feature and semantic tracing, version comparisons; an empty page does not prove absence in an incompletely analyzed graph.
- https://github.com/morluto/rea/blob/main/docs/browser-observation.md — passive CDP observation, per-origin scope, static bundle candidates, screenshots and capture comparison; missing/truncated evidence never proves equivalence. CDP metadata does not expose private server logic.

Raw current-main copies of those documents are saved here with `rea-` filename prefix. They are dated snapshots and not pinned release promises. Exact capabilities must be checked against the installed REA release.

## Recommended application to the requested project (engineering inference)

Use upstream Scratch code directly for known open-source behavior. REA is a development investigation tool, not the application's block engine and not a dependency needed by child users. Use it only to answer concrete unknown interoperability questions in authorized local PictoBlox artifacts or observed UI. Produce evidence-backed behavior specifications, implement from licensed upstream code plus original work, and test each feature. No evidence in these videos establishes automatic hardware firmware support, Scratch extension compatibility, Junior mode or ML parity.
