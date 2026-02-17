import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.tsx'
import "./i18n";

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <App />
  </HashRouter>,
)
