import Card from './components/ui/Card'

const App = () => {
  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center gap-6 p-8">

      {/* Default card */}
      <Card className="w-full max-w-md">
        <h2 className="text-text-primary text-lg font-semibold">Default Card</h2>
        <p className="text-text-secondary text-sm mt-2">
          This is a default card with no hover effect.
        </p>
      </Card>

      {/* Hoverable card */}
      <Card hoverable className="w-full max-w-md">
        <h2 className="text-text-primary text-lg font-semibold">Hoverable Card</h2>
        <p className="text-text-secondary text-sm mt-2">
          Hover over me to see the effect.
        </p>
      </Card>

      {/* Clickable card */}
      <Card hoverable onClick={() => alert('Card clicked!')} className="w-full max-w-md">
        <h2 className="text-text-primary text-lg font-semibold">Clickable Card</h2>
        <p className="text-text-secondary text-sm mt-2">
          Click me to trigger an action.
        </p>
      </Card>

      {/* Small padding */}
      <Card padding="sm" className="w-full max-w-md">
        <p className="text-text-secondary text-sm">Small padding card</p>
      </Card>

      {/* Large padding */}
      <Card padding="lg" className="w-full max-w-md">
        <p className="text-text-secondary text-sm">Large padding card</p>
      </Card>

    </div>
  )
}

export default App