import { describe, expect, it } from 'vitest'
import { makeBird, parseList, search } from './match'

const birds = [
  'Northern Cardinal',
  'Northern Flicker',
  'Black-Capped Chickadee',
  'Red-Tailed Hawk',
  "Wilson's Snipe",
  'Grey Heron',
  'American Robin',
].map(makeBird)

const names = (q: string, mode: 'typed' | 'voice' = 'typed') => search(q, birds, mode).results.map((b) => b.name)
const verdict = (q: string, mode: 'typed' | 'voice' = 'typed') => search(q, birds, mode).verdict

describe('typed search', () => {
  it('prefix matches any word', () => {
    expect(names('nor')).toEqual(['Northern Cardinal', 'Northern Flicker'])
    expect(names('chick')).toEqual(['Black-Capped Chickadee'])
  })
  it('multi-token narrows and full match says pull', () => {
    expect(names('nor car')).toEqual(['Northern Cardinal'])
    expect(verdict('nor car')).toMatchObject({ kind: 'match' })
  })
  it('partial is a maybe, nothing is none', () => {
    expect(verdict('nor')).toMatchObject({ kind: 'maybe', count: 2 })
    expect(verdict('zzz')).toEqual({ kind: 'none' })
    expect(verdict('northern shoveler')).toEqual({ kind: 'none' })
  })
  it('tolerates typos, punctuation and spelling variants', () => {
    expect(names('cardnal')).toEqual(['Northern Cardinal'])
    expect(names('wilsons')).toEqual(["Wilson's Snipe"])
    expect(names('gray heron')).toEqual(['Grey Heron'])
    expect(names('redtailed')).toEqual(['Red-Tailed Hawk'])
  })
})

describe('voice search', () => {
  it('ignores filler and unknown words', () => {
    expect(verdict('uh the northern cardinal', 'voice')).toMatchObject({ kind: 'match', bird: { name: 'Northern Cardinal' } })
    expect(names('northern', 'voice')).toEqual(['Northern Cardinal', 'Northern Flicker'])
  })
  it('never claims a full match when the spoken bird is not listed', () => {
    const r = search('northern shoveler', birds, 'voice')
    expect(r.verdict).toMatchObject({ kind: 'maybe' })
    expect(r.ignored).toEqual(['shoveler'])
    expect(search('chihuahuan raven', birds, 'voice').verdict).toEqual({ kind: 'none' })
  })
  it('handles plurals and possessives from speech', () => {
    expect(verdict('northern cardinals', 'voice')).toMatchObject({ kind: 'match' })
    expect(verdict("wilson's snipe", 'voice')).toMatchObject({ kind: 'match' })
    expect(verdict('black capped chickadee', 'voice')).toMatchObject({ kind: 'match' })
  })
})

describe('parseList', () => {
  it('strips numbering/bullets and dedupes', () => {
    expect(parseList('1. Northern Cardinal\n2) Blue Jay\n- blue jay\n\n• Mallard ')).toEqual(['Northern Cardinal', 'Blue Jay', 'Mallard'])
    expect(parseList('Mallard, Blue Jay')).toEqual(['Mallard', 'Blue Jay'])
  })
})
