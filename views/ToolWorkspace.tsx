
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, FileText, Download, X, Copy, Check, FileType, Image as ImageIcon, Scissors, Settings, Save, RefreshCw, ChevronRight, TrendingDown, SlidersHorizontal, Target, Stamp, Type, MousePointer2, CheckCircle, Clock, Loader2, AlertCircle, Lock, Unlock, ShieldCheck, Zap, Globe, Layers, Maximize2, Sparkles, Wand2 } from 'lucide-react';
import { ToolType, ToolConfig, ProcessedFile } from '../types';
import { Button, Card, Label, Input, Select, Badge, Tabs, Tab } from '../components/UI';
import { processImage, formatFileSize, generateHtmlSnippet, readFileAsDataURL, loadImage, smartUpscale } from '../utils/fileUtils';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { VisualCropper } from '../components/VisualCropper';
import { VisualWatermark } from '../components/VisualWatermark';
import imageCompression from 'browser-image-compression';
import html2canvas from 'html2canvas';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://aistudiocdn.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

interface ToolWorkspaceProps {
  tool: ToolConfig;
  onBack: () => void;
}

const MIME_TYPE_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/avif': 'avif',
  'image/tiff': 'tiff',
  'application/pdf': 'pdf',
  'text/html': 'html',
  'application/msword': 'doc',
  'image/svg+xml': 'svg',
  'text/plain': 'txt',
};

const FORMAT_CATEGORIES = {
  image: ['BMP', 'EPS', 'GIF', 'ICO', 'JPEG', 'JPG', 'ODD', 'PNG', 'PSD', 'SVG', 'TGA', 'TIFF', 'WebP'],
  document: ['DOC', 'DOCX', 'PDF', 'PS', 'TEXT', 'TXT', 'WORD']
};

const HOW_TO_STEPS: Record<string, { title: string; steps: string[] }> = {
    [ToolType.FormatConverter]: { title: 'How to convert images', steps: ['Upload your images', 'Select the output format', 'Download converted files'] },
    [ToolType.Compressor]: { title: 'How to compress images', steps: ['Upload images', 'Choose compression level or target size', 'Download optimized files'] },
    [ToolType.Resizer]: { title: 'How to resize images', steps: ['Upload photos', 'Enter new width/height or percentage', 'Download resized images'] },
    [ToolType.Watermark]: { title: 'How to add watermark', steps: ['Upload photo', 'Add text or logo and position it', 'Download protected image'] },
    [ToolType.Crop]: { title: 'How to crop images', steps: ['Upload image', 'Select area to keep', 'Download cropped image'] },
    [ToolType.JpgToPdf]: { title: 'How to convert JPG to PDF', steps: ['Upload JPG images', 'Arrange order if needed', 'Download combined PDF'] },
    [ToolType.PdfToJpg]: { title: 'How to convert PDF to Image', steps: ['Upload PDF document', 'Select output format (JPG/PNG)', 'Download pages as images'] },
    [ToolType.PdfToWord]: { title: 'How to convert PDF to Word', steps: ['Upload PDF', 'Choose conversion mode', 'Download Word document'] },
    [ToolType.ImageToHtml]: { title: 'How to convert Image to HTML', steps: ['Upload image', 'Generate HTML code', 'Download or Copy code'] },
    [ToolType.HtmlToImage]: { title: 'How to convert HTML to Image', steps: ['Upload HTML file or Paste code', 'Render preview', 'Download as Image'] },
    [ToolType.AiUpscaler]: { title: 'How to use AI Upscaler', steps: ['Upload low-res image', 'Select scale factor (2x, 4x)', 'Download enhanced image'] },
};

