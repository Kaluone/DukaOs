import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Upload, Trash2, Download, FileText, Image } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'

interface Attachment {
  id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  created_at: string
}

interface Props {
  shopId: string
  entityType: 'purchase' | 'expense' | 'supplier' | 'transaction'
  entityId: string
  readOnly?: boolean
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1048576).toFixed(1)}MB`
}

export function DocumentAttachments({ shopId, entityType, entityId, readOnly = false }: Props) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey: ['attachments', entityType, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data } = await supabase
        .from('document_attachments')
        .select('id, file_name, file_size, mime_type, storage_path, created_at')
        .eq('shop_id', shopId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
      return (data ?? []) as Attachment[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (attachment: Attachment) => {
      await supabase.storage.from('documents').remove([attachment.storage_path])
      await supabase.from('document_attachments').delete().eq('id', attachment.id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', entityType, entityId] }),
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('File too large (max 10MB)'); return }
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${shopId}/${entityType}/${entityId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type })
      if (upErr) throw upErr
      const { error: dbErr } = await supabase.from('document_attachments').insert({
        shop_id: shopId, entity_type: entityType, entity_id: entityId,
        file_name: file.name, file_size: file.size, mime_type: file.type, storage_path: path,
      })
      if (dbErr) throw dbErr
      qc.invalidateQueries({ queryKey: ['attachments', entityType, entityId] })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDownload = async (attachment: Attachment) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(attachment.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const getIcon = (mime: string) => mime.startsWith('image/') ? Image : FileText

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          <Paperclip size={14} />
          Attachments ({attachments.length})
        </div>
        {!readOnly && (
          <>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <Upload size={12} /> {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <input ref={fileRef} type="file" onChange={handleUpload} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt" />
          </>
        )}
      </div>
      {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {attachments.length === 0 ? (
        <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 12 }}>
          No files attached
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {attachments.map(a => {
            const Icon = getIcon(a.mime_type)
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <Icon size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', flexShrink: 0 }}>{formatBytes(a.file_size)}</span>
                <button onClick={() => handleDownload(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: '2px 4px' }} title="Download">
                  <Download size={12} />
                </button>
                {!readOnly && (
                  <button onClick={() => { if (confirm('Delete this file?')) deleteMutation.mutate(a) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px 4px' }} title="Delete">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
