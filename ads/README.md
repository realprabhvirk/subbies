# Ads

Marketing videos and share copy for Subbies. One folder per piece, named `YYYY-MM-<what>`.

| Folder | What |
|---|---|
| `2026-10-launch-video/` | 21s launch video, landscape (1920×1080) and vertical for Reels/TikTok (1080×1920). 30fps, original music. The poster frame is baked in as frame 0 of each. |

## 2026-10-launch-video

- `subbies-launch.mp4` + `subbies-launch-poster.jpg`: landscape (YouTube, LinkedIn, website).
- `subbies-launch-vertical.mp4` + `subbies-launch-vertical-poster.jpg`: vertical (Reels, TikTok, Shorts). Same timing and music; key content stays clear of the app buttons and caption areas.
- `share-copy.txt`: post caption. `share-copy-reels.txt`: shorter caption with hashtags.
- `plan.md`: angle, storyboard and sound plan.
- `source/`: everything needed to re-render.

All names in the video are fictional demo data.

### Re-render

From `source/`, with Node + Playwright, Python 3 and ffmpeg installed:

```sh
python3 -m http.server 8765 -d site &      # serve the composition
mkdir -p frames
node frames.cjs frames 630                  # 21s × 30fps → PNG frames
node stills.cjs . 2.5 8.9 16.8              # optional: spot-check single frames
python3 synth.py                            # → audio.wav
cp frames/f0075.png frames/f0000.png        # bake the poster as frame 0
ffmpeg -framerate 30 -i frames/f%04d.png -i audio.wav \
  -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart \
  -af "loudnorm=I=-14:TP=-1.5:LRA=7" -c:a aac -b:a 192k -ar 48000 -shortest \
  subbies-launch.mp4
```

For the vertical version, render with `PAGE=comp-vertical.html W=1080 H=1920 node frames.cjs frames 630` and run the same ffmpeg command, writing to `subbies-launch-vertical.mp4`.

If Playwright can't find a browser, set `CHROMIUM_PATH` to a Chromium binary.

`source/site/comp.html` (landscape) and `comp-vertical.html` (vertical) are the whole animation: `window.render(t)` draws any moment in time. It uses a copy of the app's compiled CSS and fonts. If the app's design changes, copy the new CSS from `.next/static/chunks/` after a build.
