import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import {
  getPdfDownloadUrl,
  getPdfStatusLabel,
} from '../../services/assessment/resultService'

const STATUS_STYLES = {
  pending: 'border-warning/30 bg-warning/10 text-warning',
  generating: 'border-accent/30 bg-accent-soft text-accent',
  generated: 'border-success/30 bg-success/10 text-success',
  failed: 'border-error/30 bg-error/10 text-error',
}

const STATUS_DETAILS = {
  pending: 'Your report is being prepared. Check again in a moment.',
  generating: 'We are formatting your assessment report now. This usually finishes shortly.',
  generated: 'Your PDF report is ready to download.',
  failed: 'Report generation failed. Retrying shortly.',
}

const AssessmentResult = ({ resultId: resultIdProp, initialPdfStatus = 'pending' }) => {
  const { resultId: resultIdParam } = useParams()
  const [searchParams] = useSearchParams()
  const resultId = resultIdProp || resultIdParam || searchParams.get('resultId')
  const [pdfStatus, setPdfStatus] = useState(initialPdfStatus || 'pending')
  const [loadingDownload, setLoadingDownload] = useState(false)

  const statusLabel = useMemo(() => getPdfStatusLabel(pdfStatus), [pdfStatus])
  const statusClass = STATUS_STYLES[pdfStatus] || STATUS_STYLES.pending
  const statusDetail = STATUS_DETAILS[pdfStatus] || STATUS_DETAILS.pending
  const showSpinner = pdfStatus === 'generating'
  const buttonLabel = pdfStatus === 'generated' ? 'Download PDF Report' : 'Check Report Status'

  const handleDownload = async () => {
    setLoadingDownload(true)

    const { data, error } = await getPdfDownloadUrl(resultId)

    setLoadingDownload(false)

    if (error) {
      toast.error(error.message)
      return
    }

    const nextStatus = data?.status || 'pending'
    setPdfStatus(nextStatus)

    if (nextStatus !== 'generated') {
      toast(getPdfStatusLabel(nextStatus))
      return
    }

    if (!data?.signedUrl) {
      toast.error('Report download URL is unavailable')
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="min-h-screen bg-primary px-4 py-10 text-text-primary">
      <section className="mx-auto max-w-3xl rounded-lg border border-border-default bg-secondary p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mono mb-2 text-text-tertiary">Assessment Result</p>
            <h1 className="text-2xl font-semibold">Your SkillGate report</h1>
            <p className="mt-3 max-w-xl text-text-secondary">
              The assessment is complete. Your PDF report is generated in the background and the download link is created only when requested.
            </p>
          </div>

          <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${statusClass}`}>
            {showSpinner && <LoadingSpinner size="sm" />}
            <span>{statusLabel}</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            onClick={handleDownload}
            loading={loadingDownload}
            disabled={!resultId}
          >
            {buttonLabel}
          </Button>

          {!resultId && (
            <p className="text-sm text-error">
              Missing result ID. Use a valid result link to download the report.
            </p>
          )}

          {pdfStatus === 'failed' && (
            <p className="text-sm text-text-secondary">
              {statusDetail}
            </p>
          )}

          {pdfStatus !== 'failed' && resultId && (
            <p className="text-sm text-text-secondary">
              {statusDetail}
            </p>
          )}
        </div>
      </section>
    </main>
  )
}

export default AssessmentResult
