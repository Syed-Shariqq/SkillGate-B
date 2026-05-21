import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const AssessmentPage = () => {
  const { token } = useParams()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-secondary border border-border-default rounded-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Assessment Session</h1>
        <p className="text-text-secondary text-sm mb-6">
          You are currently in the active assessment environment.
        </p>
        <button
          onClick={() => navigate(`/assess/${token}/submitted`)}
          className="w-full py-2.5 px-4 bg-success hover:bg-success/80 text-white font-medium rounded-lg transition-colors"
        >
          Submit Test
        </button>
      </div>
    </div>
  )
}

export default AssessmentPage
