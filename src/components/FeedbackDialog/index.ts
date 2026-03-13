import { openDialog } from '@/lib/openDialog'
import { FeedbackDialog } from './FeedbackDialog'

export { FeedbackDialog }

export const openFeedbackDialog = () => openDialog(FeedbackDialog)
