import { supabase } from '../../config/supabase'

const PDF_STATUS_LABELS = {
  pending: 'Your report is being prepared',
  generating: 'Your report is being prepared',
  generated: 'Your report is ready',
  failed: 'Report generation failed. Retrying shortly.',
}

export const getPdfStatusLabel = (status) => (
  PDF_STATUS_LABELS[status] || PDF_STATUS_LABELS.pending
)

export const getPdfDownloadUrl = async (resultId) => {
  if (!resultId) {
    return {
      data: null,
      error: { message: 'resultId is required' },
    }
  }

  const { data, error } = await supabase.functions.invoke('get-pdf-url', {
    body: { resultId },
  })

  if (error) {
    return {
      data: null,
      error: {
        message: error.message || 'Unable to fetch report download URL',
      },
    }
  }

  return { data, error: null }
}
