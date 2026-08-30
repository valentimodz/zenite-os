// Capturador de erros para ajudar na depuração visual caso a aplicação quebre
window.addEventListener('error', (event) => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="background: #150505; color: #ff5555; padding: 24px; border: 1px solid #551111; font-family: monospace; border-radius: 8px; margin: 20px; max-width: 800px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <h3 style="margin-top: 0; color: #ff3333; font-size: 18px; border-b: 1px solid #551111; padding-bottom: 8px;">Erro de Execução no Zênite:</h3>
        <p style="font-weight: bold; font-size: 14px;">${event.message}</p>
        <pre style="background: #080202; padding: 12px; border: 1px solid #220505; border-radius: 4px; overflow-x: auto; font-size: 12px; color: #cc8888; line-height: 1.5;">${event.error ? event.error.stack : 'Nenhum stacktrace disponível'}</pre>
      </div>
    `;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="background: #150505; color: #ff5555; padding: 24px; border: 1px solid #551111; font-family: monospace; border-radius: 8px; margin: 20px; max-width: 800px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <h3 style="margin-top: 0; color: #ff3333; font-size: 18px; border-b: 1px solid #551111; padding-bottom: 8px;">Erro de Promessa Rejeitada no Zênite:</h3>
        <p style="font-weight: bold; font-size: 14px;">${event.reason ? event.reason.message || event.reason : 'Rejeição desconhecida'}</p>
        <pre style="background: #080202; padding: 12px; border: 1px solid #220505; border-radius: 4px; overflow-x: auto; font-size: 12px; color: #cc8888; line-height: 1.5;">${event.reason && event.reason.stack ? event.reason.stack : 'Nenhum stacktrace disponível'}</pre>
      </div>
    `;
  }
});

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)

