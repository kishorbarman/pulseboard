import React, { useEffect, useRef } from 'react';

interface MeshGradientProps {
  color1?: string;
  color2?: string;
  color3?: string;
  className?: string;
}

export function MeshGradient({ 
  color1 = '#4f46e5', // indigo-600
  color2 = '#7c3aed', // violet-600
  color3 = '#09090b', // stone-950
  className = ''
}: MeshGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      if (!ctx || !canvas) return;
      
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.fillStyle = color3;
      ctx.fillRect(0, 0, width, height);

      // Create gradients
      const cx1 = width * 0.5 + Math.sin(t * 0.001) * width * 0.3;
      const cy1 = height * 0.5 + Math.cos(t * 0.0012) * height * 0.3;
      const r1 = Math.max(width, height) * 0.8;

      const cx2 = width * 0.5 + Math.cos(t * 0.0008) * width * 0.3;
      const cy2 = height * 0.5 + Math.sin(t * 0.0015) * height * 0.3;
      const r2 = Math.max(width, height) * 0.8;

      const grd1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, r1);
      grd1.addColorStop(0, `${color1}40`); // 25% opacity
      grd1.addColorStop(1, 'transparent');

      const grd2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
      grd2.addColorStop(0, `${color2}40`); // 25% opacity
      grd2.addColorStop(1, 'transparent');

      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grd1;
      ctx.fillRect(0, 0, width, height);
      
      ctx.fillStyle = grd2;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';

      t += 1;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [color1, color2, color3]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 w-full h-full pointer-events-none -z-10 ${className}`}
    />
  );
}
