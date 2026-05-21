import React from 'react'

const AssessmentSubmitted = () => {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-secondary border border-border-default rounded-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-success mb-4">Assessment Submitted</h1>
        <p className="text-text-secondary text-sm">
          Thank you! Your responses have been submitted successfully. The recruiting team will evaluate your performance and contact you shortly.
        </p>
      </div>
    </div>
  )
}

export default AssessmentSubmitted
