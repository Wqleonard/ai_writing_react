import type { NoteSourceType } from '@/api/notes'

export const NOTE_SOURCE_MAP: Record<string, string> = {
  MINI_APP_ADD: '小程序-手动添加',
  MINI_APP_CHAT: '小程序-对话',
  MINI_APP_INSPIRATION: '小程序-灵感',
  PC_ADD: 'PC端-手动添加',
  PC_NOVEL_DECONSTRUCT: 'PC端-拆书仿写',
  PC_CHAT_MODE: 'PC端-仅回答',
  PC_INSPIRATION_DRAW: 'PC端-灵感画布',
  PC_WORD_HIGHLIGHT: 'PC端-划词',
}

export const getNoteSourceDisplayName = (source: string | undefined): string => {
  if (!source) return ''
  return NOTE_SOURCE_MAP[source] ?? source
}
