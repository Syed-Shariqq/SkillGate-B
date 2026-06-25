import { useEffect, useRef, useState } from 'react'

export const useAssessmentTimer = ({ startedAt, timeLimitMinutes, onExpire, onWarning }) => {
  const onExpireRef = useRef(onExpire)
  const onWarningRef = useRef(onWarning)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    onWarningRef.current = onWarning
  }, [onWarning])

  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
    return Math.max(0, Math.floor((timeLimitMinutes * 60) - elapsed))
  })

  const [isExpired, setIsExpired] = useState(() => {
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
    return ((timeLimitMinutes * 60) - elapsed) <= 0
  })

  const [prevStartedAt, setPrevStartedAt] = useState(startedAt)
  const [prevTimeLimit, setPrevTimeLimit] = useState(timeLimitMinutes)

  if (startedAt !== prevStartedAt || timeLimitMinutes !== prevTimeLimit) {
    setPrevStartedAt(startedAt)
    setPrevTimeLimit(timeLimitMinutes)
    // eslint-disable-next-line react-hooks/purity
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
    const newRemaining = Math.max(0, Math.floor((timeLimitMinutes * 60) - elapsed))
    setSecondsRemaining(newRemaining)
    setIsExpired(newRemaining <= 0)
  }

  const warningFiredRef = useRef(false)
  const expireFiredRef = useRef(false)

  useEffect(() => {
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
    const initialSeconds = (timeLimitMinutes * 60) - elapsed

    if (initialSeconds <= 0) {
      if (!expireFiredRef.current) {
        expireFiredRef.current = true
        onExpireRef.current?.()
      }
      return
    }

    warningFiredRef.current = initialSeconds <= 300
    expireFiredRef.current = false

    const intervalId = setInterval(() => {
      setSecondsRemaining((prev) => {
        const nextSeconds = Math.max(0, prev - 1)

        if (nextSeconds <= 300 && nextSeconds > 0) {
          if (!warningFiredRef.current) {
            warningFiredRef.current = true
            onWarningRef.current?.()
          }
        }

        if (nextSeconds <= 0) {
          setIsExpired(true)
          if (!expireFiredRef.current) {
            expireFiredRef.current = true
            onExpireRef.current?.()
          }
          clearInterval(intervalId)
        }

        return nextSeconds
      })
    }, 1000)

    return () => {
      clearInterval(intervalId)
    }
  }, [startedAt, timeLimitMinutes])

  const formatTime = (secs) => {
    const hrs = Math.floor(secs / 3600)
    const mins = Math.floor((secs % 3600) / 60)
    const remainingSecs = Math.floor(secs % 60)

    const pad = (num) => String(num).padStart(2, '0')

    if (timeLimitMinutes >= 60) {
      return `${pad(hrs)}:${pad(mins)}:${pad(remainingSecs)}`
    }
    return `${pad(mins)}:${pad(remainingSecs)}`
  }

  let urgency = 'normal'
  if (secondsRemaining <= 60) {
    urgency = 'critical'
  } else if (secondsRemaining <= 300) {
    urgency = 'warning'
  }

  return {
    secondsRemaining,
    formatted: formatTime(secondsRemaining),
    urgency,
    isExpired,
  }
}