export const ToolWorkspace: React.FC<ToolWorkspaceProps> = ({ tool, onBack }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [fileStatus, setFileStatus] = useState<('pending' | 'processing' | 'completed' | 'error')[]>([]);

  // Settings State
  const [format, setFormat] = useState('JPG');
  const [quality, setQuality] = useState(0.8);
  const [width, setWidth] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [imgAspectRatio, setImgAspectRatio] = useState<number | null>(null);

  // Format Converter Categories
  const [activeCategory, setActiveCategory] = useState<'image' | 'document'>('image');

  // Compressor State
  const [compressMode, setCompressMode] = useState<'manual' | 'auto'>('auto');
  const [targetSizeMB, setTargetSizeMB] = useState<number>(1);
  const [compressFormat, setCompressFormat] = useState<string>('original');
  const [compressProgress, setCompressProgress] = useState<number>(0);
  const [resizeWidth, setResizeWidth] = useState<number | ''>('');
  const [resizeHeight, setResizeHeight] = useState<number | ''>('');

  // Crop State
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [cropAspectRatio, setCropAspectRatio] = useState<number | undefined>(undefined);

  // Watermark State
  const [wmType, setWmType] = useState<'text' | 'image'>('text');
  const [wmText, setWmText] = useState('Confidential');
  const [wmImage, setWmImage] = useState<HTMLImageElement | undefined>(undefined);
  const [wmOpacity, setWmOpacity] = useState(0.5);
  const [wmRotation, setWmRotation] = useState(0);
  const [wmScale, setWmScale] = useState(1);
  const [wmColor, setWmColor] = useState('#ffffff');
  const [wmPosition, setWmPosition] = useState({ x: 50, y: 50 });

  // PDF to Word State
  const [pdfWordMode, setPdfWordMode] = useState<'editable' | 'visual'>('editable');
  const [pdfPreserveFormatting, setPdfPreserveFormatting] = useState(true);

  // HTML to Image State
  const [htmlInputMode, setHtmlInputMode] = useState<'file' | 'text'>('file');
  const [htmlCode, setHtmlCode] = useState('');

  // AI Upscaler State
  const [upscaleFactor, setUpscaleFactor] = useState<number>(2);
  const [upscaleEnhance, setUpscaleEnhance] = useState<number>(0.5);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wmFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Aspect Ratio on file load
  useEffect(() => {
    if (files.length > 0 && tool.id === ToolType.Resizer) {
      const img = new Image();
      img.onload = () => {
        setImgAspectRatio(img.width / img.height);
        // Pre-fill dimensions
        if (width === '' && height === '') {
            setWidth(img.width);
            setHeight(img.height);
        }
      };
      img.src = URL.createObjectURL(files[0]);
    } else {
        setImgAspectRatio(null);
    }
  }, [files, tool.id]);

  useEffect(() => {
    // Reset output format default when tool changes
    if (tool.id === ToolType.PdfToJpg || tool.id === ToolType.HtmlToImage) {
        setFormat('JPG');
    }
  }, [tool.id]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...droppedFiles]);
      setFileStatus(prev => [...prev, ...droppedFiles.map(() => 'pending' as const)]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      setFileStatus(prev => [...prev, ...newFiles.map(() => 'pending' as const)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFileStatus(prev => prev.filter((_, i) => i !== index));
  };

  const handleWatermarkLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const img = new Image();
          img.onload = () => {
              setWmImage(img);
              setWmType('image');
          };
          img.src = URL.createObjectURL(file);
      }
      // Reset input
      if (wmFileInputRef.current) wmFileInputRef.current.value = '';
  };

  const handleWidthChange = (val: number | '') => {
      setWidth(val);
      if (maintainAspectRatio && imgAspectRatio && val !== '') {
          setHeight(Math.round(val / imgAspectRatio));
      }
  };

  const handleHeightChange = (val: number | '') => {
      setHeight(val);
      if (maintainAspectRatio && imgAspectRatio && val !== '') {
          setWidth(Math.round(val * imgAspectRatio));
      }
  };

  const extractTextFromPdf = async (pdfData: ArrayBuffer) => {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    let fullHtml = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Sort items by Y (desc) then X (asc) to approximate reading order
        const items = textContent.items.map((item: any) => ({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            h: item.height,
            fontName: item.fontName
        })).sort((a, b) => {
            if (Math.abs(a.y - b.y) > 5) return b.y - a.y; // Different lines
            return a.x - b.x; // Same line
        });

        let pageHtml = `<div style="page-break-after: always; margin-bottom: 2em;">`;
        let lastY = -1;

        items.forEach((item) => {
            // Simple new line detection
            if (lastY !== -1 && Math.abs(item.y - lastY) > 10) {
                pageHtml += '<br/>';
            }
            
            // Basic formatting detection
            let text = item.str;
            if (item.fontName.toLowerCase().includes('bold')) text = `<b>${text}</b>`;
            if (item.fontName.toLowerCase().includes('italic')) text = `<i>${text}</i>`;
            
            // Header detection by height
            if (item.h > 14) text = `<h2>${text}</h2>`;
            else if (item.h > 12) text = `<h3>${text}</h3>`;

            pageHtml += `${text} `;
            lastY = item.y;
        });
        
        pageHtml += '</div>';
        fullHtml += pageHtml;
    }
    return fullHtml;
  };

  const processFiles = async () => {
    setIsProcessing(true);
    setError(null);
    setProcessedFiles([]);
    setFileStatus(prev => prev.map(() => 'processing'));

    try {
      const results: ProcessedFile[] = [];

      // HTML Text Mode Special Handling
      if (tool.id === ToolType.HtmlToImage && htmlInputMode === 'text') {
         if (!htmlCode.trim()) throw new Error("Please enter HTML code");
         
         const container = document.createElement('div');
         container.style.position = 'absolute';
         container.style.left = '-9999px';
         container.style.width = '1200px';
         container.style.backgroundColor = 'white';
         container.innerHTML = htmlCode;
         document.body.appendChild(container);
         
         // Wait for resources
         await Promise.all(Array.from(container.querySelectorAll('img')).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
         }));
         
         // Wait for fonts
         await document.fonts.ready;
         
         // Slight delay for CSS layout
         await new Promise(r => setTimeout(r, 500));

         const canvas = await html2canvas(container, {
             useCORS: true,
             allowTaint: false,
             foreignObjectRendering: true,
             scale: 2,
             logging: false
         });
         
         document.body.removeChild(container);
         
         const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), `image/${MIME_TYPE_MAP[`image/${format.toLowerCase()}`] || 'jpeg'}`));
         results.push({
            id: 'html-code',
            originalName: 'code.html',
            name: `captured_code.${format.toLowerCase()}`,
            type: blob.type,
            url: URL.createObjectURL(blob),
            size: blob.size
         });
         
         // Skip file loop
      } else {
          // Standard File Loop
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setFileStatus(prev => { const n = [...prev]; n[i] = 'processing'; return n; });
            
            try {
                // --- COMPRESSOR ---
                if (tool.id === ToolType.Compressor) {
                    let outputBlob: Blob;
                    
                    const options = {
                        maxSizeMB: compressMode === 'auto' ? targetSizeMB : 50, // Manual mode essentially uncapped
                        maxWidthOrHeight: (resizeWidth || resizeHeight) ? Math.max(Number(resizeWidth) || 0, Number(resizeHeight) || 0) : undefined,
                        useWebWorker: true,
                        initialQuality: compressMode === 'manual' ? quality : undefined,
                        fileType: compressFormat !== 'original' ? `image/${compressFormat}` : undefined,
                        onProgress: (p: number) => setCompressProgress(p)
                    };
                    
                    outputBlob = await imageCompression(file, options);
                    
                    const ext = MIME_TYPE_MAP[outputBlob.type] || 'jpg';
                    results.push({
                        id: Math.random().toString(36).substr(2, 9),
                        originalName: file.name,
                        name: `${file.name.split('.')[0]}_compressed_${Date.now()}.${ext}`,
                        type: outputBlob.type,
                        url: URL.createObjectURL(outputBlob),
                        size: outputBlob.size,
                        originalSize: file.size
                    });
                } 
                // --- FORMAT CONVERTER ---
                else if (tool.id === ToolType.FormatConverter) {
                    const targetFormat = format.toLowerCase();
                    const mimeType = targetFormat === 'jpg' ? 'image/jpeg' : 
                                    targetFormat === 'png' ? 'image/png' :
                                    targetFormat === 'webp' ? 'image/webp' :
                                    targetFormat === 'gif' ? 'image/gif' :
                                    targetFormat === 'bmp' ? 'image/bmp' :
                                    `image/${targetFormat}`;
                    
                    let blob: Blob;

                    if (['psd', 'eps', 'tga', 'odd', 'ps'].includes(targetFormat)) {
                        throw new Error(`Browser conversion to ${targetFormat.toUpperCase()} is not supported directly. Try PNG or JPG.`);
                    }

                    if (targetFormat === 'ico') {
                        // Resize to 256x256 for Icon
                        blob = await processImage(file, { width: 256, height: 256, format: 'image/png' });
                    } else if (targetFormat === 'svg') {
                         // Wrap image in SVG
                         const dataUrl = await readFileAsDataURL(file);
                         const img = await loadImage(dataUrl);
                         const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${img.width}" height="${img.height}"><image href="${dataUrl}" width="100%" height="100%" /></svg>`;
                         blob = new Blob([svgContent], { type: 'image/svg+xml' });
                    } else if (['doc', 'docx', 'word'].includes(targetFormat)) {
                         // MHTML for Word with embedded image
                         const jpgBlob = await processImage(file, { format: 'image/jpeg' });
                         const base64Img = await readFileAsDataURL(jpgBlob);
                         const img = await loadImage(base64Img); // Get dims
                         
                         const mhtml = `MIME-Version: 1.0
Content-Type: multipart/related; boundary="--boundary-mhtml"; type="text/html"

----boundary-mhtml
Content-Type: text/html; charset="UTF-8"

<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><title>Image Doc</title></head>
<body>
<img src="cid:image_part" width="${img.width}" height="${img.height}" style="max-width: 100%;">
</body>
</html>

----boundary-mhtml
Content-ID: <image_part>
Content-Transfer-Encoding: base64
Content-Type: image/jpeg

${base64Img.split(',')[1]}
----boundary-mhtml--`;
                         blob = new Blob([mhtml], { type: 'application/msword' });
                    } else if (targetFormat === 'pdf') {
                         const imgBlob = await processImage(file, { format: 'image/jpeg' });
                         const imgData = await readFileAsDataURL(imgBlob);
                         const img = await loadImage(imgData);
                         const doc = new jsPDF({
                             orientation: img.width > img.height ? 'landscape' : 'portrait',
                             unit: 'px',
                             format: [img.width, img.height]
                         });
                         doc.addImage(imgData, 'JPEG', 0, 0, img.width, img.height);
                         blob = doc.output('blob');
                    } else if (['txt', 'text'].includes(targetFormat)) {
                         const b64 = await readFileAsDataURL(file);
                         blob = new Blob([b64], { type: 'text/plain' });
                    } else {
                         // Standard Image Conversion
                         blob = await processImage(file, { 
                             format: mimeType,
                             quality: quality 
                         });
                    }
                    
                    const actualExt = MIME_TYPE_MAP[blob.type] || targetFormat;
                    results.push({
                        id: Math.random().toString(36),
                        originalName: file.name,
                        name: `${file.name.split('.')[0]}.${actualExt}`,
                        type: blob.type,
                        url: URL.createObjectURL(blob),
                        size: blob.size
                    });
                }
                // --- PDF TO JPG ---
                else if (tool.id === ToolType.PdfToJpg) {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    
                    const outputFormat = format.toLowerCase(); // jpg, png, webp
                    const outputMime = `image/${outputFormat === 'jpg' ? 'jpeg' : outputFormat}`;
                    
                    for (let p = 1; p <= pdf.numPages; p++) {
                        const page = await pdf.getPage(p);
                        const viewport = page.getViewport({ scale: 2 }); // High quality
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        
                        // Render
                        if (context) {
                            const renderContext = {
                                canvasContext: context,
                                viewport: viewport
                            };
                            await page.render(renderContext as any).promise;
                            
                            const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), outputMime, 0.9));
                            results.push({
                                id: Math.random().toString(),
                                originalName: file.name,
                                name: `${file.name.split('.')[0]}_page${p}.${outputFormat}`,
                                type: blob.type,
                                url: URL.createObjectURL(blob),
                                size: blob.size
                            });
                        }
                    }
                }
                // --- PDF TO WORD ---
                else if (tool.id === ToolType.PdfToWord) {
                    const arrayBuffer = await file.arrayBuffer();
                    let blob: Blob;

                    if (pdfWordMode === 'visual') {
                        // Render pages as images and embed
                        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                        let mhtmlParts = '';
                        
                        for (let p = 1; p <= pdf.numPages; p++) {
                            const page = await pdf.getPage(p);
                            const viewport = page.getViewport({ scale: 1.5 });
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            canvas.width = viewport.width;
                            canvas.height = viewport.height;
                            if (ctx) {
                                await page.render({ canvasContext: ctx, viewport } as any).promise;
                                const imgData = canvas.toDataURL('image/jpeg', 0.8);
                                const contentId = `page_img_${p}`;
                                
                                mhtmlParts += `<img src="cid:${contentId}" width="100%" style="margin-bottom: 20px;"><br>`;
                                mhtmlParts += `----boundary-mhtml\nContent-ID: <${contentId}>\nContent-Transfer-Encoding: base64\nContent-Type: image/jpeg\n\n${imgData.split(',')[1]}\n----boundary-mhtml\n`;
                            }
                        }
                        
                        const mhtml = `MIME-Version: 1.0
Content-Type: multipart/related; boundary="--boundary-mhtml"; type="text/html"

----boundary-mhtml
Content-Type: text/html; charset="UTF-8"

<html><body>${mhtmlParts}</body></html>

----boundary-mhtml
${mhtmlParts}--`;
                        blob = new Blob([mhtml], { type: 'application/msword' });

                    } else {
                        // Editable Text Mode
                        const htmlContent = await extractTextFromPdf(arrayBuffer);
                        const docContent = `
                            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                            <head><meta charset='utf-8'><title>Converted PDF</title></head>
                            <body>${htmlContent}</body>
                            </html>`;
                        blob = new Blob([docContent], { type: 'application/msword' });
                    }
                    
                    results.push({
                        id: Math.random().toString(),
                        originalName: file.name,
                        name: `${file.name.split('.')[0]}.doc`,
                        type: 'application/msword',
                        url: URL.createObjectURL(blob),
                        size: blob.size
                    });
                }
                // --- IMAGE TO HTML ---
                else if (tool.id === ToolType.ImageToHtml) {
                    const base64 = await readFileAsDataURL(file);
                    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${file.name}</title></head>
<body style="margin:0; padding:20px; text-align:center; background:#f0f0f0;">
  <div style="max-width:1000px; margin:0 auto; background:white; padding:20px; box-shadow:0 0 10px rgba(0,0,0,0.1);">
     <img src="${base64}" alt="${file.name}" style="max-width:100%; height:auto;" />
  </div>
</body>
</html>`;
                    const blob = new Blob([htmlContent], { type: 'text/html' });
                    results.push({
                        id: Math.random().toString(),
                        originalName: file.name,
                        name: `${file.name.split('.')[0]}.html`,
                        type: 'text/html',
                        url: URL.createObjectURL(blob),
                        size: blob.size
                    });
                }
                // --- HTML TO IMAGE (FILE) ---
                else if (tool.id === ToolType.HtmlToImage) {
                    const text = await file.text();
                    const container = document.createElement('div');
                    container.style.position = 'absolute';
                    container.style.left = '-9999px';
                    container.style.width = '1200px';
                    container.style.backgroundColor = 'white';
                    container.innerHTML = text;
                    document.body.appendChild(container);

                    await Promise.all(Array.from(container.querySelectorAll('img')).map(img => {
                         if (img.complete) return Promise.resolve();
                         return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
                    }));
                    await document.fonts.ready;
                    await new Promise(r => setTimeout(r, 500));

                    const canvas = await html2canvas(container, {
                        useCORS: true,
                        allowTaint: false,
                        foreignObjectRendering: true,
                        scale: 2
                    });
                    document.body.removeChild(container);
                    
                    const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), `image/${MIME_TYPE_MAP[`image/${format.toLowerCase()}`] || 'jpeg'}`));
                    results.push({
                        id: Math.random().toString(),
                        originalName: file.name,
                        name: `${file.name.split('.')[0]}.${format.toLowerCase()}`,
                        type: blob.type,
                        url: URL.createObjectURL(blob),
                        size: blob.size
                    });
                }
                // --- AI UPSCALER ---
                else if (tool.id === ToolType.AiUpscaler) {
                     const blob = await smartUpscale(file, upscaleFactor, upscaleEnhance);
                     results.push({
                        id: Math.random().toString(),
                        originalName: file.name,
                        name: `${file.name.split('.')[0]}_upscaled_${upscaleFactor}x.png`,
                        type: 'image/png',
                        url: URL.createObjectURL(blob),
                        size: blob.size
                     });
                }
                // --- RESIZER / CROP / WATERMARK ---
                else {
                    const blob = await processImage(file, {
                        width: Number(width) || undefined,
                        height: Number(height) || undefined,
                        quality,
                        format: 'image/jpeg',
                        watermark: tool.id === ToolType.Watermark ? {
                            type: wmType,
                            text: wmText,
                            image: wmImage,
                            x: wmPosition.x,
                            y: wmPosition.y,
                            opacity: wmOpacity,
                            rotation: wmRotation,
                            scale: wmScale,
                            color: wmColor
                        } : undefined,
                        crop: tool.id === ToolType.Crop && crop ? crop : undefined
                    });
                    
                    results.push({
                        id: Math.random().toString(36),
                        originalName: file.name,
                        name: `${file.name.split('.')[0]}_processed.jpg`,
                        type: blob.type,
                        url: URL.createObjectURL(blob),
                        size: blob.size
                    });
                }
                
                setFileStatus(prev => { const n = [...prev]; n[i] = 'completed'; return n; });

            } catch (err: any) {
                console.error(err);
                setFileStatus(prev => { const n = [...prev]; n[i] = 'error'; return n; });
                // We don't throw here to allow other files to continue, but we could log it
            }
          }
      }

      setProcessedFiles(results);
      if (results.length === 0 && tool.id !== ToolType.JpgToPdf) {
          throw new Error("No files were successfully processed.");
      }

      // Handle JPG to PDF Combine (Requires all files)
      if (tool.id === ToolType.JpgToPdf && results.length > 0) {
          // Actually, results array currently stores the intermediate files or just ignored?
          // For JpgToPdf, we process all Inputs directly into one Output
          const pdf = new jsPDF();
          for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const dataUrl = await readFileAsDataURL(file);
              const img = await loadImage(dataUrl);
              const imgProps = pdf.getImageProperties(dataUrl);
              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
              
              if (i > 0) pdf.addPage();
              pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          }
          const pdfBlob = pdf.output('blob');
          setProcessedFiles([{
              id: 'combined-pdf',
              originalName: 'combined',
              name: 'images_combined.pdf',
              type: 'application/pdf',
              url: URL.createObjectURL(pdfBlob),
              size: pdfBlob.size
          }]);
      }

    } catch (err: any) {
      let message = "An unknown error occurred";
      if (err instanceof Error) message = err.message;
      else if (typeof err === 'string') message = err;
      else if (err && typeof err === 'object' && 'message' in err) message = String(err.message);
      
      if (message === '[object Object]') message = "Failed to process file. Please try a different format.";
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAll = () => {
    if (processedFiles.length === 1) {
      const link = document.createElement('a');
      link.href = processedFiles[0].url;
      link.download = processedFiles[0].name;
      link.click();
    } else {
      const zip = new JSZip();
      processedFiles.forEach(file => {
        zip.file(file.name, fetch(file.url).then(r => r.blob()));
      });
      zip.generateAsync({ type: 'blob' }).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'processed_files.zip';
        link.click();
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex items-center space-x-4 mb-8">
        <Button variant="ghost" onClick={onBack} size="sm" className="hidden sm:flex">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </Button>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
             {/* Icon Placeholder */}
             <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{tool.description}</h2>
            <p className="text-slate-500 text-sm hidden sm:block">Process your files securely in the browser</p>
          </div>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        
        {/* Drag Overlay */}
        {isDraggingOver && (
            <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-3xl flex items-center justify-center backdrop-blur-sm transition-all">
                <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center animate-bounce">
                    <Upload className="w-12 h-12 text-primary mb-4" />
                    <h3 className="text-xl font-bold text-primary">Drop files to upload</h3>
                </div>
            </div>
        )}

        {/* --- LEFT COLUMN: SETTINGS --- */}
        <div className="lg:col-span-5 space-y-6 order-2 lg:order-1" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            
            {/* HTML Input Tab */}
            {tool.id === ToolType.HtmlToImage && (
                <Card className="p-1">
                    <Tabs>
                        <Tab active={htmlInputMode === 'file'} onClick={() => setHtmlInputMode('file')}>Upload HTML File</Tab>
                        <Tab active={htmlInputMode === 'text'} onClick={() => setHtmlInputMode('text')}>Paste HTML Code</Tab>
                    </Tabs>
                </Card>
            )}

            {/* Editor Area for Visual Tools */}
            {(tool.id === ToolType.Crop || tool.id === ToolType.Watermark) && files.length > 0 && (
                <div className="bg-slate-100 rounded-2xl border border-slate-200 p-8 min-h-[500px] flex items-center justify-center shadow-inner relative overflow-hidden group">
                     {tool.id === ToolType.Crop ? (
                        <VisualCropper 
                            imageSrc={URL.createObjectURL(files[0])}
                            aspectRatio={cropAspectRatio}
                            onCropChange={setCrop}
                        />
                     ) : (
                        <VisualWatermark
                            imageSrc={URL.createObjectURL(files[0])}
                            config={{
                                type: wmType,
                                text: wmText,
                                imageSrc: wmImage ? wmImage.src : null,
                                x: wmPosition.x,
                                y: wmPosition.y,
                                opacity: wmOpacity,
                                rotation: wmRotation,
                                scale: wmScale,
                                color: wmColor
                            }}
                            onChange={(updates) => {
                                if (updates.x !== undefined || updates.y !== undefined) {
                                    setWmPosition(prev => ({ ...prev, ...updates }));
                                }
                            }}
                        />
                     )}
                </div>
            )}

            {/* HTML Code Editor */}
            {tool.id === ToolType.HtmlToImage && htmlInputMode === 'text' && (
                <div className="h-96">
                    <textarea 
                        className="w-full h-full p-4 font-mono text-sm bg-slate-900 text-slate-100 rounded-xl resize-none focus:ring-2 focus:ring-primary outline-none"
                        placeholder="<html><body><h1>Hello World</h1></body></html>"
                        value={htmlCode}
                        onChange={(e) => setHtmlCode(e.target.value)}
                    ></textarea>
                </div>
            )}

            {/* AI UPSCALER SETTINGS */}
            {tool.id === ToolType.AiUpscaler && (
                <Card className="space-y-6">
                    <div>
                        <Label className="mb-3">Upscale Factor</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div 
                                onClick={() => setUpscaleFactor(2)}
                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all text-center ${upscaleFactor === 2 ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                            >
                                <span className="block text-2xl font-bold mb-1">2x</span>
                                <span className="text-xs text-slate-500">Standard HD</span>
                            </div>
                            <div 
                                onClick={() => setUpscaleFactor(4)}
                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all text-center ${upscaleFactor === 4 ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                            >
                                <span className="block text-2xl font-bold mb-1">4x</span>
                                <span className="text-xs text-slate-500">Ultra HD</span>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <div className="flex justify-between items-center mb-2">
                             <Label>Smart Enhance</Label>
                             <Badge>{Math.round(upscaleEnhance * 100)}%</Badge>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.1" 
                            value={upscaleEnhance}
                            onChange={(e) => setUpscaleEnhance(parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                            Adjusts the sharpness and noise reduction level.
                        </p>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 flex items-start">
                        <Sparkles className="w-5 h-5 mr-2 shrink-0" />
                        <p>
                            <strong>AI Enhance:</strong> We use high-quality Lanczos interpolation combined with an unsharp masking algorithm to generate crisp, high-resolution details.
                        </p>
                    </div>
                </Card>
            )}

            {/* FORMAT CONVERTER SETTINGS */}
            {tool.id === ToolType.FormatConverter && (
              <Card className="min-h-[280px] flex flex-col">
                 <div className="mb-4">
                     <Label>Target Format</Label>
                 </div>
                 <div className="flex-1 flex gap-4 min-h-0">
                     {/* Categories */}
                     <div className="w-24 flex flex-col gap-1 border-r border-slate-100 pr-2">
                         {(Object.keys(FORMAT_CATEGORIES) as Array<keyof typeof FORMAT_CATEGORIES>).map(cat => (
                             <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-2 text-left text-sm font-medium rounded-lg flex items-center justify-between group ${activeCategory === cat ? 'bg-primary/5 text-primary' : 'text-slate-500 hover:bg-slate-50'}`}
                             >
                                 <span className="capitalize">{cat}</span>
                                 {activeCategory === cat && <ChevronRight className="w-3 h-3" />}
                             </button>
                         ))}
                     </div>
                     {/* Grid */}
                     <div className="flex-1 overflow-y-auto pr-1">
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                             {FORMAT_CATEGORIES[activeCategory].map(fmt => (
                                 <button
                                    key={fmt}
                                    onClick={() => setFormat(fmt)}
                                    className={`px-2 py-3 text-sm font-medium rounded-lg border transition-all ${format === fmt ? 'bg-primary text-white border-primary shadow-md transform scale-105' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/30 hover:bg-white'}`}
                                 >
                                     {fmt}
                                 </button>
                             ))}
                         </div>
                     </div>
                 </div>
              </Card>
            )}

            {/* COMPRESSOR SETTINGS */}
            {tool.id === ToolType.Compressor && (
              <div className="space-y-4">
                  {/* Mode Selection */}
                  <div className="grid grid-cols-2 gap-4">
                      <div 
                        onClick={() => setCompressMode('manual')}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${compressMode === 'manual' ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                      >
                          <div className="flex items-center space-x-2 mb-2">
                              <SlidersHorizontal className={`w-5 h-5 ${compressMode === 'manual' ? 'text-primary' : 'text-slate-400'}`} />
                              <span className={`font-bold ${compressMode === 'manual' ? 'text-slate-900' : 'text-slate-600'}`}>Manual Quality</span>
                          </div>
                          <p className="text-xs text-slate-500">Adjust compression level 0-100%</p>
                      </div>
                      <div 
                        onClick={() => setCompressMode('auto')}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${compressMode === 'auto' ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                      >
                          <div className="flex items-center space-x-2 mb-2">
                              <Target className={`w-5 h-5 ${compressMode === 'auto' ? 'text-primary' : 'text-slate-400'}`} />
                              <span className={`font-bold ${compressMode === 'auto' ? 'text-slate-900' : 'text-slate-600'}`}>Target Size</span>
                          </div>
                          <p className="text-xs text-slate-500">Compress to a specific file size</p>
                      </div>
                  </div>

                  <Card className="space-y-6">
                      {compressMode === 'manual' ? (
                          <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                  <Label>Quality Level</Label>
                                  <Badge>{Math.round(quality * 100)}%</Badge>
                              </div>
                              <input 
                                type="range" 
                                min="0.1" 
                                max="1" 
                                step="0.05" 
                                value={quality}
                                onChange={(e) => setQuality(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                              />
                              <div className="flex justify-between text-xs text-slate-400 font-medium">
                                  <span>Smallest File</span>
                                  <span>Balanced</span>
                                  <span>Best Quality</span>
                              </div>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <Label>Target File Size</Label>
                              <div className="flex items-center space-x-2 relative">
                                  <Input 
                                    type="number" 
                                    value={targetSizeMB}
                                    onChange={(e) => setTargetSizeMB(parseFloat(e.target.value))}
                                    step="0.1"
                                    min="0.1"
                                    className="pr-12"
                                  />
                                  <span className="absolute right-4 text-slate-500 font-medium text-sm top-3">MB</span>
                              </div>
                              <div className="flex gap-2">
                                  {[0.5, 1, 2, 5].map(size => (
                                      <button 
                                        key={size}
                                        onClick={() => setTargetSizeMB(size)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${targetSizeMB === size ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white'}`}
                                      >
                                          {size}MB
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}

                      <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
                          <div>
                              <Label className="text-xs uppercase text-slate-400">Output Format</Label>
                              <Select value={compressFormat} onChange={(e) => setCompressFormat(e.target.value)}>
                                  <option value="original">Same as Original</option>
                                  <option value="jpeg">JPEG</option>
                                  <option value="png">PNG</option>
                                  <option value="webp">WebP</option>
                              </Select>
                          </div>
                          <div>
                              <Label className="text-xs uppercase text-slate-400">Max Dimension (px)</Label>
                              <Input 
                                type="number" 
                                placeholder="Width (optional)" 
                                value={resizeWidth}
                                onChange={(e) => setResizeWidth(e.target.value ? Number(e.target.value) : '')}
                              />
                          </div>
                      </div>
                  </Card>
              </div>
            )}

            {/* WATERMARK SETTINGS */}
            {tool.id === ToolType.Watermark && (
                <Card className="space-y-6">
                    <Tabs>
                        <Tab active={wmType === 'text'} onClick={() => setWmType('text')}>Text Watermark</Tab>
                        <Tab active={wmType === 'image'} onClick={() => setWmType('image')}>Image Logo</Tab>
                    </Tabs>

                    {wmType === 'text' ? (
                        <div className="space-y-4">
                            <div>
                                <Label>Text Content</Label>
                                <Input value={wmText} onChange={(e) => setWmText(e.target.value)} placeholder="Enter text..." />
                            </div>
                            <div>
                                <Label>Color</Label>
                                <div className="flex items-center space-x-2">
                                    <input type="color" value={wmColor} onChange={(e) => setWmColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                                    <Input value={wmColor} onChange={(e) => setWmColor(e.target.value)} className="font-mono uppercase" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Label>Upload Logo</Label>
                            <input 
                                ref={wmFileInputRef}
                                type="file" 
                                accept="image/*" 
                                onChange={handleWatermarkLogoUpload}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                            />
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs">Opacity</Label>
                                <input type="range" min="0.1" max="1" step="0.1" value={wmOpacity} onChange={(e) => setWmOpacity(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary" />
                            </div>
                            <div>
                                <Label className="text-xs">Scale</Label>
                                <input type="range" min="0.5" max="3" step="0.1" value={wmScale} onChange={(e) => setWmScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <Label className="text-xs">Rotation</Label>
                                <input type="range" min="0" max="360" value={wmRotation} onChange={(e) => setWmRotation(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary" />
                             </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100/50">
                             <div>
                                <Label className="text-xs">Position X</Label>
                                <input type="range" min="0" max="100" value={wmPosition.x} onChange={(e) => setWmPosition(p => ({...p, x: Number(e.target.value)}))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary" />
                             </div>
                             <div>
                                <Label className="text-xs">Position Y</Label>
                                <input type="range" min="0" max="100" value={wmPosition.y} onChange={(e) => setWmPosition(p => ({...p, y: Number(e.target.value)}))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary" />
                             </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* RESIZER SETTINGS */}
            {tool.id === ToolType.Resizer && (
                <Card className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <Label>New Dimensions</Label>
                         <button 
                            onClick={() => setMaintainAspectRatio(!maintainAspectRatio)}
                            className={`flex items-center space-x-1 text-xs font-medium px-2 py-1 rounded transition-colors ${maintainAspectRatio ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}
                         >
                             {maintainAspectRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                             <span>AspectRatio</span>
                         </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Input type="number" placeholder="Width" value={width} onChange={(e) => handleWidthChange(e.target.value ? parseInt(e.target.value) : '')} />
                            <span className="text-xs text-slate-400 mt-1 block">Pixels</span>
                        </div>
                        <div>
                            <Input type="number" placeholder="Height" value={height} onChange={(e) => handleHeightChange(e.target.value ? parseInt(e.target.value) : '')} />
                            <span className="text-xs text-slate-400 mt-1 block">Pixels</span>
                        </div>
                    </div>
                    {maintainAspectRatio && imgAspectRatio && (
                        <div className="text-xs text-center text-primary bg-primary/5 py-2 rounded">
                            Ratio Locked: {imgAspectRatio.toFixed(2)}
                        </div>
                    )}
                </Card>
            )}

            {/* CROP SETTINGS */}
            {tool.id === ToolType.Crop && (
                <Card>
                    <Label className="mb-4">Aspect Ratio</Label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Free', val: undefined },
                            { label: '1:1', val: 1 },
                            { label: '16:9', val: 16/9 },
                            { label: '4:3', val: 4/3 },
                            { label: '3:2', val: 3/2 }
                        ].map((r) => (
                            <button
                                key={r.label}
                                onClick={() => setCropAspectRatio(r.val)}
                                className={`px-3 py-2 text-sm rounded-lg border transition-all ${cropAspectRatio === r.val ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    {crop && (
                        <div className="mt-6 p-4 bg-slate-50 rounded-lg text-xs space-y-2 border border-slate-100">
                             <div className="flex justify-between">
                                 <span className="text-slate-500">Dimensions</span>
                                 <span className="font-mono font-medium">{crop.width} x {crop.height} px</span>
                             </div>
                             <div className="flex justify-between">
                                 <span className="text-slate-500">Position</span>
                                 <span className="font-mono font-medium">{crop.x}, {crop.y}</span>
                             </div>
                        </div>
                    )}
                </Card>
            )}

            {/* PDF TO JPG / HTML TO IMAGE SETTINGS */}
            {(tool.id === ToolType.PdfToJpg || tool.id === ToolType.HtmlToImage) && (
                 <Card>
                    <Label>Output Format</Label>
                    <Select value={format} onChange={(e) => setFormat(e.target.value)}>
                        <option value="JPG">JPG (Best for Photos)</option>
                        <option value="PNG">PNG (Best for Text/Graphics)</option>
                        <option value="WEBP">WebP (Efficient)</option>
                    </Select>
                 </Card>
            )}

            {/* PDF TO WORD SETTINGS */}
            {tool.id === ToolType.PdfToWord && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div 
                          onClick={() => setPdfWordMode('editable')}
                          className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${pdfWordMode === 'editable' ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                        >
                            <Type className={`w-6 h-6 mb-2 ${pdfWordMode === 'editable' ? 'text-primary' : 'text-slate-400'}`} />
                            <span className="block font-bold text-sm mb-1">Editable Text</span>
                            <p className="text-xs text-slate-500">Best for documents. Extracts text to allow editing.</p>
                        </div>
                        <div 
                          onClick={() => setPdfWordMode('visual')}
                          className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${pdfWordMode === 'visual' ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                        >
                            <ImageIcon className={`w-6 h-6 mb-2 ${pdfWordMode === 'visual' ? 'text-primary' : 'text-slate-400'}`} />
                            <span className="block font-bold text-sm mb-1">Visual Layout</span>
                            <p className="text-xs text-slate-500">Best for complex layouts. Saves pages as images in Word.</p>
                        </div>
                    </div>
                    
                    {pdfWordMode === 'editable' && (
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-sm text-amber-800 flex items-start">
                            <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
                            <p>
                                <strong>Note:</strong> Editable mode is a "best-effort" extraction. Complex tables or columns may lose formatting. Use "Visual Layout" if maintaining the exact look is more important than editing text.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ACTION BUTTON */}
            {((files.length > 0 && htmlInputMode === 'file') || (htmlInputMode === 'text' && tool.id === ToolType.HtmlToImage)) && (
                <Button 
                    size="lg" 
                    onClick={processFiles} 
                    disabled={isProcessing} 
                    isLoading={isProcessing}
                    className="w-full text-lg shadow-lg shadow-primary/20"
                >
                    {isProcessing ? 
                         (tool.id === ToolType.Compressor ? `Compressing ${compressProgress}%` : 'Processing...') 
                         : 'Run Tool'
                    }
                </Button>
            )}

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-start animate-in fade-in">
                    <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
                    {error}
                </div>
            )}
        </div>

        {/* --- RIGHT COLUMN: FILES --- */}
        <div className="lg:col-span-7 space-y-6 order-1 lg:order-2">
            
            {/* Upload Area (Hidden for Text Mode) */}
            {(htmlInputMode === 'file') && (
                <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-300 ${isDraggingOver ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-slate-300 hover:border-primary hover:bg-slate-50'}`}
                >
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Upload className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Drop your files here</h3>
                    <p className="text-slate-500 mb-8 max-w-sm mx-auto">Support for JPG, PNG, PDF, WEBP and more. Max file size 50MB.</p>
                    <input 
                        type="file" 
                        id="file-upload" 
                        multiple 
                        className="hidden" 
                        onChange={handleFileSelect} 
                        accept={tool.accepts}
                        ref={fileInputRef}
                    />
                    <label htmlFor="file-upload">
                        <Button as="span" className="cursor-pointer px-8">Select Files</Button>
                    </label>
                </div>
            )}

            {/* File List */}
            {files.length > 0 && htmlInputMode === 'file' && (
                <Card>
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                        <h3 className="font-bold text-slate-900">Staged Files <Badge type="info">{files.length}</Badge></h3>
                        <Button variant="ghost" size="sm" onClick={() => { setFiles([]); setFileStatus([]); }} className="text-red-500 hover:text-red-600 hover:bg-red-50">Clear All</Button>
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                        {files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group hover:bg-slate-100 transition-colors">
                                <div className="flex items-center space-x-3 overflow-hidden">
                                    <div className="w-10 h-10 bg-white rounded flex items-center justify-center shrink-0 border border-slate-200">
                                        <FileText className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                                        <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                    {fileStatus[idx] === 'pending' && <Clock className="w-4 h-4 text-slate-400" />}
                                    {fileStatus[idx] === 'processing' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                                    {fileStatus[idx] === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                    {fileStatus[idx] === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                    
                                    <button onClick={() => removeFile(idx)} className="p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30" disabled={isProcessing}>
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Results */}
            {processedFiles.length > 0 && (
                <Card className="border-green-200 bg-green-50/50">
                    <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center text-green-700">
                             <Check className="w-5 h-5 mr-2" />
                             <span className="font-bold">Successfully processed {processedFiles.length} files</span>
                         </div>
                         <Button onClick={downloadAll} className="bg-green-600 hover:bg-green-700 text-white border-transparent">
                             <Download className="w-4 h-4 mr-2" /> Download All
                         </Button>
                    </div>
                    <div className="space-y-3">
                        {processedFiles.map((file) => (
                            <div key={file.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-green-100 shadow-sm">
                                <div className="flex items-center space-x-4 min-w-0">
                                    {file.type.startsWith('image/') ? (
                                        <img src={file.url} alt="" className="w-12 h-12 object-cover rounded-lg bg-slate-100" />
                                    ) : (
                                        <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-900 truncate max-w-[200px]">{file.name}</p>
                                        <div className="flex items-center space-x-2 text-xs text-slate-500">
                                            <span>{formatFileSize(file.size)}</span>
                                            {/* Compression Savings Badge */}
                                            {file.originalSize && file.originalSize > file.size && (
                                                <span className="text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">
                                                    Saved {Math.round(((file.originalSize - file.size) / file.originalSize) * 100)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <a 
                                        href={file.url} 
                                        download={file.name}
                                        className="p-2 text-slate-400 hover:text-primary bg-slate-50 hover:bg-primary/5 rounded-lg transition-colors"
                                    >
                                        <Download className="w-5 h-5" />
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>

      </div>
      
      {/* How to Use Section */}
      <div className="mt-20 border-t border-slate-200 pt-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">{HOW_TO_STEPS[tool.id]?.title || 'How to use this tool'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {HOW_TO_STEPS[tool.id]?.steps.map((step, i) => (
                  <div key={i} className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-xl mb-4">
                          {i + 1}
                      </div>
                      <p className="text-lg font-medium text-slate-700">{step}</p>
                  </div>
              ))}
          </div>
      </div>

      {/* SEO Content Section */}
      <div className="mt-20 bg-slate-50 rounded-3xl p-8 sm:p-12 border border-slate-200">
         <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center space-x-3 mb-6">
                <ShieldCheck className="w-8 h-8 text-green-600" />
                <h3 className="text-2xl font-bold text-slate-900">Secure Client-Side Processing</h3>
            </div>
            
            <div className="prose prose-slate max-w-none text-slate-600">
               {tool.id === ToolType.JpgToPdf ? (
                 <>
                   <h2>Combine JPG Images into PDF</h2>
                   <p>Easily combine multiple JPG images into a single PDF file to catalog and share with others. No limit in file size, no registration, no watermark. This service automatically rotates, optimizes and scales down images, keeping the original resolution.</p>
                   <h3>Why convert JPG to PDF?</h3>
                   <p>JPGs are great for images, but PDFs are better for documents and sharing collections. Converting multiple JPGs to one PDF is perfect for photographers, designers, and anyone needing to share a portfolio or scanned documents in a single file.</p>
                 </>
               ) : tool.id === ToolType.Compressor ? (
                 <>
                   <h2>Advanced Image Compressor</h2>
                   <p>Reduce file size by up to 90% without losing visible quality. Our intelligent compression algorithm balances file size and image clarity. Perfect for web optimization (SEO), email attachments, and saving disk space.</p>
                   <h3>Supported Formats</h3>
                   <p>We support compression for JPG, PNG, and WebP files. You can choose between "Manual Quality" for fine-grained control or "Target Size" to fit specific requirements (e.g., under 1MB).</p>
                 </>
               ) : tool.id === ToolType.FormatConverter ? (
                 <>
                    <h2>Universal Image Converter</h2>
                    <p>Convert your images to any modern format. Support for JPG, PNG, WebP, AVIF, PDF, and legacy formats like BMP and TIFF. Our batch converter processes multiple files instantly in your browser.</p>
                    <p>Whether you need to convert <strong>HEIC to JPG</strong> for compatibility or <strong>PNG to WebP</strong> for web performance, our tool handles it all securely.</p>
                 </>
               ) : tool.id === ToolType.HtmlToImage ? (
                  <>
                    <h2>Convert HTML to High-Quality Image</h2>
                    <p>Render complex HTML code or files into shareable JPG or PNG images. Our tool supports modern CSS, embedded fonts, and external images.</p>
                    <p>Ideal for creating screenshots of code snippets, email templates, or website components without needing browser extensions.</p>
                  </>
               ) : tool.id === ToolType.AiUpscaler ? (
                   <>
                     <h2>Free Online AI Image Upscaler</h2>
                     <p>Enhance the quality of your images with our smart upscaling technology. Increase image resolution by 2x or 4x while preserving details.</p>
                     <h3>How does it work?</h3>
                     <p>We use advanced <strong>Smart Sharpening</strong> and high-quality <strong>Lanczos Interpolation</strong> to simulate AI enhancement directly in your browser. This removes noise and sharpens edges without uploading your photos to a cloud server.</p>
                   </>
               ) : (
                 <>
                   <h2>Professional {tool.description} Tool</h2>
                   <p>Use our free online <strong>{tool.description}</strong> to process your images quickly and securely. Unlike other services, we process your files locally on your device using advanced WebAssembly technology.</p>
                   <ul>
                       <li><strong>No Server Uploads:</strong> Your photos never leave your computer.</li>
                       <li><strong>Unlimited Use:</strong> Process as many files as you want for free.</li>
                       <li><strong>High Quality:</strong> We use professional-grade algorithms for resizing, cropping, and converting.</li>
                   </ul>
                 </>
               )}
            </div>
         </div>
      </div>

    </div>
  );
};
