import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, RefreshCw, Zap } from 'lucide-react';

export default function CameraScanner({ isOpen, onClose, onScan }) {
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef(null);
  const elementId = "html5-camera-reader";

  // Tocar som de Bip nativo ao ler código
  const playBeepSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1040, ctx.currentTime); // Tom agudo de leitor PDV (1040Hz)
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn("Aviso: Falha ao emitir bipe sonoro:", e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setIsInitializing(true);

    const html5Qrcode = new Html5Qrcode(elementId);
    scannerRef.current = html5Qrcode;

    const config = {
      fps: 10,
      qrbox: { width: 260, height: 140 },
      aspectRatio: 1.0
    };

    html5Qrcode.start(
      { facingMode: "environment" }, // Forçar câmera traseira
      config,
      (decodedText) => {
        playBeepSound();
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().then(() => {
            onScan(decodedText);
            onClose();
          }).catch(() => {
            onScan(decodedText);
            onClose();
          });
        } else {
          onScan(decodedText);
          onClose();
        }
      },
      () => {
        // Ignorar erros normais de quadros onde nenhum código foi detectado
      }
    )
    .then(() => {
      setIsInitializing(false);
    })
    .catch((err) => {
      console.error("Erro ao iniciar scanner da câmera:", err);
      setIsInitializing(false);
      setError("Acesso à câmera negado ou indisponível. Verifique se concedeu permissão ao navegador.");
    });

    return () => {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(err => console.warn("Erro ao parar leitor na saída:", err));
        }
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().then(() => {
        onClose();
      }).catch(() => {
        onClose();
      });
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between items-center p-4 animate-fadeIn">
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2 text-white">
          <div className="p-2 bg-[#6A0DAD]/20 border border-[#6A0DAD]/40 rounded-lg text-purple-400">
            <Camera size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold tracking-tight">Leitor de Câmera Mobile</h3>
            <p className="text-[10px] text-neutral-400">Aponte para o código de barras ou IMEI</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors"
          title="Fechar Câmera"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Scanner Container */}
      <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center my-4 relative">
        {error ? (
          <div className="bg-red-950/50 border border-red-500/50 p-6 rounded-2xl text-center space-y-3 max-w-xs">
            <AlertCircle className="mx-auto text-red-400" size={36} />
            <h4 className="text-xs font-bold text-red-300 uppercase tracking-wider">Permissão Negada</h4>
            <p className="text-xs text-neutral-300 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-bold transition-all"
            >
              Voltar ao Carrinho
            </button>
          </div>
        ) : (
          <div className="relative w-full overflow-hidden rounded-2xl border border-purple-900/40 shadow-2xl bg-black flex flex-col items-center justify-center">
            {isInitializing && (
              <div className="absolute inset-0 z-10 bg-black/80 flex flex-col items-center justify-center gap-2 text-neutral-400">
                <RefreshCw size={24} className="animate-spin text-purple-500" />
                <span className="text-xs font-medium">Iniciando câmera traseira...</span>
              </div>
            )}
            
            {/* Div Alvo da Biblioteca html5-qrcode */}
            <div id={elementId} className="w-full text-white min-h-[300px]" />
          </div>
        )}
      </div>

      {/* Footer Dicas */}
      <div className="w-full max-w-md text-center py-2 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-950/40 border border-purple-800/40 rounded-full text-[11px] text-purple-300">
          <Zap size={12} className="text-amber-300 fill-amber-300 animate-pulse" />
          <span>Posicione o código dentro do retângulo central</span>
        </div>
        <p className="text-[10px] text-neutral-500">
          O código será lido e adicionado automaticamente ao carrinho
        </p>
      </div>
    </div>
  );
}
