import { describe, it, expect } from 'vitest'
import { protectMediaLinksValue } from '../drive-video-links'

describe('protectMediaLinksValue', () => {
  it('sanitizes valid media link entries and drops invalid keys', () => {
    const input = {
      '2007': {
        itemId: 2007,
        clientId: 'Padaria Sol',
        fileId: 'drive:AAA111',
        url: 'https://drive.google.com/file/d/AAA111/view',
        folderStage: 'publicar',
        source: 'drive',
        confirmed: true,
        linkedAt: 1,
        updatedAt: 2,
        filename: '2007 - Unboxing.mp4',
        previewStatus: 'ready',
        previewAttempts: 0,
      },
      bad: {
        itemId: 'x',
        clientId: null,
      },
    }

    const output = protectMediaLinksValue(input)
    expect(typeof output).toBe('string')
    const parsed = JSON.parse(output)
    expect(parsed).toHaveProperty('2007')
    expect(parsed.bad).toBeUndefined()
    expect(parsed['2007']).toMatchObject({
      itemId: 2007,
      clientId: 'Padaria Sol',
      fileId: 'drive:AAA111',
      confirmed: true,
      folderStage: 'publicar',
      source: 'drive',
      previewStatus: 'ready',
      previewAttempts: 0,
    })
  })

  it('returns empty object string for invalid JSON string input', () => {
    expect(protectMediaLinksValue('not json')).toBe('{}')
  })

  it('returns empty object string for non-object input', () => {
    expect(protectMediaLinksValue(123)).toBe('{}')
    expect(protectMediaLinksValue(null)).toBe('{}')
  })
})
