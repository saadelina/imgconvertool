
import { ProcessedFile } from '../types';
import pica from 'pica';

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const readFileAsDataURL = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file data."));
    reader.readAsDataURL(file);
  });
};

export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Only set crossOrigin for network URLs to avoid tainting issues with data URIs in some browsers
    if (!src.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image from source."));
    img.src = src;
  });
};

export interface WatermarkConfig {
  type: 'text' | 'image';
  text?: string;
  image?: HTMLImageElement;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  opacity: number; // 0-1
  rotation: number; // degrees
  scale: number; // 0.1 - 5
  color?: string;
  fontSize?: number; // relative base size
}

// Core Image Processing Function
export const processImage = async (
  file: File | Blob,
  options: {
    width?: number;
    height?: number;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number; // 0 to 1
    format?: string; // image/jpeg, image/png, image/webp
    watermark?: WatermarkConfig; // Updated from watermarkText
    crop?: { x: number; y: number; width: number; height: number };
  }
): Promise<Blob> => {
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas context');

  // Handle Crop first if it exists
  if (options.crop) {
    const { x, y, width, height } = options.crop;
    canvas.width = width;
    canvas.height = height;
    
    // Draw only the cropped portion
    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

  } else {
    // Handle Resizing or Default Dimensions
    let targetWidth = options.width || img.width;
    let targetHeight = options.height || img.height;

    // Smart Resize (Max Dimensions) - Only scale down
    if (options.maxWidth || options.maxHeight) {
        const ratio = img.width / img.height;
        
        if (options.maxWidth && targetWidth > options.maxWidth) {
            targetWidth = options.maxWidth;
            targetHeight = targetWidth / ratio;
        }
        
        if (options.maxHeight && targetHeight > options.maxHeight) {
            targetHeight = options.maxHeight;
            targetWidth = targetHeight * ratio;
        }
    } else {
        // Explicit Resize Logic
        if (options.width && !options.height) {
            targetHeight = (img.height / img.width) * options.width;
        } else if (!options.width && options.height) {
            targetWidth = (img.width / img.height) * options.height;
        }
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  }

  // Handle Watermark
  if (options.watermark) {
    const { type, text, image, x, y, opacity, rotation, scale, color } = options.watermark;
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.save();
    
    // Position (convert percentage to pixels)
    const posX = (x / 100) * w;
    const posY = (y / 100) * h;
    
    ctx.translate(posX, posY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.globalAlpha = opacity;

    if (type === 'text' && text) {
        // Text Watermark
        const baseFontSize = Math.min(w, h) * 0.05; // 5% of smallest dimension as base
        const finalFontSize = baseFontSize * scale * 5; // Scale multiplier matches UI feeling
        
        ctx.font = `bold ${finalFontSize}px sans-serif`;
        ctx.fillStyle = color || 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Shadow for better visibility
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillText(text, 0, 0);
        
        // Optional Stroke if white text
        if (color === '#ffffff' || color === 'white') {
           ctx.shadowColor = 'transparent';
           ctx.strokeStyle = 'rgba(0,0,0,0.3)';
           ctx.lineWidth = finalFontSize / 25;
           ctx.strokeText(text, 0, 0);
        }

    } else if (type === 'image' && image) {
        // Image Watermark
        // Standardize: Base width is 20% of canvas width
        const baseWidth = w * 0.2; 
        const aspect = image.width / image.height;
        
        // Apply user scale
        const drawWidth = baseWidth * scale; 
        const drawHeight = drawWidth / aspect;
        
        // Draw centered at origin (which is already translated to x,y)
        ctx.drawImage(image, -drawWidth/2, -drawHeight/2, drawWidth, drawHeight);
    }
    
    ctx.restore();
  }

  const mimeType = options.format || file.type;
  const quality = options.quality !== undefined ? options.quality : 0.9;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to Blob failed'));
      },
      mimeType,
      quality
    );
  });
};

export const generateHtmlSnippet = (file: ProcessedFile): string => {
  return `<img src="${file.url}" alt="${file.originalName}" style="max-width: 100%; height: auto;" />`;
};

