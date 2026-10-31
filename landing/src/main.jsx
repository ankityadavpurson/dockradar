import ReactDOM from 'react-dom/client'
import { ThemeProvider } from 'xedonium'
import 'xedonium/styles.css'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider storageKey="dockradar_theme" favicon={false}>
    <App />
  </ThemeProvider>
)
