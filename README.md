# Fretboard Trainer

A single-page guitar fretboard memorization tool. Plain HTML/CSS/JS, no build step, no backend.

**Live:** https://gigglesforless.github.io/guitar-app/

## Files

- `index.html` — page structure
- `style.css` — all styling/theme (colors are CSS variables at the top)
- `script.js` — all app logic (tunable settings are in the `CONFIG` object at the top)

## Publishing changes

The site is served directly from the `master` branch via GitHub Pages, so publishing is just:

```
git add -A
git commit -m "describe your change"
git push
```

The live site updates automatically within about a minute of pushing.
