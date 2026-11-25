# DUETBlox 0.9.3 — Mascot companions

Zuni the robot fox, Duvi the robot, and Tiko the fox now celebrate meaningful milestones in Junior and checked-off guided lessons. They use original, code-native SVG artwork, work without remote image downloads, and offer five short dances: happy bounce, robot shuffle, little spin, high-five, and victory pose. The three colour palettes and preferred dance can be changed in Mascot settings.

## Student experience

- A Junior project's first naturally completed story with actual meaningful operations earns one acknowledgement. Clicking Play alone does not qualify. Empty programs, no-op actions, stopped runs, infinite loops and runtime errors do not earn success.
- Optional Junior challenges check the selected character's actual final state: move exactly three squares right on the same row, or finish a quarter turn clockwise from its starting direction. Selecting a challenge does not replace or edit student code.
- A completed lesson checklist says **You checked every step!**, retaining the existing distinction between self-reported progress and automatic assessment. No hardware verification is inferred from a checked box.
- Dances run for 2.6 seconds, remain beside the activity in normal document flow, and never steal focus. Replay does not rerun a program. Skip stops animation immediately; Done closes the resting card. Text remains available after motion stops.
- Sound defaults off. An explicit opt-in enables a quiet, synthesized local chime; browser audio restrictions may require Preview dance or Replay after a reload. No camera, microphone, account or network service is requested.
- Reduced motion respects both the device preference and an app toggle, displaying static encouragement. Celebrations can be disabled entirely. There are no streaks, rankings, penalties or locked learning features.
- Preferences and at most 500 milestone IDs are stored separately from projects in this browser. Storage errors fall back to the current visit; nothing is sent to analytics. Child names, code and scores are not stored in this preference record.

## Evidence behind the design

[APA guidance on praise](https://www.apa.org/education-career/k12/using-praise) supports specific feedback about work and strategies and cautions against trivial or inflated praise. [Harvard's motivation guidance](https://developingchild.harvard.edu/resources/briefs/how-to-motivate-children-science-based-approaches-for-parents-caregivers-and-teachers/) supports playful exploration, achievable goals and student choice while recommending incentives sparingly. [W3C animation guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions) supports disabling nonessential motion.

The mascot artwork and 2.6-second duration are design choices, not experimentally proven engagement improvements. No children participated in validation yet; child preference and classroom usefulness remain to be tested with teacher-supported sessions. Suggested pilot: offer mascot choice, observe whether children can return to coding without help, and ask whether they want the celebration repeated or quieter. Avoid collecting identifying information.

## Implementation and limits

The Junior compiler can add hidden runtime counters after completed meaningful operations. They are generated in the VM project rather than saved in the Junior story. The bridge correlates an explicitly armed run with its completion and initial/final target state, and invalidates it on cancellation, replacement, runtime error or scene interruption. Main Scratch behavior is retained. Explicit scene transitions conservatively suppress completion in this release because they can terminate unfinished scripts.

Automatic milestone verification currently covers Junior. Other guided activities use their honest self-check workflow; this release does not certify a real robot, circuit, or ML model as correct. Ordinary Scratch free-play is not automatically graded. The existing update-recovery page can install this release while preserving browser project data; long-lived hosting cache headers and older in-app browser sessions remain separate known deployment issues.

## Validation

Test commands and final deployment evidence are recorded under `work/celebrations-20261125/` in the laptop checkout. Automated coverage includes genuine Scratch execution, negative completion cases, wrong/correct challenge outcomes, milestone deduplication, sound opt-in, replay/skip, persistence, storage failures, reduced motion, focus, and desktop/phone layouts. Physical speaker acceptance and child usability testing are not claimed.
