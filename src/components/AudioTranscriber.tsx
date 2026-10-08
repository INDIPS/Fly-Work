import React, { useState, useRef } from 'react';
import { Mic, MicOff, Upload, Copy, Check, FileAudio, RefreshCw, Volume2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export const AudioTranscriber: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    setErrorMsg('');
    setRecordingDuration(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        clearInterval(timerRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        await processAudioBlob(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Microphone access denied or not available. You can also upload an audio file below.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudioBlob = async (blob: Blob) => {
    setTranscribing(true);
    setErrorMsg('');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;

        const res = await fetch('/api/gemini/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioData: base64Audio,
            mimeType: blob.type || 'audio/webm',
          }),
        });

        const data = await res.json();
        if (data.success && data.text) {
          setTranscript(data.text);

          // Save to Firestore if authenticated
          const currentUser = auth.currentUser;
          if (currentUser) {
            try {
              const transCol = collection(db, 'users', currentUser.uid, 'transcriptions');
              await addDoc(transCol, {
                userId: currentUser.uid,
                transcript: data.text,
                durationSeconds: recordingDuration,
                model: 'gemini-3.5-transcribe',
                createdAt: new Date().toISOString(),
              });
            } catch (_err) {
              // Graceful local handling
            }
          }
        } else {
          setErrorMsg(data.error || 'Transcription failed.');
        }
        setTranscribing(false);
      };
    } catch (err: any) {
      setErrorMsg(err.message);
      setTranscribing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAudioBlob(file);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-[#111827]/90 p-5 shadow-xl backdrop-blur-md space-y-5">
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Audio Transcription (gemini-3.5-transcribe)</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Record microphone voice memos, technical meeting logs, or network incident reports and transcribe them directly.
          </p>
        </div>
      </div>

      {/* Recording Console */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mic Controls */}
        <div className="rounded-lg border border-slate-800 bg-[#0E131F] p-5 flex flex-col items-center justify-center text-center space-y-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={transcribing}
            className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 ring-2 ring-cyan-500/20'
            }`}
          >
            {isRecording ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
          </button>

          <div>
            <div className="text-sm font-semibold text-slate-200">
              {isRecording ? `Recording... (${recordingDuration}s)` : 'Click to Record Microphone'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {isRecording ? 'Click again to stop and transcribe' : 'Speech input transcribed using gemini-3.5-transcribe'}
            </div>
          </div>

          {/* Or File Upload */}
          <div className="pt-2 w-full border-t border-slate-800/80 flex items-center justify-center">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              <Upload className="h-3.5 w-3.5" />
              <span>Or upload audio file (.mp3, .wav, .webm)</span>
              <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Live Status & Transcript Result */}
        <div className="rounded-lg border border-slate-800 bg-[#0A0E17] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300 font-mono">Transcription Output</span>
              {transcript && (
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>
              )}
            </div>

            <div className="mt-3 min-h-[140px] text-xs leading-relaxed text-slate-200 font-sans whitespace-pre-wrap">
              {transcribing ? (
                <div className="flex items-center gap-2 text-cyan-400 italic py-6">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing audio with gemini-3.5-transcribe...</span>
                </div>
              ) : transcript ? (
                transcript
              ) : (
                <span className="text-slate-500 italic">
                  Transcription text will appear here once audio is captured and processed.
                </span>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="mt-2 text-xs text-rose-400 bg-rose-950/30 border border-rose-900 p-2 rounded">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
