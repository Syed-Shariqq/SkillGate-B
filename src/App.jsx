import toast from 'react-hot-toast'
import Button from './components/ui/Button'
import { Toaster } from 'react-hot-toast'

const App = () => {
  return (
    <div className="min-h-screen bg-primary flex 
    flex-col items-center justify-center gap-4 p-8">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#161B22',
            color: '#E6EDF3',
            border: '1px solid #2A323C',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
          },
          success: {
            iconTheme: {
              primary: '#238636',
              secondary: '#161B22',
            },
          },
          error: {
            iconTheme: {
              primary: '#DA3633',
              secondary: '#161B22',
            },
          },
        }}
      />

      <Button onClick={() => toast.success('Assessment submitted!')}>
        Success Toast
      </Button>
      <Button variant="danger" 
        onClick={() => toast.error('Something went wrong')}>
        Error Toast
      </Button>
      <Button variant="secondary" 
        onClick={() => toast('Processing your request...')}>
        Default Toast
      </Button>
    </div>
  )
}

export default App