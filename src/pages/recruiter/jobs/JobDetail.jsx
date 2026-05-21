import React from 'react'
import { useParams } from 'react-router-dom'

const JobDetail = () => {
  const { jobId } = useParams()
  return (
    <div className="p-6 text-text-primary bg-secondary rounded-lg border border-border-default">
      <h1 className="text-xl font-bold mb-2">Job Details</h1>
      <p className="text-text-secondary text-sm">Viewing details for job ID: <span className="mono text-accent">{jobId}</span></p>
    </div>
  )
}

export default JobDetail
