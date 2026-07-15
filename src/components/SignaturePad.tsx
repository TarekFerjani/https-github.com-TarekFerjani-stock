import React, { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear?: () => void;
  height?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear, height = '300px' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
      }
    }
  }, []);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left),
      y: (clientY - rect.top)
    };
  };

  const startDrawing = (e: any) => {
    isDrawingRef.current = true;
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: any) => {
    if (!isDrawingRef.current) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      setIsDrawing(false);
      handleSave();
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      if (onClear) onClear();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preventDefault = (e: TouchEvent) => { if (isDrawingRef.current) e.preventDefault(); };
    canvas.addEventListener('touchmove', preventDefault, { passive: false });
    return () => canvas.removeEventListener('touchmove', preventDefault);
  }, []);

  return (
    <div className="space-y-2">
      <div 
        className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 overflow-hidden touch-none relative" 
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair absolute top-0 left-0"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={(e) => draw(e)}
          onTouchEnd={stopDrawing}
        />
      </div>
      <button
        type="button"
        onClick={clear}
        className="text-sm text-red-600 hover:text-red-800 font-medium"
      >
        Effacer la signature
      </button>
    </div>
  );
};

export default SignaturePad;
