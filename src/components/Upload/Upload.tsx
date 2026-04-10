import { useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload as UploadIcon, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { uploadFileReq } from '@/api/files'
import { useLoginStore } from '@/stores/loginStore'
import type { UploadFile, UploadFileResponse } from './types'
import { cn } from '@/lib/utils'

export interface UploadProps {
  value: UploadFile | null
  onChange: (file: UploadFile | null) => void
  onChangeFile?: (file: UploadFile | null) => void
  accept?: string[]
  sizeLimit?: number // 不传则不限制文件大小
  className?: string
  disabled?: boolean
}

const defaultAccept = ['.txt', '.doc', '.docx']

const formatFileSize = (size: number | undefined | null): string => {
  if (!size || size === 0) return '0.00MB'
  const sizeInMB = size / (1024 * 1024)
  if (sizeInMB < 0.01) return '0.01MB'
  return `${sizeInMB.toFixed(2)}MB`
}

export const Upload = ({
  value,
  onChange,
  onChangeFile,
  accept = defaultAccept,
  sizeLimit,
  className,
  disabled = false,
}: UploadProps) => {
  const isUploadingRef = useRef(false)
  const requireLogin = useLoginStore((s) => s.requireLogin)

  const validateFile = useCallback(
    (file: File): string | null => {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
      const acceptList = accept.map((e) => e.trim().toLowerCase())
      if (!acceptList.includes(ext)) {
        const list = accept.map((e) => e.replace(/^\./, ''))
        return `仅支持 ${list.join('、')} 格式`
      }
      if (sizeLimit && file.size > sizeLimit) {
        const mb = (sizeLimit / (1024 * 1024)).toFixed(0)
        return `文件大小不超过 ${mb}MB`
      }
      return null
    },
    [accept, sizeLimit]
  )

  const doUpload = useCallback(
    async (file: File) => {
      try {
        await requireLogin(async () => {
          if (isUploadingRef.current) return
          isUploadingRef.current = true
          const uploadFile: UploadFile = {
            name: file.name,
            size: file.size,
            raw: file,
            uid: Date.now(),
            status: 'uploading',
          }
          onChange(uploadFile)
          onChangeFile?.(uploadFile)
          try {
            const result = await uploadFileReq(file)
            const next: UploadFile = {
              ...uploadFile,
              status: 'success',
              response: result as UploadFileResponse,
            }
            onChange(next)
            onChangeFile?.(next)
          } catch {
            toast.error('文件上传失败，请重试')
            onChange(null)
            onChangeFile?.(null)
          } finally {
            isUploadingRef.current = false
          }
        })
      } catch (error) {
        const err = error as Error | undefined
        if (err?.message !== '需要登录') {
          console.error('上传前登录校验失败:', error)
          toast.error('拉起登录失败，请稍后重试')
        }
      }
    },
    [onChange, onChangeFile, requireLogin]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return
      const err = validateFile(file)
      if (err) {
        toast.error(err)
        return
      }
      doUpload(file)
    },
    [validateFile, doUpload]
  )

  const acceptMime = accept.reduce((acc, ext) => {
    const e = ext.trim().replace(/^\./, '')
    if (e === 'txt') acc['text/plain'] = []
    if (e === 'doc') acc['application/msword'] = []
    if (e === 'docx') acc['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] = []
    return acc
  }, {} as Record<string, string[]>)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptMime,
    ...(sizeLimit ? { maxSize: sizeLimit } : {}),
    maxFiles: 1,
    disabled,
    noClick: false,
    noKeyboard: false,
  })

  const acceptText = `仅支持 ${accept.map((e) => e.replace(/^\./, '')).join('、')} 文件格式${sizeLimit ? `, 文件大小限制 ${(sizeLimit / (1024 * 1024)).toFixed(0)}MB` : ''}`

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(null)
      onChangeFile?.(null)
    },
    [onChange, onChangeFile]
  )

  return (
    <div
      {...getRootProps()}
      className={cn(
        'file-uploader flex w-full cursor-pointer items-center hover:border-(--theme-color) justify-center rounded-xl border-2 border-dashed transition-all duration-300 ease-in-out',
        isDragActive ? 'border-theme' : 'border-[#d9d9d9]',
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-primary">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-muted shadow-sm text-2xl">
          {value?.status === 'uploading' ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <UploadIcon className="size-6" />
          )}
        </div>
        <div className="flex items-center text-base">
          <span>点击</span>
          <span className="text-theme underline">上传</span>
          <span>或拖拽文件到此处</span>
        </div>
        <div className="text-sm text-muted">{acceptText}</div>
        {value && value.status !== 'uploading' ? (
          <div className="flex h-8 w-80 items-center justify-between gap-1 rounded-lg bg-[#d9d9d9] px-2">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <span className="truncate max-w-60">{value.name}</span>
              <span className="shrink-0">{formatFileSize(value.size)}</span>
            </div>
            <button
              type="button"
              className="shrink-0 p-1 hover:opacity-80"
              onClick={handleRemove}
              aria-label="移除"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
