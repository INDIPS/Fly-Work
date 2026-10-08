import React, { useState } from 'react';
import { Film, Upload, Play, RefreshCw, AlertCircle, Sparkles, Check, Download } from 'lucide-react';

export const VeoVideoAnimator: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/png');
  const [prompt, setPrompt] = useState('Cinematic smooth camera fly-through showing network data packet streams across server rack lights');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [generating, setGenerating] = useState(false);
  const [operationName, setOperationName] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageMime(file.type || 'image/png');
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setVideoUrl(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage) return;
    setGenerating(true);
    setErrorMsg('');
    setStatusMsg('Submitting image to Veo (veo-3.1-fast-generate-preview)...');

    try {
      const res = await fetch('/api/gemini/video-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImage,
          mimeType: imageMime,
          prompt,
          aspectRatio,
        }),
      });

      const data = await res.json();
      if (data.success && data.operationName) {
        setOperationName(data.operationName);
        setStatusMsg('Video generation in progress. Polling operation status...');
        pollOperation(data.operationName);
      } else {
        // If paid key was declined or limit reached, provide interactive fallback
        setErrorMsg(
          data.error ||
            'Veo video generation requires paid API key credentials. You can view the animation simulation below.'
        );
        setGenerating(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Generation request failed');
      setGenerating(false);
    }
  };

  const pollOperation = async (opName: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/gemini/video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName: opName }),
        });
        const data = await res.json();
        if (data.success && data.done) {
          clearInterval(interval);
          setGenerating(false);
          if (data.videoUri) {
            setVideoUrl(data.videoUri);
            setStatusMsg('Video successfully generated!');
          }
        }
      } catch {
        clearInterval(interval);
        setGenerating(false);
      }
    }, 5000);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-[#111827]/90 p-5 shadow-xl backdrop-blur-md space-y-5">
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">
              Animate Images into Video (veo-3.1-fast-generate-preview)
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Upload any network diagram, server rack photo, or hotspot device image and generate cinematic video using Veo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left Config Panel (5 cols) */}
        <div className="md:col-span-5 space-y-4">
          {/* Upload Box */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Source Image</label>
            <div className="relative rounded-lg border-2 border-dashed border-slate-700 bg-slate-900/60 p-4 text-center hover:border-cyan-500 transition-colors">
              {selectedImage ? (
                <div className="space-y-2">
                  <img
                    src={selectedImage}
                    alt="Upload Preview"
                    className="max-h-40 mx-auto rounded border border-slate-700 object-contain"
                  />
                  <label className="cursor-pointer text-[11px] text-cyan-400 hover:underline block">
                    Choose different photo
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer block space-y-2 py-4">
                  <Upload className="mx-auto h-8 w-8 text-slate-500" />
                  <div className="text-xs text-slate-300 font-medium">Click to upload photo</div>
                  <div className="text-[10px] text-slate-500">PNG, JPG, WebP supported</div>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Aspect Ratio Selector (16:9 landscape or 9:16 portrait) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Aspect Ratio (veo-3.1-fast-generate-preview)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                className={`py-2 px-3 rounded border text-xs font-medium transition-colors ${
                  aspectRatio === '16:9'
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                16:9 Landscape
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                className={`py-2 px-3 rounded border text-xs font-medium transition-colors ${
                  aspectRatio === '9:16'
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                9:16 Portrait
              </button>
            </div>
          </div>

          {/* Prompt Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Motion Prompt</label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe camera movement, lighting, or animation..."
              className="w-full rounded border border-slate-700 bg-slate-900/90 p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !selectedImage}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Generating Veo Video...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Generate Video with Veo</span>
              </>
            )}
          </button>
        </div>

        {/* Right Output Viewport (7 cols) */}
        <div className="md:col-span-7 rounded-lg border border-slate-800 bg-[#0A0E17] p-4 flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300 font-mono">
                Veo Video Viewport ({aspectRatio})
              </span>
              <span className="text-[11px] font-mono text-slate-500">model: veo-3.1-fast-generate-preview</span>
            </div>

            <div className="mt-4 flex items-center justify-center">
              {videoUrl ? (
                <video
                  controls
                  autoPlay
                  loop
                  src={videoUrl}
                  className={`rounded border border-slate-800 max-h-[380px] ${
                    aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'
                  }`}
                />
              ) : selectedImage && generating ? (
                <div className="relative rounded overflow-hidden max-h-[320px]">
                  <img
                    src={selectedImage}
                    alt="Animating"
                    className="opacity-60 scale-105 animate-pulse transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent flex items-end p-4">
                    <div className="text-xs text-cyan-300 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{statusMsg || 'Rendering Veo frames...'}</span>
                    </div>
                  </div>
                </div>
              ) : selectedImage ? (
                <div className="relative rounded overflow-hidden max-h-[320px] text-center">
                  <img src={selectedImage} alt="Ready" className="rounded border border-slate-800 max-h-64 mx-auto" />
                  <div className="text-xs text-slate-400 mt-2">Ready to generate. Click "Generate Video with Veo".</div>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-600 space-y-2">
                  <Film className="h-10 w-10 mx-auto" />
                  <div className="text-xs">Upload an image on the left to start generating video</div>
                </div>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="mt-3 flex items-start gap-2 rounded bg-amber-950/40 border border-amber-800/60 p-2.5 text-xs text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
