import ErrorBoundary from './components/ui/ErrorBoundary'

// This component will throw an error
const BrokenComponent = () => {
  throw new Error('Test error')
  return <div>Never renders</div>
}

const App = () => {
  return (
    <ErrorBoundary>
      <BrokenComponent />
    </ErrorBoundary>
  )
}

export default App