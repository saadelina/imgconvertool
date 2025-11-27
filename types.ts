
export enum ToolType {
  FormatConverter = 'Format Converter',
  Compressor = 'Image Compressor',
  Resizer = 'Image Resizer',
  Watermark = 'Watermark Maker',
  Crop = 'Crop Image',
  JpgToPdf = 'JPG to PDF',
  PdfToJpg = 'PDF to JPG',
  PdfToWord = 'PDF to Word',
  ImageToHtml = 'Image to HTML',
  HtmlToImage = 'HTML to Image',
  AiUpscaler = 'AI Image Upscaler',
}

export interface ProcessedFile {
  id: string;
  originalName: string;
  name: string;
  type: string;
  url: string; // Blob URL or Data URL
  size: number;
  originalSize?: number;
  preview?: string;
}

export interface ToolConfig {
  id: ToolType;
  description: string;
  icon: string; // Icon name
  accepts: string; // File input accept string
}
