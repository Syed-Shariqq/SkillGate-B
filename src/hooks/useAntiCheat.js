import { useEffect, useRef, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { recordPasteAttempt, recordTabSwitch } from '@/services/assessment/responseService'

export const useAntiCheat = ({ assessmentId, enabled = true }) => {
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const [isFlagged, setIsFlagged] = useState(false)
  const countRef = useRef(0)
  const wasHiddenRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true
      } else if (document.visibilityState === 'visible') {
        if (wasHiddenRef.current) {
          wasHiddenRef.current = false
          countRef.current += 1
          const newCount = countRef.current

          setTabSwitchCount(newCount)
          if (newCount >= 3) {
            setIsFlagged(true)
          }

          setTimeout(() => {
            recordTabSwitch(assessmentId, newCount)
          }, 0)

          if (newCount === 1) {
            toast("Tab switching is being monitored for assessment integrity.", {
              icon: '👁',
              duration: 5000,
            })
          } else if (newCount === 2) {
            toast.error(
              "Warning: Tab switching has been recorded. Further switches may flag your submission.",
              { duration: 6000 }
            )
          } else if (newCount >= 3) {
            toast.error(
              "Your submission has been flagged due to multiple tab switches.",
              { duration: 8000 }
            )
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, assessmentId])

  const handlePaste = useCallback(
    (e) => {
      if (!enabled) return
      e.preventDefault()
      setTimeout(() => {
        recordPasteAttempt(assessmentId)
      }, 0)
      toast.error("Pasting is not allowed during the assessment.", {
        duration: 4000,
      })
    },
    [enabled, assessmentId]
  )

  const handleCopy = useCallback(
    (e) => {
      if (!enabled) return
      e.preventDefault()
    },
    [enabled]
  )

  const handleCut = useCallback(
    (e) => {
      if (!enabled) return
      e.preventDefault()
    },
    [enabled]
  )

  return {
    tabSwitchCount,
    isFlagged,
    handlePaste,
    disablePaste: {
      onPaste: handlePaste,
      onCopy: handleCopy,
      onCut: handleCut,
    },
  }
}
