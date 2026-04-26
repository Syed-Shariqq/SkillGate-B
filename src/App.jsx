import LoadingSpinner from './components/ui/LoadingSpinner'

const App = () => {
  return (
    <div className="min-h-screen bg-primary flex 
    flex-col items-center justify-center gap-8 p-8">

      {/* Sizes */}
      <div className="flex items-center gap-8">
        <LoadingSpinner size="sm" />
        <LoadingSpinner size="md" />
        <LoadingSpinner size="lg" />
      </div>

      {/* Colors */}
      <div className="flex items-center gap-8">
        <LoadingSpinner size="md" color="accent" />
        <LoadingSpinner size="md" color="white" />
        <LoadingSpinner size="md" color="success" />
      </div>

    </div>
  )
}

export default App