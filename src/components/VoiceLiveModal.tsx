import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, X, PhoneCall, PhoneOff, Radio, Sparkles } from 'lucide-react';

interface VoiceLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceLiveModal: React.FC<VoiceLiveModalProps> = ({ isOpen, onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [statusText, setStatusText] = useState('Ready to connect');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      disconnectSession();
    }
    return () => {
      disconnectSession();
    };
  }, [isOpen]);

  const connectSession = async () => {
    setStatusText('Requesting microphone & connecting to Live API (gemini-3.8-live)...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;

      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setStatusText('Connected to Gemini 3.8 Live. Speak into your microphone!');

        // Start processing mic input
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (e) => {
          if (isMuted || ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert float32 [-1, 1] to 16-bit PCM little endian
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
          ws.send(JSON.stringify({ audio: base64 }));
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.audio) {
            setIsSpeaking(true);
            playPcmChunk(outputCtx, msg.audio);
          }
          if (msg.interrupted) {
            audioQueueRef.current = [];
            setIsSpeaking(false);
          }
          if (msg.error) {
            setStatusText(`Error: ${msg.error}`);
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onerror = () => {
        setStatusText('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setStatusText('Live session disconnected');
      };
    } catch (err: any) {
      console.error(err);
      setStatusText(`Error: ${err.message || 'Microphone access failed'}`);
    }
  };

  const playPcmChunk = (ctx: AudioContext, base64Audio: string) => {
    try {
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 0x8000;
      }

      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setIsSpeaking(false);
      };
      source.start();
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  };

  const disconnectSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setIsSpeaking(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md rounded-xl border border-slate-700 bg-[#0F1420] p-6 shadow-2xl flex flex-col items-center text-center space-y-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title & Brand */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Radio className="h-5 w-5 text-cyan-400 animate-pulse" />
            <h2 className="text-base font-bold text-white">Live Voice Conversation</h2>
          </div>
          <div className="text-xs text-slate-400 font-mono">model: gemini-3.8-live (Live API)</div>
        </div>

        {/* Visual Pulse Orb */}
        <div className="relative flex items-center justify-center">
          <div
            className={`h-28 w-28 rounded-full flex items-center justify-center transition-all ${
              isConnected
                ? isSpeaking
                  ? 'bg-cyan-500/20 ring-8 ring-cyan-400/40 scale-110'
                  : 'bg-emerald-500/20 ring-4 ring-emerald-400/30'
                : 'bg-slate-800'
            }`}
          >
            <div
              className={`h-20 w-20 rounded-full flex items-center justify-center ${
                isConnected
                  ? isSpeaking
                    ? 'bg-cyan-500 text-slate-950 animate-bounce'
                    : 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {isSpeaking ? (
                <Volume2 className="h-10 w-10" />
              ) : (
                <Mic className="h-10 w-10" />
              )}
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="text-xs text-slate-300 font-medium max-w-xs">{statusText}</div>

        {/* Control Buttons */}
        <div className="flex items-center gap-4">
          {!isConnected ? (
            <button
              onClick={connectSession}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shadow-lg"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Start Voice Call</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-3 rounded-full border transition-colors ${
                  isMuted
                    ? 'bg-amber-600 border-amber-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              <button
                onClick={disconnectSession}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-lg"
              >
                <PhoneOff className="h-4 w-4" />
                <span>End Call</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
