import EmptyState from './components/ui/EmptyState'

const App = () => {
  return (
    <div className="min-h-screen bg-primary flex 
    flex-col items-center justify-center gap-12 p-8">

      {/* With CTA */}
      <EmptyState
        title="No jobs posted yet"
        subtitle="Post your first job to start screening candidates with AI."
        ctaLabel="Post a Job"
        onCtaClick={() => alert('Post job clicked')}
      />

      {/* Without CTA */}
      <EmptyState
        title="No candidates yet"
        subtitle="Share your assessment link to start receiving applications."
      />

    </div>
  )
}

export default App