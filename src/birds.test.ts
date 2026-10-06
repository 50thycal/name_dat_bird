import { describe, expect, it } from 'vitest'
import { BIRDS } from './birds'
import { makeBird, search } from './match'

const birds = BIRDS.map(makeBird)

// How the same name tends to come out of speech recognition: plain
// apostrophes, no hyphens, no diacritics, lowercase.
const spoken = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/’/g, "'").replace(/-/g, ' ').toLowerCase()

describe('real list', () => {
  it('has no duplicate names', () => {
    expect(new Set(birds.map((b) => b.compact)).size).toBe(birds.length)
  })

  it.each(BIRDS)('%s matches itself typed and spoken', (name) => {
    for (const [q, mode] of [
      [name, 'typed'],
      [spoken(name), 'typed'],
      [spoken(name), 'voice'],
    ] as const) {
      const v = search(q, birds, mode).verdict
      expect(v.kind === 'match' && v.bird.name, `${mode}: "${q}"`).toBe(name)
    }
  })

  // Real Wingspan birds NOT on the list that share words with listed ones.
  // These must never produce a "Pull it" verdict.
  it.each([
    'Common Raven', 'American Robin', 'Barn Swallow', "Barrow's Goldeneye", 'Ruddy Duck',
    'Snowy Owl', 'Great Crested Grebe', 'Hooded Crow', 'Rock Pigeon', 'Red-Tailed Hawk',
    'Willow Ptarmigan', 'American Coot', 'Horned Grebe', 'Common Tern', 'Gray Catbird',
    'Little Owl', 'Eurasian Eagle-Owl', 'White-Throated Dipper', 'Northern Cardinal',
    'Black Redstart', 'Common Kingfisher', 'House Finch', 'Red Crossbill', 'Great Blue Heron',
    'Grey Heron', 'Cattle Egret', 'Eastern Bluebird', 'Wood Duck', 'Common Chiffchaff',
    'Spotted Owl', 'Black Skimmer', 'Golden-Crowned Kinglet', 'Red-Winged Blackbird',
    'White-Breasted Nuthatch', 'Eurasian Tree Sparrow', 'Common Grackle', 'Little Penguin',
    'Black Swan', 'Australian Raven', 'Red Kite', 'Crested Caracara', 'Black-Necked Stilt',
  ])('%s is not a pull', (name) => {
    for (const mode of ['typed', 'voice'] as const) {
      expect(search(spoken(name), birds, mode).verdict.kind, mode).not.toBe('match')
    }
  })
})
