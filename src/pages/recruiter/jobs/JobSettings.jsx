import React from 'react'
import { useParams } from 'react-router-dom'

const JobSettings = () => {
  const { jobId } = useParams()
  return (
    <div className="p-6 text-text-primary bg-secondary rounded-lg border border-border-default">
      <h1 className="text-xl font-bold mb-2">Job Settings</h1>
      <p className="text-text-secondary text-sm">Managing settings for job ID: <span className="mono text-accent">{jobId}</span></p>
    </div>
  )
}

export default JobSettings
