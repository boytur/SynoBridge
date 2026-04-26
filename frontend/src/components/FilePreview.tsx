import { X, Download, FileText, Music, Video, Image as ImageIcon, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fileSystemApi } from '@/lib/api'
import type { FileInfo } from '@/lib/types'
import { useEffect, useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface Props {
  file: FileInfo | null
  connectionId: number
  onClose: () => void
}

export function FilePreview({ file, connectionId, onClose }: Props) {
  const [textContent, setTextContent] = useState<string | null>(null)
  const [isTextLoading, setIsTextLoading] = useState(false)

  const url = file ? fileSystemApi.getFileUrl(connectionId, file.path) : ''
  const ext = file?.name.split('.').pop()?.toLowerCase() || ''
  
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
  const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext)
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)
  const isPdf = ext === 'pdf'
  const isText = ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'go', 'py', 'html', 'css', 'log', 'env', 'yml', 'yaml', 'sh', 'sql', 'conf', 'ini', 'dockerfile', 'makefile'].includes(ext) || file?.name.startsWith('.')

  const getLanguage = (extension: string, filename?: string) => {
    if (filename?.toLowerCase() === 'makefile') return 'makefile'
    if (filename?.toLowerCase() === 'dockerfile') return 'dockerfile'
    if (filename?.startsWith('.')) return 'bash'
    
    const map: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      go: 'go',
      py: 'python',
      json: 'json',
      css: 'css',
      html: 'html',
      md: 'markdown',
      sh: 'bash',
      env: 'bash',
      yml: 'yaml',
      yaml: 'yaml',
      sql: 'sql',
      conf: 'ini',
      ini: 'ini',
    }
    return map[extension] || 'text'
  }

  useEffect(() => {
    if (file && isText) {
      setIsTextLoading(true)
      setTextContent(null)
      fetch(url)
        .then(res => res.text())
        .then(text => {
          setTextContent(text)
          setIsTextLoading(false)
        })
        .catch(() => {
          setIsTextLoading(false)
        })
    }
  }, [file, isText, url])

  if (!file) return null

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] sm:h-[85vh] w-[95vw] sm:w-full flex flex-col p-0 overflow-hidden bg-background/95 dark:bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl">
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border/50 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              {isImage ? <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" /> : 
               isVideo ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> :
               isAudio ? <Music className="w-4 h-4 sm:w-5 sm:h-5" /> :
               <FileText className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm sm:text-base font-semibold truncate pr-4">
                {file.name}
              </DialogTitle>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 pr-6 sm:pr-8">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => fileSystemApi.download(connectionId, file.path)} title="Download">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => window.open(url, '_blank')} title="Open in New Tab">
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 sm:hidden" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-black/[0.02] dark:bg-black/20 flex items-center justify-center">
          {isImage ? (
            <div className="w-full h-full p-2 sm:p-4 flex items-center justify-center overflow-auto">
              <img 
                src={url} 
                alt={file.name} 
                className="max-w-full max-h-full object-contain shadow-xl rounded-md sm:rounded-lg animate-in fade-in zoom-in duration-300"
              />
            </div>
          ) : isVideo ? (
            <div className="w-full h-full flex items-center justify-center p-0 sm:p-4">
              <video 
                src={url} 
                controls 
                autoPlay
                className="max-w-full max-h-full shadow-2xl sm:rounded-lg"
              />
            </div>
          ) : isAudio ? (
            <div className="w-full max-w-md mx-4 p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-white/50 dark:bg-white/5 border border-border/50 backdrop-blur-md shadow-lg">
               <div className="flex justify-center mb-6 sm:mb-8">
                  <div className="p-5 sm:p-6 rounded-full bg-primary/20 text-primary animate-pulse">
                    <Music className="w-10 h-10 sm:w-12 sm:h-12" />
                  </div>
               </div>
               <audio src={url} controls className="w-full" />
            </div>
          ) : isPdf ? (
            <iframe src={url} title="PDF Preview" className="w-full h-full bg-white" />
          ) : isText ? (
            <div className="w-full h-full overflow-auto bg-[#282c34]">
              {isTextLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm">Reading file content...</p>
                </div>
              ) : (
                <SyntaxHighlighter
                  language={getLanguage(ext, file.name)}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    padding: '16px sm:24px',
                    fontSize: '12px sm:13px',
                    backgroundColor: 'transparent',
                    lineHeight: '1.6',
                  }}
                  showLineNumbers
                  lineNumberStyle={{ minWidth: '2.5em', paddingRight: '1em', color: '#abb2bf', opacity: 0.5 }}
                >
                  {textContent || ''}
                </SyntaxHighlighter>
              )}
            </div>
          ) : (
            <div className="text-center space-y-4 p-6">
              <div className="flex justify-center">
                <div className="p-6 rounded-3xl bg-black/[0.05] dark:bg-white/5 text-muted-foreground/50 border border-border/50">
                  <FileText className="w-12 h-12 sm:w-16 sm:h-16" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium">No preview available for this file type</p>
                <Button variant="outline" size="sm" onClick={() => fileSystemApi.download(connectionId, file.path)} className="rounded-full">
                  Download to view
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
