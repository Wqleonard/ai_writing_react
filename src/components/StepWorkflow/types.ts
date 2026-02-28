export type Mode = "custom" | "template" | "tag"

export interface Template {
  id: string
  title: string
  description: string
  tags: { name: string; id: string; category: string }[]
  usageCount: number
}

export interface CharacterCardData {
  name: string
  gender: string
  age: string
  bloodType: string
  mbti: string
  experiences: string
  personality: string
  abilities: string
  identity: string
}

export interface StoryStorm {
  title: string
  intro: string
  theme: string
}

export interface Tag {
  id: string | number
  name: string
  category?: string
  categoryId?: string
  max?: number
}

export interface StepSaveData {
  mode: Mode | null
  template: Template | null
  tags: Tag[]
  character: CharacterCardData | null
  story: StoryStorm | null
  outline: string
  description: string
}
