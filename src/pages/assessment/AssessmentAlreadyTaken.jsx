import React from 'react'

const AssessmentAlreadyTaken = () => {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-secondary border border-border-default rounded-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-warning mb-4">Assessment Already Completed</h1>
        <p className="text-text-secondary text-sm">
          You have already completed and submitted this pre-screening assessment. The results have been shared with the recruiter.
        </p>
      </div>
    </div>
  )
}

export default AssessmentAlreadyTaken
