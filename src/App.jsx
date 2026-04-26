import Modal from './components/ui/Modal'
import Button from './components/ui/Button'
import { useState } from 'react'

const App = () => {
  const [open, setOpen] = useState(false)
  const [size, setSize] = useState('md')

  return (
    <div className="min-h-screen bg-primary flex 
    flex-col items-center justify-center gap-4 p-8">

      <div className="flex gap-3">
        <Button onClick={() => { setSize('sm'); setOpen(true) }}>
          Small Modal
        </Button>
        <Button onClick={() => { setSize('md'); setOpen(true) }}>
          Medium Modal
        </Button>
        <Button onClick={() => { setSize('lg'); setOpen(true) }}>
          Large Modal
        </Button>
      </div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Test Modal"
        size={size}
      >
        <p className="text-text-secondary text-sm">
          This is the modal content. Click outside 
          or press Escape to close.
        </p>
        <div className="mt-6 flex gap-3 justify-end">
          <Button variant="ghost" 
            onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" 
            onClick={() => setOpen(false)}>
            Confirm
          </Button>
        </div>
      </Modal>

    </div>
  )
}

export default App