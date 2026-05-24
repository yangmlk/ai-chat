import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Loader2, Camera, X, Check } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

interface ZoomCapability {
  min: number;
  max: number;
  step?: number;
}

interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
  zoom?: ZoomCapability;
  torch?: boolean | boolean[];
}

type ControllableVideoTrack = MediaStreamTrack & {
  getCapabilities?: () => ExtendedMediaTrackCapabilities;
  applyConstraints: (constraints: MediaTrackConstraints) => Promise<void>;
};

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<ZoomCapability | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
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
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
    setCapturedImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isLoading, onSend]);

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
  }, [getVideoTrack, resetCameraControls]);

  // 启动相机
  const startCamera = async () => {
    setCameraError('');
    resetCameraControls();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
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
        advanced: [{ zoom: value }] as MediaTrackConstraintSet[],
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
        advanced: [{ torch: nextTorchState }] as MediaTrackConstraintSet[],
      });
      setTorchEnabled(nextTorchState);
    } catch (err) {
      console.error('Torch error:', err);
      setCameraError('当前设备不支持闪光灯控制');
    }
  };

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

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    stopCamera();
  };

  // 取消拍照
  const cancelCamera = () => {
    stopCamera();
    setCapturedImage(null);
  };

  // 确认使用照片
  const confirmPhoto = () => {
    if (capturedImage) {
      // 将图片添加到输入框（以markdown图片格式）
      const imageMarkdown = `![拍照图片](${capturedImage})\n`;
      setInput(prev => prev + imageMarkdown);
      setCapturedImage(null);
      // 聚焦输入框
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  // 删除已拍照片
  const removePhoto = () => {
    setCapturedImage(null);
  };

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
            <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-3">
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
      {capturedImage && !showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={capturedImage}
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
          {capturedImage && !showCamera && (
            <div className="mb-2 flex items-center gap-2">
              <div className="relative inline-block">
                <img
                  src={capturedImage}
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
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            rows={1}
            className="w-full bg-[#1a1a1a] text-[#e8e4d9] rounded-xl pl-4 pr-24 py-3 resize-none outline-none border border-[#333] focus:border-[#4a9eff] focus:ring-1 focus:ring-[#4a9eff]/30 transition-all placeholder:text-gray-500 max-h-[200px]"
            disabled={isLoading}
          />

          {/* 相机按钮 */}
          <button
            onClick={startCamera}
            disabled={isLoading}
            className="absolute right-14 bottom-3 p-2 rounded-lg bg-[#333] text-[#e8e4d9] hover:bg-[#444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="拍照"
          >
            <Camera size={16} />
          </button>

          {/* 发送按钮 */}
          <button
            onClick={handleSubmit}
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
