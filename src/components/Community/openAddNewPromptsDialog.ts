import { openDialog } from '@/lib/openDialog'
import { AddNewPromptsDialog } from './AddNewPromptsDialog'

export const openAddNewPromptsDialog = (onSubmit?: () => void) =>
  openDialog(AddNewPromptsDialog, { onSubmit })
