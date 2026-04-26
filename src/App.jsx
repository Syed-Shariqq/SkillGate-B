import Badge from './components/ui/Badge'

const App = () => {
  return (
    <div className="min-h-screen bg-primary flex 
    items-center justify-center gap-4 flex-wrap p-8">
      <Badge variant="success">Passed</Badge>
      <Badge variant="error">Failed</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="info">In Progress</Badge>
      <Badge variant="default">Default</Badge>
    </div>
  )
}

export default App