import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Loader2, Camera, X, Check, Mic, MicOff } from 'lucide-react';
import type { MessageImage, OutgoingMessagePayload } from '@/types';

interface ChatInputProps {
  onSend: (message: OutgoingMessagePayload) => void;
  isLoading: boolean;
}

interface RangeCapability {
  min: number;
  max: number;
  step?: number;
}

interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
  zoom?: RangeCapability;
  torch?: boolean | boolean[];
  focusMode?: string[];
  focusDistance?: RangeCapability;
}

interface ExtendedMediaTrackSettings extends MediaTrackSettings {
  zoom?: number;
  focusDistance?: number;
}

type FocusMode = 'manual' | 'continuous' | 'single-shot';
type ExtendedConstraintSet = MediaTrackConstraintSet & {
  zoom?: number;
  torch?: boolean;
  focusMode?: FocusMode;
  focusDistance?: number;
};

type ControllableVideoTrack = MediaStreamTrack & {
  getCapabilities?: () => ExtendedMediaTrackCapabilities;
  getSettings?: () => ExtendedMediaTrackSettings;
  applyConstraints: (constraints: MediaTrackConstraints) => Promise<void>;
};

// 声明 Web Speech API 类型
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [capturedImage, setCapturedImage] = useState<MessageImage | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<RangeCapability | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [focusRange, setFocusRange] = useState<RangeCapability | null>(null);
  const [focusDistance, setFocusDistance] = useState(0);
  const [singleShotFocusSupported, setSingleShotFocusSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const getVideoTrack = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    return track as ControllableVideoTrack | undefined;
  }, []);

  const resetCameraControls = useCallback(() => {
    setZoom(1);
    setZoomRange(null);
    setTorchSupported(false);
    setTorchEnabled(false);
    setFocusRange(null);
    setFocusDistance(0);
    setSingleShotFocusSupported(false);
  }, []);

  const handleSubmit = useCallback((textToSend?: string) => {
    const finalText = textToSend !== undefined ? textToSend : input;
    const trimmed = finalText.trim();
    if ((!trimmed && !capturedImage) || isLoading) return;
    onSend({
      content: trimmed,
      image: capturedImage || undefined,
    });
    setInput('');
    setInterimTranscript('');
    setCapturedImage(null);
    setShowPhotoPreview(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [capturedImage, input, isLoading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 200) + 'px';
  };

  // 语音输入：开启/关闭语音识别
  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      // 停止识别并自动发送
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } else {
      // 开始识别
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器');
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let finalTranscript = '';

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        if (final) {
          finalTranscript += final;
        }
        setInterimTranscript(interim);
        setInput(finalTranscript + interim);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('语音识别错误:', event.error);
        if (event.error === 'not-allowed') {
          alert('请允许使用麦克风权限');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        // 如果有识别内容，自动发送
        const fullText = finalTranscript.trim();
        if (fullText) {
          handleSubmit(fullText);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  }, [isListening, handleSubmit]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setShowCamera(false);
    resetCameraControls();
  }, [resetCameraControls]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const initializeCameraControls = useCallback(() => {
    const track = getVideoTrack();
    const capabilities = track?.getCapabilities?.();
    const settings = track?.getSettings?.();

    if (!capabilities) {
      resetCameraControls();
      return;
    }

    const zoomCapability = capabilities.zoom;
    if (zoomCapability && zoomCapability.max > zoomCapability.min) {
      setZoomRange({
        min: zoomCapability.min,
        max: zoomCapability.max,
        step: zoomCapability.step ?? 0.1,
      });
      setZoom(typeof settings?.zoom === 'number' ? settings.zoom : zoomCapability.min);
    } else {
      setZoom(1);
      setZoomRange(null);
    }

    const hasTorch = Array.isArray(capabilities.torch)
      ? capabilities.torch.includes(true)
      : Boolean(capabilities.torch);
    setTorchSupported(hasTorch);
    setTorchEnabled(false);

    const focusModes = capabilities.focusMode || [];
    const focusCapability = capabilities.focusDistance;
    const supportsManualFocus =
      focusModes.includes('manual') &&
      !!focusCapability &&
      focusCapability.max > focusCapability.min;

    if (supportsManualFocus && focusCapability) {
      setFocusRange({
        min: focusCapability.min,
        max: focusCapability.max,
        step: focusCapability.step ?? 1,
      });
      setFocusDistance(
        typeof settings?.focusDistance === 'number'
          ? settings.focusDistance
          : focusCapability.min
      );
    } else {
      setFocusRange(null);
      setFocusDistance(0);
    }

    setSingleShotFocusSupported(
      focusModes.includes('single-shot') || focusModes.includes('continuous')
    );
  }, [getVideoTrack, resetCameraControls]);

  // 启动相机
  const startCamera = async () => {
    setCameraError('');
    resetCameraControls();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setShowCamera(true);
      // 等待DOM更新后再设置video源
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        initializeCameraControls();
      }, 100);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('无法访问相机，请检查权限设置');
    }
  };

  const handleZoomChange = async (value: number) => {
    const track = getVideoTrack();
    if (!track || !zoomRange) return;

    setZoom(value);
    setCameraError('');

    try {
      await track.applyConstraints({
        advanced: [{ zoom: value } as ExtendedConstraintSet],
      });
    } catch (err) {
      console.error('Zoom error:', err);
      setCameraError('当前设备不支持变焦调节');
    }
  };

  const toggleTorch = async () => {
    const track = getVideoTrack();
    if (!track || !torchSupported) return;

    const nextTorchState = !torchEnabled;
    setCameraError('');

    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorchState } as ExtendedConstraintSet],
      });
      setTorchEnabled(nextTorchState);
    } catch (err) {
      console.error('Torch error:', err);
      setCameraError('当前设备不支持闪光灯控制');
    }
  };

  const handleFocusDistanceChange = async (value: number) => {
    const track = getVideoTrack();
    if (!track || !focusRange) return;

    setFocusDistance(value);
    setCameraError('');

    try {
      await track.applyConstraints({
        advanced: [
          {
            focusMode: 'manual',
            focusDistance: value,
          } as ExtendedConstraintSet,
        ],
      });
    } catch (err) {
      console.error('Focus error:', err);
      setCameraError('当前设备不支持手动对焦');
    }
  };

  const refocusCamera = async () => {
    const track = getVideoTrack();
    if (!track || !singleShotFocusSupported) return;

    setCameraError('');

    try {
      await track.applyConstraints({
        advanced: [
          {
            focusMode: 'single-shot',
          } as ExtendedConstraintSet,
        ],
      });
    } catch (err) {
      try {
        await track.applyConstraints({
          advanced: [
            {
              focusMode: 'continuous',
            } as ExtendedConstraintSet,
          ],
        });
      } catch (fallbackError) {
        console.error('Refocus error:', err, fallbackError);
        setCameraError('当前设备不支持重新对焦');
      }
    }
  };

  function resizeAndCompress(
    sourceCanvas: HTMLCanvasElement,
    maxWidth: number,
    quality: number
  ): string {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;

    if (width <= maxWidth) {
      return sourceCanvas.toDataURL('image/jpeg', quality);
    }

    const scale = maxWidth / width;
    const newWidth = maxWidth;
    const newHeight = Math.round(height * scale);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return sourceCanvas.toDataURL('image/jpeg', quality);

    ctx.drawImage(sourceCanvas, 0, 0, newWidth, newHeight);
    return tempCanvas.toDataURL('image/jpeg', quality);
  }

  // 拍照
  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const compressedData = resizeAndCompress(canvas, 1024, 0.8);
    setCapturedImage({
      dataUrl: compressedData,
      mimeType: 'image/jpeg',
    });
    setShowPhotoPreview(true);
    stopCamera();
  };

  // 取消拍照
  const cancelCamera = () => {
    stopCamera();
    setShowPhotoPreview(false);
  };

  // 确认使用照片
  const confirmPhoto = () => {
    if (capturedImage) {
      setShowPhotoPreview(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  // 删除已拍照片
  const removePhoto = () => {
    setCapturedImage(null);
    setShowPhotoPreview(false);
  };

  // 清理语音识别
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <>
      {/* 相机全屏界面 */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* 相机预览 */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => void refocusCamera()}
              disabled={!singleShotFocusSupported}
              className="absolute inset-0"
              aria-label="点按重新对焦"
            />
            <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-3 pointer-events-none">
              <div className="flex flex-col gap-3 pointer-events-auto">
                {zoomRange && (
                  <div className="bg-black/50 backdrop-blur-sm rounded-xl px-4 py-3 text-white min-w-[220px]">
                    <div className="flex items-center justify-between gap-3 text-xs mb-2">
                      <span>变焦</span>
                      <span>{zoom.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={zoomRange.min}
                      max={zoomRange.max}
                      step={zoomRange.step ?? 0.1}
                      value={zoom}
                      onChange={(e) => void handleZoomChange(Number(e.target.value))}
                      className="w-full accent-[#4a9eff]"
                    />
                  </div>
                )}

                {focusRange && (
                  <div className="bg-black/50 backdrop-blur-sm rounded-xl px-4 py-3 text-white min-w-[220px]">
                    <div className="flex items-center justify-between gap-3 text-xs mb-2">
                      <span>手动对焦</span>
                      <span>{focusDistance.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={focusRange.min}
                      max={focusRange.max}
                      step={focusRange.step ?? 1}
                      value={focusDistance}
                      onChange={(e) => void handleFocusDistanceChange(Number(e.target.value))}
                      className="w-full accent-[#4a9eff]"
                    />
                  </div>
                )}

                {singleShotFocusSupported && (
                  <div className="text-xs text-white/80 bg-black/40 rounded-lg px-3 py-2">
                    点按画面可重新对焦
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 pointer-events-auto">
                {torchSupported && (
                  <button
                    onClick={() => void toggleTorch()}
                    className={`px-4 py-2 rounded-xl text-sm transition-colors ${
                      torchEnabled
                        ? 'bg-[#4a9eff] text-white'
                        : 'bg-black/50 text-white hover:bg-black/60'
                    }`}
                  >
                    {torchEnabled ? '闪光灯开' : '闪光灯关'}
                  </button>
                )}

                {singleShotFocusSupported && (
                  <button
                    onClick={() => void refocusCamera()}
                    className="px-4 py-2 rounded-xl text-sm bg-black/50 text-white hover:bg-black/60 transition-colors"
                  >
                    重新对焦
                  </button>
                )}
              </div>
            </div>
            {/* 取景框提示 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white/50 rounded-lg">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white" />
              </div>
            </div>
          </div>

          {/* 底部控制栏 */}
          <div className="h-24 bg-black/90 flex items-center justify-around px-8">
            <button
              onClick={cancelCamera}
              className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X size={24} />
            </button>
            <button
              onClick={takePhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-white/30 hover:scale-105 transition-transform"
            />
            <div className="w-12" /> {/* 占位保持对称 */}
          </div>

          {/* 错误提示 */}
          {cameraError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm">
              {cameraError}
            </div>
          )}
        </div>
      )}

      {/* 照片预览界面 */}
      {capturedImage && showPhotoPreview && !showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={capturedImage.dataUrl}
              alt="拍摄的照片"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
          <div className="h-24 bg-black/90 flex items-center justify-around px-8">
            <button
              onClick={removePhoto}
              className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X size={24} />
            </button>
            <button
              onClick={confirmPhoto}
              className="p-3 rounded-full bg-[#4a9eff] text-white hover:bg-[#3a8eef] transition-colors"
            >
              <Check size={24} />
            </button>
          </div>
        </div>
      )}

      {/* 输入框区域 */}
      <div className="border-t border-[#222] bg-[#0f0f0f] p-4">
        <div className="max-w-3xl mx-auto relative">
          {/* 已拍照片缩略图 */}
          {capturedImage && !showCamera && !showPhotoPreview && (
            <div className="mb-2 flex items-center gap-2">
              <div className="relative inline-block">
                <img
                  src={capturedImage.dataUrl}
                  alt="已拍摄"
                  className="h-16 w-16 object-cover rounded-lg border border-[#333]"
                />
                <button
                  onClick={removePhoto}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-600"
                >
                  ×
                </button>
              </div>
              <span className="text-xs text-gray-400">已添加照片</span>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={isListening ? '正在听您说...' : '输入消息... (Enter 发送, Shift+Enter 换行)'}
            rows={1}
            className={`w-full bg-[#1a1a1a] text-[#e8e4d9] rounded-xl pl-4 pr-24 py-3 resize-none outline-none border transition-all placeholder:text-gray-500 max-h-[200px] ${
              isListening
                ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                : 'border-[#333] focus:border-[#4a9eff] focus:ring-1 focus:ring-[#4a9eff]/30'
            }`}
            disabled={isLoading}
          />

          {/* 语音输入按钮 */}
          <button
            onClick={toggleVoiceInput}
            disabled={isLoading}
            className={`absolute right-14 bottom-3 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isListening
                ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30'
                : 'bg-[#333] text-[#e8e4d9] hover:bg-[#444]'
            }`}
            title={isListening ? '停止录音并发送' : '语音输入'}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          {/* 相机按钮 */}
          <button
            onClick={startCamera}
            disabled={isLoading}
            className="absolute right-24 bottom-3 p-2 rounded-lg bg-[#333] text-[#e8e4d9] hover:bg-[#444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="拍照"
          >
            <Camera size={16} />
          </button>

          {/* 发送按钮 */}
          <button
            onClick={() => handleSubmit()}
            disabled={isLoading || (!input.trim() && !capturedImage)}
            className="absolute right-3 bottom-3 p-2 rounded-lg bg-[#4a9eff] text-white hover:bg-[#3a8eef] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* 隐藏的canvas用于拍照处理 */}
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
}
