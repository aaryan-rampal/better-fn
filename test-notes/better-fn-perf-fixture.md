# Better FN perf fixture

Use this note to compare footnote popover behavior before and after the
Tippy-to-HoverPopover migration.

## Trial protocol

Keep these fixed for every trial:

- Same Obsidian window size
- Same theme and zoom level
- Same editor mode
- Same Better FN settings
- Same gesture duration

Suggested trial set:

1. Enable Better FN perf logging.
2. Start a 10 second trial.
3. Hold Cmd/Ctrl if the mode requires it.
4. Move the pointer slowly inside a single footnote reference.
5. Stop the trial and record the JSON summary.
6. Repeat 5 times for each implementation.

Suggested order:

```text
A1 B1 B2 A2 A3 B3 A4 B4 B5 A5
```

Where `A` is the current implementation and `B` is the migrated implementation.

## Dense reference row

Hover across these references in one pass: [^short] [^link] [^math] [^multi]
[^embed-like] [^long].

## Single-reference stability target

For the single-reference trial, hover this reference and move within its visual
box without crossing into adjacent text: [^single].

## Mixed paragraph

This paragraph has ordinary prose around a footnote reference [^prose] so layout
and inline flow are closer to a real note. It should make it easier to see if
the popover changes size, jumps, or gets recreated as the pointer moves.

[^short]: Short footnote.

[^link]: Footnote with an internal link to [[fleeting]] and a normal
    external link to <https://example.com>.

[^math]: Footnote with inline math `$a^2 + b^2 = c^2$` and a displayed block:

    $$
    \sum_{i=1}^{n} i = \frac{n(n + 1)}{2}
    $$

[^multi]: First paragraph of a multi-paragraph footnote.

    Second paragraph with **bold text**, `inline code`, and a list:

    - alpha
    - beta
    - gamma

[^embed-like]: Footnote with an embed-like reference that may render differently
    depending on the vault: ![[Untitled.canvas]]

[^long]: This is a longer footnote intended to create a popover with enough
    content to expose sizing, scrolling, and reflow problems. It repeats a few
    ordinary sentences so the popover has real body. The quick brown fox jumps
    over the lazy dog. Pack my box with five dozen liquor jugs. Sphinx of black
    quartz, judge my vow.

[^single]: Single-reference stability footnote. This should create one stable
    popover during a trial where the pointer moves inside the footnote reference
    without leaving it.

[^prose]: Prose-context footnote. Use this when checking whether inline text
    layout around the  reference contributes to repeated popover creation.
