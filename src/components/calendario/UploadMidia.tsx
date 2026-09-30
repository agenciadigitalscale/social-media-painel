/**
 * Área de envio de mídia — usada no "Criar publicação" e na revisão ("Trocar
 * mídia"). Arrastar ou escolher, várias de uma vez, com prévia, progresso,
 * remover e reordenar (a ordem é a do carrossel).
 *
 * Controlado por fora: `value` são os anexos JÁ enviados, na ordem; os que
 * ainda estão subindo vivem aqui dentro e entram no fim quando terminam.
 */
import { useEffect, useRef, useState } from 'react'
import { Box, IconButton, LinearProgress, Tooltip, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { enviarArquivo, tipoDoArquivo, TIPOS_ANEXO, type Anexo } from '../../lib/anexos'

interface Subindo { id: string; nome: string; progresso: number; previa: string; video: boolean; erro?: string }

export default function UploadMidia({ value, onChange, onEnviando, compacto }: {
  value: Anexo[]
  onChange: (anexos: Anexo[]) => void
  /** Avisa quem está fora se ainda há arquivo subindo (para travar o "continuar"). */
  onEnviando?: (enviando: boolean) => void
  compacto?: boolean
}) {
  const [subindo, setSubindo] = useState<Subindo[]>([])
  const [arrastando, setArrastando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const valorRef = useRef(value)
  valorRef.current = value

  const ativos = subindo.some(s => !s.erro)
  useEffect(() => { onEnviando?.(ativos) }, [ativos, onEnviando])

  const anexar = (lista: FileList | File[]) => {
    for (const arquivo of Array.from(lista)) {
      const id = crypto.randomUUID()
      const tipo = tipoDoArquivo(arquivo)
      const video = tipo.startsWith('video/')
      if (!TIPOS_ANEXO.includes(tipo)) {
        setSubindo(v => [...v, { id, nome: arquivo.name, progresso: 0, previa: '', video, erro: 'Formato não aceito — use JPG, PNG, MP4 ou MOV.' }])
        continue
      }
      const previa = URL.createObjectURL(arquivo)
      setSubindo(v => [...v, { id, nome: arquivo.name, progresso: 0, previa, video }])
      enviarArquivo(arquivo, p => setSubindo(v => v.map(s => s.id === id ? { ...s, progresso: p } : s)))
        .then(anexo => {
          setSubindo(v => v.filter(s => s.id !== id))
          URL.revokeObjectURL(previa)
          onChange([...valorRef.current, anexo])
        })
        .catch((e: Error) => setSubindo(v => v.map(s => s.id === id ? { ...s, erro: e.message } : s)))
    }
  }

  const mover = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= value.length) return
    const nova = [...value]; [nova[i], nova[j]] = [nova[j], nova[i]]
    onChange(nova)
  }

  return (
    <Box>
      <Box
        {...clickable(() => inputRef.current?.click())}
        onDragOver={e => { e.preventDefault(); setArrastando(true) }}
        onDragLeave={() => setArrastando(false)}
        onDrop={e => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files.length) anexar(e.dataTransfer.files) }}
        sx={{
          p: compacto ? 1.4 : 2.2, borderRadius: '12px', textAlign: 'center', cursor: 'pointer',
          border: `1.5px dashed ${arrastando ? DS.accent : DS.borderHov}`, bgcolor: arrastando ? `${DS.accent}0d` : DS.surfaceAlt,
          transition: 'all 0.18s ease',
        }}>
        <CloudUploadIcon sx={{ fontSize: compacto ? 22 : 28, color: DS.t2 }} />
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: DS.t1 }}>
          {value.length ? 'Arraste mais arquivos ou clique para adicionar' : 'Arraste os arquivos aqui ou clique para escolher'}
        </Typography>
        <Typography sx={{ fontSize: '0.66rem', color: DS.t3 }}>JPG, PNG, MP4 ou MOV · até 1 GB · carrossel: a ordem abaixo é a ordem do post</Typography>
        <input ref={inputRef} type="file" multiple hidden accept=".jpg,.jpeg,.png,.mp4,.mov,image/jpeg,image/png,video/mp4,video/quicktime"
          onChange={e => { if (e.target.files) anexar(e.target.files); e.target.value = '' }} />
      </Box>

      {(value.length > 0 || subindo.length > 0) && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.2 }}>
          {value.map((a, i) => (
            <Peca key={a.key} ordem={i + 1} nome={a.nome} src={a.url} video={a.tipo.startsWith('video/')}
              onRemover={() => onChange(value.filter(x => x.key !== a.key))}
              onEsquerda={i > 0 ? () => mover(i, -1) : undefined}
              onDireita={i < value.length - 1 ? () => mover(i, 1) : undefined} />
          ))}
          {subindo.map(s => (
            <Peca key={s.id} nome={s.nome} src={s.previa} video={s.video} progresso={s.progresso} erro={s.erro}
              onRemover={() => { if (s.previa) URL.revokeObjectURL(s.previa); setSubindo(v => v.filter(x => x.id !== s.id)) }} />
          ))}
        </Box>
      )}
    </Box>
  )
}

function Peca({ ordem, nome, src, video, progresso, erro, onRemover, onEsquerda, onDireita }: {
  ordem?: number; nome: string; src: string; video: boolean; progresso?: number; erro?: string
  onRemover: () => void; onEsquerda?: () => void; onDireita?: () => void
}) {
  const botao = { p: 0.2, bgcolor: 'rgba(0,0,0,0.6)', color: DS.t1, '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' } }
  return (
    <Box sx={{ width: 104 }}>
      <Box sx={{ position: 'relative', width: 104, height: 130, borderRadius: '8px', overflow: 'hidden', bgcolor: DS.surfaceAlt, border: `1px solid ${erro ? DS.red : DS.border}` }}>
        {src && (video
          ? <Box component="video" src={src} muted preload="metadata" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Box component="img" src={src} alt={nome} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
        {ordem && <Typography sx={{ position: 'absolute', top: 4, left: 6, fontSize: '0.62rem', fontWeight: 800, color: DS.t1, textShadow: '0 1px 2px #000' }}>{ordem}</Typography>}
        <IconButton size="small" aria-label={`Remover ${nome}`} onClick={onRemover} sx={{ position: 'absolute', top: 2, right: 2, ...botao }}>
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
        {(onEsquerda || onDireita) && (
          <Box sx={{ position: 'absolute', bottom: 3, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', px: 0.4 }}>
            <Tooltip title="Mover para antes"><span>{onEsquerda && <IconButton size="small" aria-label="Mover para antes" onClick={onEsquerda} sx={botao}><ChevronLeftIcon sx={{ fontSize: 16 }} /></IconButton>}</span></Tooltip>
            <Tooltip title="Mover para depois"><span>{onDireita && <IconButton size="small" aria-label="Mover para depois" onClick={onDireita} sx={botao}><ChevronRightIcon sx={{ fontSize: 16 }} /></IconButton>}</span></Tooltip>
          </Box>
        )}
      </Box>
      <Typography noWrap title={nome} sx={{ fontSize: '0.62rem', color: DS.t2, mt: 0.3 }}>{nome}</Typography>
      {erro
        ? <Typography sx={{ fontSize: '0.6rem', color: DS.redSoft }}>{erro}</Typography>
        : progresso !== undefined && <LinearProgress variant="determinate" value={progresso * 100} sx={{ mt: 0.3, height: 4, borderRadius: 2 }} />}
    </Box>
  )
}
