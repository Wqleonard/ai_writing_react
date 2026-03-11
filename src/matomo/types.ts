export type MatomoEventSpec =
  | { category: 'Content'; action: 'Save'; name: 'Draft' }
  | { category: 'Content'; action: 'Export'; name: 'Article' }
  | {
      category: 'Story Creation'
      action: 'Click'
      name:
        | 'Quick New from Landing'
        | 'Common New from Landing'
        | 'Quick New from Sidebar'
        | 'Common New from Sidebar'
        | 'Quick New from Workspace'
        | 'Common New from Workspace'
        | 'Common New from Chat'
        | 'Script New from Landing'
        | 'Script New from Sidebar'
        | 'Script New from Workspace'
    }
  | { category: 'Drama Creation'; action: 'Click'; name: 'New' }
  | { category: 'AI Chat'; action: 'Generate'; name: 'Message Send' }
  | {
      category: 'AI Chat'
      action: 'Use'
      name: 'Template Prompt' | 'Hot Keyword' | 'Custom Prompt' | 'Close Answer' | 'Document'
    }
  | { category: 'Editor Tool'; action: 'Generate'; name: 'Rewrite' | 'Expand' | 'Picture' }
  | { category: 'Editor Tool'; action: 'Use'; name: 'Rewrite' | 'Expand' | 'Picture' | 'Add to Chat' }
  | {
      category: 'Guided Writing'
      action: 'Start'
      name:
        | 'Custom Write from Tool'
        | 'Template Write from Tool'
        | 'Tag Write from Tool'
        | 'Template Write from Popup'
        | 'Tag Write from Popup'
        | 'Custom Write from Edit'
        | 'Template Write from Edit'
        | 'Tag Write from Edit'
    }
  | {
      category: 'Guided Writing'
      action: 'Step'
      name: 'Mode' | 'Content' | 'Protagonist' | 'Story'
    }
  | { category: 'Guided Writing'; action: 'Complete'; name: 'End' }
  | {
      category: 'AI Tool'
      action: 'Click'
      name:
        | 'Guided Writing'
        | 'Outline'
        | 'Worldview'
        | 'Character'
        | 'Lead'
        | 'Chapter'
        | 'Book Analysis'
        | 'Style Analysis'
    }
  | {
      category: 'AI Tool'
      action: 'Generate'
      name: 'Outline' | 'Worldview' | 'Character' | 'Lead' | 'Chapter' | 'Book Analysis' | 'Style Analysis'
    }
  | {
      category: 'AI Tool'
      action: 'Use'
      name: 'Outline' | 'Worldview' | 'Character' | 'Lead' | 'Chapter' | 'Book Analysis' | 'Style Analysis'
    }
  | {
      category: 'Quick Creation'
      action: 'Generate'
      name: 'Brief' | 'Character' | 'Outline' | 'Detailed Outline' | 'Chapter'
    }
  | { category: 'Directory'; action: 'Add'; name: 'File' | 'Folder' }
  | { category: 'Community'; action: 'Click'; name: 'Share' | 'Prompt' }
  | { category: 'Community'; action: 'Create'; name: 'Share' | 'Prompt Workflow' }
  | { category: 'Community'; action: 'Use'; name: 'Prompt' }
  | { category: 'Dashboard'; action: 'Click'; name: 'Book Analysis' | 'Style Analysis' }
  | { category: 'Dashboard'; action: 'Generate'; name: 'Book Analysis' | 'Style Analysis' }
  | { category: 'Dashboard'; action: 'Use'; name: 'Book Analysis' | 'Style Analysis' }
  | { category: 'Template'; action: 'Apply'; name: string }
  | { category: 'Tag'; action: 'Apply'; name: `${string}:${string}` }
  | { category: 'Style'; action: 'Apply'; name: string }
  | { category: 'Hotword'; action: 'Apply'; name: `${string}:${string}` }
  | { category: 'Model'; action: 'Apply'; name: string }
  | { category: 'User Lifecycle'; action: 'Success'; name: 'Register' | 'Login' | 'Use Editor' }
  | { category: 'User Lifecycle'; action: 'Impression'; name: 'Scene' }
  | { category: 'Payment'; action: 'Click'; name: 'Plan'; value: number }
  | { category: 'Payment'; action: 'Success'; name: 'Plan'; value: number }

export type MatomoCategory = MatomoEventSpec['category']
export type TrackingEventAction = MatomoEventSpec['action']
export type MatomoEventName = MatomoEventSpec['name']

export type TrackEventArgs<E extends MatomoEventSpec> = E extends { value: number }
  ? [category: E['category'], action: E['action'], name: E['name'], value: number]
  : [category: E['category'], action: E['action'], name: E['name'], value?: number]
