import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const AssessmentLanding = () => {
  const { token } = useParams()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-secondary border border-border-default rounded-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome to your Assessment</h1>
        <p className="text-text-secondary text-sm mb-6">
          This pre-screening session tests your core technical skills.
        </p>
        <button
          onClick={() => navigate(`/assess/${token}/test`)}
          className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors"
        >
          Start Assessment
        </button>
      </div>
    </div>
  )
}

export default AssessmentLanding
