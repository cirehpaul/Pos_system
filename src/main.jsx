import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/variables.css'
import './styles/global.css'
import './styles/animations.css'
import { ToastProvider } from './components/Toast/Toast'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
)
