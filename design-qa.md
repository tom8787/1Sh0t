# Design QA — Custom weapon outline

- Source visual truth: `C:\Users\user\AppData\Local\Temp\codex-clipboard-e33fdccf-ecc4-4274-ab89-8d880de5bab5.png`
- Browser-rendered implementation: `C:\Users\user\Documents\Codex\2026-07-13\sites-plugin-sites-openai-bundled\work\outline-implementation.png`
- Clean implementation state: `C:\Users\user\Documents\Codex\2026-07-13\sites-plugin-sites-openai-bundled\work\outline-clean.png`
- Combined focused comparison: `C:\Users\user\Documents\Codex\2026-07-13\sites-plugin-sites-openai-bundled\work\outline-qa-comparison.png`
- Viewport: 1267 × 712 desktop
- State: one catalog weapon selected, outline enabled, pink preset selected, 10 px thickness

**Findings**

- No actionable P0/P1/P2 mismatch. The implementation reproduces the requested visual behavior: a solid, rounded pink silhouette border follows the transparent weapon pixels and remains behind the original artwork.
- The weapon artwork differs from the reference because the test uses a different catalog skin; this is expected and does not affect outline fidelity.

**Required Fidelity Surfaces**

- Fonts and typography: Existing editor typography is preserved. The new control follows the inspector's label, value, and helper-text hierarchy with no wrapping or truncation.
- Spacing and layout rhythm: The outline control is grouped above transform controls with consistent 13–18 px internal rhythm and does not overflow the 310 px inspector.
- Colors and visual tokens: The default `#F3A3B4` closely matches the reference pink. Teal is retained for active/focus states so outline color and editor state are not confused.
- Image quality and asset fidelity: The border is generated from the real transparent weapon bitmap, not a rectangular frame. The contour is solid and rounded with no visible masking halo in the focused comparison.
- Copy and content: Controls clearly expose `物件外框`, `外框顏色`, and `外框粗度`, including the current color and pixel value.

**Interaction and Runtime Checks**

- Tested: open catalog, add a weapon, select the weapon, enable/disable outline, switch color presets, adjust the thickness slider, deselect on canvas, and render the clean result.
- Export path uses the same scene renderer, so the outline is included in exported PNG files while the editor-only selection box is omitted.
- Browser console checked after interaction: no errors or warnings; only Vite connection and React development informational logs.
- Persistence: outline enabled state, color, and width are stored with the existing scene item in local storage.

**Full-view Comparison Evidence**

- `outline-implementation.png` shows the complete editor with the selected weapon and all outline controls visible.

**Focused Region Comparison Evidence**

- `outline-qa-comparison.png` places the reference and clean browser render together. Both show a thick pastel-pink contour following the weapon silhouette, including internal protrusions and the grip area.

**Comparison History**

- Initial pass: no actionable P0/P1/P2 findings; no visual fixes were required after the combined comparison.

**Follow-up Polish**

- P3: A future performance pass could cache generated masks for scenes containing many outlined weapons; the current implementation remains responsive for normal compositions.

**Implementation Checklist**

- [x] Weapon and knife eligibility
- [x] Enable/disable outline
- [x] Custom color picker and presets
- [x] Adjustable 1–30 px thickness
- [x] Local persistence
- [x] PNG export support
- [x] Browser interaction and console verification

final result: passed
