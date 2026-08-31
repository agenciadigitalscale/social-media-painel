import { describe, expect, it } from 'vitest'
import {
  classifyCreativeLink, creativeFilesOf, driveFileId, driveFolderId,
  isImageFile, isVideoFile, naturalCompare,
} from '../creativeLink'

describe('o que é o link do card', () => {
  it('reconhece PASTA — o caso que derrubava 40 das 47 falhas da semana', () => {
    const c = classifyCreativeLink('https://drive.google.com/drive/folders/1XW7KTZTTDeQaccV0wYP6nFtxJbzZ60-Z?usp=drive_link')
    expect(c.kind).toBe('folder')
    expect(c.id).toBe('1XW7KTZTTDeQaccV0wYP6nFtxJbzZ60-Z')
  })

  it('reconhece pasta também no formato /folders/ e com /u/0/', () => {
    expect(classifyCreativeLink('https://drive.google.com/folders/1abcdefghij').kind).toBe('folder')
    expect(classifyCreativeLink('https://drive.google.com/drive/u/0/folders/1abcdefghij').id).toBe('1abcdefghij')
  })

  it('reconhece arquivo', () => {
    const c = classifyCreativeLink('https://drive.google.com/file/d/1KEZKP7wFnYtaxSyHu_mbQV3U3czFBIQF/view?usp=drive_link')
    expect(c.kind).toBe('file')
    expect(c.id).toBe('1KEZKP7wFnYtaxSyHu_mbQV3U3czFBIQF')
  })

  it('reconhece arquivo no formato ?id=', () => {
    expect(classifyCreativeLink('https://drive.google.com/open?id=1abcdefghijk').kind).toBe('file')
  })

  it('reconhece Streamable', () => {
    expect(classifyCreativeLink('https://streamable.com/e/abc123').kind).toBe('streamable')
  })

  it('link de outro serviço é externo; texto solto é nada', () => {
    expect(classifyCreativeLink('https://exemplo.com/foto.jpg').kind).toBe('external')
    expect(classifyCreativeLink('mandei no zap').kind).toBe('none')
    expect(classifyCreativeLink('').kind).toBe('none')
    expect(classifyCreativeLink(undefined).kind).toBe('none')
  })

  it('pasta NÃO é confundida com arquivo pelos atalhos antigos', () => {
    const pasta = 'https://drive.google.com/drive/folders/1sm1_sHNCXBXrGTfaRL2ORaNtA4daAYxD'
    expect(driveFileId(pasta)).toBeNull()
    expect(driveFolderId(pasta)).toBe('1sm1_sHNCXBXrGTfaRL2ORaNtA4daAYxD')
    expect(driveFolderId('https://drive.google.com/file/d/1abcdefghijk/view')).toBeNull()
  })
})

describe('ordem do carrossel', () => {
  it('_2 vem antes de _10 — a sequência é o conteúdo', () => {
    const nomes = ['post_10.jpg', 'post_2.jpg', 'post_1.jpg']
    expect([...nomes].sort(naturalCompare)).toEqual(['post_1.jpg', 'post_2.jpg', 'post_10.jpg'])
  })

  it('respeita zero à esquerda e maiúsculas', () => {
    const nomes = ['Carrosel_03.jpg', 'carrosel_01.jpg', 'CARROSEL_02.jpg']
    expect([...nomes].sort(naturalCompare)).toEqual(['carrosel_01.jpg', 'CARROSEL_02.jpg', 'Carrosel_03.jpg'])
  })
})

describe('o que da pasta vai para a tela do cliente', () => {
  const arquivos = [
    { id: '1', name: 'arte_02.jpg',    mimeType: 'image/jpeg' },
    { id: '2', name: 'arte_01.jpg',    mimeType: 'image/jpeg' },
    { id: '3', name: 'legenda.txt',    mimeType: 'text/plain' },
    { id: '4', name: 'fonte.psd',      mimeType: 'image/vnd.adobe.photoshop' },
    { id: '5', name: 'Postados',       mimeType: 'application/vnd.google-apps.folder' },
    { id: '6', name: 'making_of.mp4',  mimeType: 'video/mp4' },
  ]

  it('só mídia, em ordem de leitura', () => {
    expect(creativeFilesOf(arquivos).map(f => f.name))
      .toEqual(['arte_01.jpg', 'arte_02.jpg', 'making_of.mp4'])
  })

  it('o .psd fica de fora — não abre em navegador nenhum e é bastidor', () => {
    expect(creativeFilesOf(arquivos).some(f => f.name.endsWith('.psd'))).toBe(false)
  })

  it('subpasta não entra', () => {
    expect(creativeFilesOf(arquivos).some(f => f.mimeType.includes('folder'))).toBe(false)
  })

  it('tem teto — pasta com 200 arquivos não vira 200 requisições na tela do cliente', () => {
    const muitos = Array.from({ length: 200 }, (_, i) => ({
      id: String(i), name: `a_${String(i).padStart(3, '0')}.jpg`, mimeType: 'image/jpeg',
    }))
    expect(creativeFilesOf(muitos)).toHaveLength(30)
  })

  it('sem mime, decide pela extensão — a coluna nasceu depois de parte do acervo', () => {
    expect(isImageFile({ name: 'foto.JPG' })).toBe(true)
    expect(isVideoFile({ name: 'reel.mov' })).toBe(true)
    expect(isImageFile({ name: 'arquivo.psd' })).toBe(false)
  })
})
