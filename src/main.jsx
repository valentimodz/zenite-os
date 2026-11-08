// Capturador de erros para ajudar na depuração visual caso a aplicação quebre
function renderSafeErrorOverlay(titleText, messageText, stackText) {
  const root = document.getElementById('root');
  if (!root) return;
  root.replaceChildren();

  const container = document.createElement('div');
  container.style.cssText = 'background: #150505; color: #ff5555; padding: 24px; border: 1px solid #551111; font-family: monospace; border-radius: 8px; margin: 20px; max-width: 800px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);';

  const heading = document.createElement('h3');
  heading.style.cssText = 'margin-top: 0; color: #ff3333; font-size: 18px; border-bottom: 1px solid #551111; padding-bottom: 8px;';
  heading.textContent = titleText;

  const message = document.createElement('p');
  message.style.cssText = 'font-weight: bold; font-size: 14px;';
  message.textContent = String(messageText || 'Erro desconhecido');

  const pre = document.createElement('pre');
  pre.style.cssText = 'background: #080202; padding: 12px; border: 1px solid #220505; border-radius: 4px; overflow-x: auto; font-size: 12px; color: #cc8888; line-height: 1.5;';
  pre.textContent = String(stackText || 'Nenhum stacktrace disponível');

  container.appendChild(heading);
  container.appendChild(message);
  container.appendChild(pre);
  root.appendChild(container);
}

window.addEventListener('error', (event) => {
  renderSafeErrorOverlay(
    'Erro de Execução no Zênite:',
    event.message,
    event.error ? event.error.stack : 'Nenhum stacktrace disponível'
  );
});

window.addEventListener('unhandledrejection', (event) => {
  renderSafeErrorOverlay(
    'Erro de Promessa Rejeitada no Zênite:',
    event.reason ? event.reason.message || event.reason : 'Rejeição desconhecida',
    event.reason && event.reason.stack ? event.reason.stack : 'Nenhum stacktrace disponível'
  );
});

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutos de cache padrão
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)