// Helper to apply sharpening and simulated detail (grain)
const applyEnhancement = (canvas: HTMLCanvasElement, enhancementLevel: number) => {
    if (enhancementLevel <= 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
        const w = canvas.width;
        const h = canvas.height;
        // Skip if image is too massive to process in JS on main thread
        if (w * h > 25_000_000) return; 

        const imageData = ctx.getImageData(0, 0, w, h);
        const pixels = imageData.data;
        const mix = enhancementLevel; // 0 to 1

        // Sharpen Kernel (Unsharp Mask style)
        // Stronger center weight creates crisper edges
        const side = -1 * mix;
        const center = 1 + (4 * mix);
        const kernel = [
            0, side, 0,
            side, center, side,
            0, side, 0
        ];

        const output = ctx.createImageData(w, h);
        const dst = output.data;
        
        const weights = kernel;
        const sideLen = Math.round(Math.sqrt(weights.length));
        const halfSide = Math.floor(sideLen / 2);
        
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const dstOff = (y * w + x) * 4;
                
                let r = 0, g = 0, b = 0;
                
                // 1. Convolution (Sharpening)
                for (let cy = 0; cy < sideLen; cy++) {
                    for (let cx = 0; cx < sideLen; cx++) {
                        const scy = y + cy - halfSide;
                        const scx = x + cx - halfSide;
                        
                        if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
                            const srcOff = (scy * w + scx) * 4;
                            const wt = weights[cy * sideLen + cx];
                            r += pixels[srcOff] * wt;
                            g += pixels[srcOff + 1] * wt;
                            b += pixels[srcOff + 2] * wt;
                        }
                    }
                }

                // 2. Texture Synthesis (Simulated "fill in")
                // Add subtle random noise to break up "smooth" upscaled look
                // Only applied if enhancement is moderate to high (>0.3)
                if (enhancementLevel > 0.3) {
                    const noise = (Math.random() - 0.5) * (enhancementLevel * 15);
                    r += noise;
                    g += noise;
                    b += noise;
                }

                dst[dstOff] = Math.max(0, Math.min(255, r));
                dst[dstOff + 1] = Math.max(0, Math.min(255, g));
                dst[dstOff + 2] = Math.max(0, Math.min(255, b));
                dst[dstOff + 3] = pixels[dstOff + 3]; // Keep alpha
            }
        }
        ctx.putImageData(output, 0, 0);
    } catch (e) {
        console.warn("Enhancement skipped due to security or memory", e);
    }
};

// AI/Smart Upscaler using Iterative Pica and Texture Synthesis
export const smartUpscale = async (
  file: File | Blob,
  scaleFactor: number,
  enhancementLevel: number = 0.5
): Promise<Blob> => {
    // 1. Load source safely
    const imgBitmap = await createImageBitmap(file);
    const originalWidth = imgBitmap.width;
    const originalHeight = imgBitmap.height;

    // Create working canvas
    let canvas = document.createElement('canvas');
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    let ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) {
        imgBitmap.close();
        throw new Error("No context");
    }
    
    ctx.drawImage(imgBitmap, 0, 0);
    imgBitmap.close(); 

    const picaInstance = pica();

    // Helper: Resize Step
    const performResize = async (targetW: number, targetH: number) => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetW;
        tempCanvas.height = targetH;
        
        // Pica Lanczos3 Resize
        await picaInstance.resize(canvas, tempCanvas, {
            unsharpAmount: 0, // Manual sharpen is better controlled
            unsharpRadius: 0.5,
            unsharpThreshold: 0,
            quality: 3
        });
        
        // Swap canvases
        canvas = tempCanvas;
        ctx = canvas.getContext('2d', { willReadFrequently: true });
    };

    try {
        if (scaleFactor === 4) {
            // Iterative Upscale: 2x -> Enhance -> 2x -> Enhance
            // This preserves edges significantly better than jumping straight to 4x
            await performResize(Math.round(originalWidth * 2), Math.round(originalHeight * 2));
            applyEnhancement(canvas, enhancementLevel);
            
            await performResize(Math.round(originalWidth * 4), Math.round(originalHeight * 4));
            applyEnhancement(canvas, enhancementLevel * 0.8); // Slightly less sharpen on final pass
        } else {
            // Standard Upscale (e.g. 2x)
            await performResize(Math.round(originalWidth * scaleFactor), Math.round(originalHeight * scaleFactor));
            applyEnhancement(canvas, enhancementLevel);
        }
    } catch (err) {
        console.warn("Smart upscale failed, falling back to simple canvas scale", err);
        // Fallback
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = originalWidth * scaleFactor;
        fallbackCanvas.height = originalHeight * scaleFactor;
        const fbCtx = fallbackCanvas.getContext('2d');
        if (fbCtx) {
            fbCtx.drawImage(canvas, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
            canvas = fallbackCanvas;
        }
    }

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Upscaling failed'));
        }, 'image/png'); // Always PNG for lossless upscale
    });
};
