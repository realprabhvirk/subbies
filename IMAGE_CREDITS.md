# Image credits

Photos used on the marketing homepage, sourced via the official [Unsplash API](https://unsplash.com/developers) under the [Unsplash License](https://unsplash.com/license) (free for commercial use, no attribution legally required — credited here anyway as good practice, and so any of these is easy to trace back and swap out later).

Each image was downloaded through Unsplash's API at a size matching where it renders, converted to WebP, and stored under `public/marketing/`. Unsplash's required download-tracking ping (`GET /photos/:id/download`) was sent for each at the time of sourcing, per their [API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines).

| File | Section | Photographer | Source |
| --- | --- | --- | --- |
| `hero-construction.webp` | Hero background | Kabiur Rahman Riyad ([@riiyad](https://unsplash.com/@riiyad)) | [unsplash.com/photos/E6pAxmbSTuY](https://unsplash.com/photos/a-person-on-a-roof-with-a-sky-background-E6pAxmbSTuY) |
| `how-it-works-1.webp` | How it works — Step 1 (Onboard) | Marc Pell ([@blinky264](https://unsplash.com/@blinky264)) | [unsplash.com/photos/VV_f1XP1lXM](https://unsplash.com/photos/a-person-cutting-a-piece-of-wood-with-a-knife-VV_f1XP1lXM) |
| `how-it-works-2.webp` | How it works — Step 4 (Track) | Valentina Giarre ([@valentinagiarre](https://unsplash.com/@valentinagiarre)) | [unsplash.com/photos/jdriGWcZZKo](https://unsplash.com/photos/person-in-gray-t-shirt-holding-green-and-white-plastic-tool-jdriGWcZZKo) |
| `trust-crew.webp` | Trust section | Joe Holland ([@jos_holland111](https://unsplash.com/@jos_holland111)) | [unsplash.com/photos/80zZ1s24Nag](https://unsplash.com/photos/two-construction-workers-in-safety-vests-at-site-80zZ1s24Nag) |

## Note on `trust-crew.webp`

This photo has real, incidental third-party branding visible on the safety gear (hard hat and vest logos: "ROEL", "delawie", "ULINE" — none affiliated with Subbies). This is normal in documentary-style stock photography and doesn't affect the Unsplash License, but if it ever reads as a concern, swap it for a different crew shot — the search terms and candidate pool that produced this pick are documented in the corresponding pull request / build session, not reproduced here since Unsplash's search results change over time.

## Unused legacy assets

`public/marketing/blueprint.jpg`, `build.jpg`, and `crew.jpg` predate this pass and are no longer referenced by any page as of the premium visual upgrade. Left in place rather than deleted, since removing files nobody asked about wasn't in scope here — safe to delete if you don't want them kept around.
