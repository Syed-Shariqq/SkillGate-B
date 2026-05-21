import React from 'react'

const AssessmentExpired = () => {

   return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-secondary border border-border-default rounded-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-error mb-4">Assessment Expired</h1>
        <p className="text-text-secondary text-sm">
          This pre-screening link has expired. Please contact the hiring manager or recruiter to request a new assessment link.
        </p>
      </div>
    </div>
  )
}

export default AssessmentExpired
