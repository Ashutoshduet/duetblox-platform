# Zuni as a programmable character

Zuni, DUETBlox's original robot-fox companion, is also an optional stage character in both editors. Existing stories and the default characters stay as they are.

The main **Workspace** welcome screen also shows Zuni. **Create with Zuni** opens a short Junior example that moves, speaks, jumps and finishes in the Cheer costume, with the existing first-story lesson guide. It saves a complete recovery copy of the current workspace before opening the example; if that backup cannot be saved, the existing work stays open. Merely visiting the welcome screen does not start or replace a story.

- **Junior Blocks:** select **Add character → Zuni**. In **Looks**, use **Costume** to choose a pose or **Next costume** to animate. **Edit character & scene → Starting costume** sets the initial pose.
- **Blocks:** open **Choose a Sprite**, search for **Zuni**, and select it. The **Costumes** tab contains all six editable vector costumes. The standard **switch costume to** and **next costume** Looks blocks control them.

The ordered costumes are **Hello**, **Walk A**, **Walk B**, **Jump**, **Cheer**, and **Think**. Alternate Walk A/Walk B with a short wait and movement blocks to make Zuni walk. Changing the Jump costume changes its appearance; add motion blocks to move it through the stage.

Every pose uses the same 120×120 SVG canvas and 60/60 rotation center. The SVGs are bundled with the app and embedded in saved Scratch projects. Adding Zuni needs no asset-server request. Junior stories store the built-in character and costume selection; uploaded costumes follow the six built-in poses and remain supported. The celebration companion and the programmable character are independent.

Artwork source: `src/characters/zuni.js`. Junior mappings are in `src/junior/assets.js`; normal Blocks uses the pinned official Scratch GUI dynamic-assets API in `apps/scratch-editor/src/character-library.js`.

Regression coverage includes six unique embedded SVGs, named and next-costume execution, independent duplicate sprites, old characters' uploaded-costume indexes, starting-pose persistence, and project save/reopen. Browser checks use the real Scratch VM rather than a mocked renderer.
