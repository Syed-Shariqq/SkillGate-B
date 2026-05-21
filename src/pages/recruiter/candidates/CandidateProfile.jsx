import React from 'react'
import { useParams } from 'react-router-dom'

const CandidateProfile = () => {
  const { candidateId } = useParams()
  return (
    <div className="p-6 text-text-primary bg-secondary rounded-lg border border-border-default">
      <h1 className="text-xl font-bold mb-2">Candidate Profile</h1>
      <p className="text-text-secondary text-sm">Viewing profile for candidate ID: <span className="mono text-accent">{candidateId}</span></p>
    </div>
  )
}

export default CandidateProfile
