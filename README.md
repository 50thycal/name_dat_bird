# Name Dat Bird

Small web app for sorting a Wingspan deck against the Fan Art Pack. Look at a
card, type a few letters or just say the name, and it tells you right away
whether that bird has a fan-art replacement to pull.

- **Typing:** prefix match on any word, so `nor car` → Northern Cardinal. Small typos are tolerated.
- **Voice:** tap the mic once and it keeps listening. Results update as you speak, using the most recent phrase. Filler and misheard words are ignored. Uses the browser's Web Speech API (Chrome, Edge, Safari; not Firefox).
- **Verdict bar:** *Pull it* (every word of a listed bird matched), *N possible matches* (partial), or *Not on list* (keep the card).
- **Pulled tracking:** tap a row (or press Enter on a match) to check it off. Saved on the device.
- **List editor:** tap **List** to paste a different list (one per line, numbering stripped). Saved on the device.

## The bird list

Edit `src/birds.ts`. Set `SAMPLE_LIST = false` once the real list is in.

## Dev

```sh
npm install
npm run dev     # local server
npm test        # matcher tests
npm run build   # production build to dist/
```

Deployed on Vercel. Pushes to `main` deploy automatically.
