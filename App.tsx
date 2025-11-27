
import React, { useState } from 'react';
import { 
  FileType, 
  Minimize2, 
  Maximize2, 
  Stamp, 
  Crop, 
  FilePlus, 
  FileImage, 
  FileText, 
  Code, 
  Image as ImageIcon,
  ShieldCheck,
  Code2,
  LayoutGrid,
  BookOpen,
  Menu,
  X,
  Zap,
  CheckCircle2,
  Globe,
  Sparkles
} from 'lucide-react';
import { ToolType, ToolConfig } from './types';
import { Card } from './components/UI';
import { ToolWorkspace } from './views/ToolWorkspace';
import { AboutView } from './views/AboutView';
import { PrivacyView } from './views/PrivacyView';
import { TermsView } from './views/TermsView';
import { ContactView } from './views/ContactView';
import { DocsView } from './views/DocsView';
import { Footer } from './components/Footer';

const TOOLS: ToolConfig[] = [
  { id: ToolType.AiUpscaler, description: 'AI Image Upscaler', icon: 'Sparkles', accepts: 'image/*' },
  { id: ToolType.FormatConverter, description: 'Convert Images', icon: 'FileType', accepts: 'image/*' },
  { id: ToolType.Compressor, description: 'Compress Images', icon: 'Minimize2', accepts: 'image/*' },
  { id: ToolType.Resizer, description: 'Resize Images', icon: 'Maximize2', accepts: 'image/*' },
  { id: ToolType.Watermark, description: 'Add Watermark', icon: 'Stamp', accepts: 'image/*' },
  { id: ToolType.Crop, description: 'Crop Image', icon: 'Crop', accepts: 'image/*' },
  { id: ToolType.JpgToPdf, description: 'JPG to PDF', icon: 'FilePlus', accepts: 'image/jpeg,image/png' },
  { id: ToolType.PdfToJpg, description: 'PDF to Image', icon: 'FileImage', accepts: 'application/pdf' },
  { id: ToolType.PdfToWord, description: 'PDF to Word', icon: 'FileText', accepts: 'application/pdf' },
  { id: ToolType.ImageToHtml, description: 'Image to HTML', icon: 'Code', accepts: 'image/*' },
  { id: ToolType.HtmlToImage, description: 'HTML to Image', icon: 'ImageIcon', accepts: 'text/html' },
];

const IconMap: Record<string, React.FC<{ className?: string }>> = {
  FileType, Minimize2, Maximize2, Stamp, Crop, FilePlus, FileImage, FileText, Code, ImageIcon, Sparkles
};

function App() {
  const [activeToolId, setActiveToolId] = useState<ToolType | null>(null);
  const [activePage, setActivePage] = useState<'dashboard' | 'about' | 'privacy' | 'terms' | 'contact' | 'docs'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeTool = TOOLS.find(t => t.id === activeToolId);

  const handleNavigation = (page: 'about' | 'privacy' | 'terms' | 'contact' | 'dashboard' | 'docs') => {
    setActiveToolId(null);
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const handleToolClick = (toolId: ToolType) => {
    setActiveToolId(toolId);
    setActivePage('dashboard');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo Area */}
      <div className="p-6 border-b border-slate-100">
        <div 
          className="flex items-center cursor-pointer group select-none" 
          onClick={() => handleNavigation('dashboard')}
        >
          <img src="https://imgconvertool.com/wp-content/uploads/2025/11/cropped-Green-Blue-Bold-Modern-Creative-Studio-Logo-2.png" alt="IMG CONVERT TOOL" className="h-10 w-auto object-contain" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
        <button 
          onClick={() => handleNavigation('dashboard')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 mb-4 ${!activeToolId && activePage === 'dashboard' ? 'bg-slate-100 text-primary font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span>All Tools</span>
        </button>

        <div className="px-4 pb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tools</p>
        </div>
        
        {TOOLS.map((tool) => {
            const Icon = IconMap[tool.icon];
            const isActive = activeToolId === tool.id;
            return (
                <button
                    key={tool.id}
                    onClick={() => handleToolClick(tool.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
                        isActive 
                        ? 'bg-primary/5 text-primary font-medium' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                    <span className="truncate">{tool.description}</span>
                </button>
            );
        })}

        <div className="pt-4 mt-4 border-t border-slate-100">
             <div className="px-4 pb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Help</p>
            </div>
            <button 
              onClick={() => handleNavigation('docs')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${activePage === 'docs' ? 'bg-primary/5 text-primary font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
                <BookOpen className={`w-4 h-4 ${activePage === 'docs' ? 'text-primary' : 'text-slate-400'}`} />
                <span>Documentation</span>
            </button>
        </div>
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/30 flex flex-col lg:flex-row font-sans">
      
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-slate-200 p-4 sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center cursor-pointer select-none" onClick={() => handleNavigation('dashboard')}>
            <img src="https://imgconvertool.com/wp-content/uploads/2025/11/cropped-Green-Blue-Bold-Modern-Creative-Studio-Logo-2.png" alt="IMG CONVERT TOOL" className="h-8 w-auto object-contain" />
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-600">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-white pt-20">
           <SidebarContent />
        </div>
      )}

      {/* Desktop Vertical Sidebar */}
      <aside className="hidden lg:block w-64 h-screen fixed left-0 top-0 bg-white border-r border-slate-200 z-50">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <main className="flex-1 p-4 sm:p-8 lg:p-12 max-w-[1600px] mx-auto w-full">
          {activeTool ? (
            <ToolWorkspace tool={activeTool} onBack={() => setActiveToolId(null)} />
          ) : activePage === 'about' ? (
            <AboutView />
          ) : activePage === 'privacy' ? (
            <PrivacyView />
          ) : activePage === 'terms' ? (
            <TermsView />
          ) : activePage === 'contact' ? (
            <ContactView />
          ) : activePage === 'docs' ? (
            <DocsView />
          ) : (
            <div className="animate-in fade-in duration-500">
              {/* Hero */}
              <div className="mb-12 text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                  Free Online Image Converter & Tools
                </h1>
                <p className="text-lg text-slate-600 max-w-2xl">
                  The fastest way to convert, compress, and edit images directly in your browser. Secure, free, and unlimited processing for all your photo needs.
                </p>
              </div>

              {/* Tools Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {TOOLS.map((tool) => {
                  const Icon = IconMap[tool.icon];
                  return (
                    <Card 
                      key={tool.id} 
                      onClick={() => setActiveToolId(tool.id)}
                      className="flex flex-col items-center justify-center text-center p-8 h-full min-h-[12rem] hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group cursor-pointer border-slate-200 hover:border-primary/30"
                    >
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-primary group-hover:shadow-lg group-hover:shadow-primary/30 transition-all duration-300">
                        <Icon className="w-7 h-7 text-slate-600 group-hover:text-white transition-colors" />
                      </div>
                      <span className="font-semibold text-slate-900 text-lg group-hover:text-primary transition-colors">{tool.description}</span>
                    </Card>
                  );
                })}
              </div>

              {/* Features / Info Footer Block within content */}
              <div className="mt-20 border-t border-slate-200 pt-10">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">100% Private Processing</h4>
                          <p className="text-sm text-slate-500 mt-1">We use client-side technology. Your photos never leave your device.</p>
                        </div>
                     </div>
                     <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                          <Maximize2 className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">Unlimited Free Conversions</h4>
                          <p className="text-sm text-slate-500 mt-1">No limits, no subscriptions, and no watermarks on your output.</p>
                        </div>
                     </div>
                     <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                          <Code2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">Support for 100+ Formats</h4>
                          <p className="text-sm text-slate-500 mt-1">Convert JPG, PNG, WebP, PDF, HEIC, SVG and more with ease.</p>
                        </div>
                     </div>
                 </div>
              </div>

              {/* SEO Content Section */}
              <div className="mt-20 space-y-12">
                  <div className="text-center max-w-3xl mx-auto">
                      <h2 className="text-3xl font-bold text-slate-900 mb-6">The All-in-One Online Image Converter</h2>
                      <p className="text-slate-600 leading-relaxed text-lg">
                          Welcome to <strong>IMG Convert Tool</strong>, your one-stop solution for all image editing and conversion tasks. Whether you need to compress a large photo for the web, convert a PDF to an editable Word document, or resize images for social media, our suite of free online tools makes it effortless.
                      </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                          <h3 className="text-2xl font-bold text-slate-900 flex items-center">
                              <Zap className="w-6 h-6 mr-2 text-amber-500" />
                              Powerful Image Compression
                          </h3>
                          <p className="text-slate-600 leading-relaxed">
                              Our advanced <strong>Image Compressor</strong> reduces file size by up to 90% without compromising visual quality. Perfect for web developers, photographers, and anyone looking to optimize their website speed. We support smart compression for JPG, PNG, and WebP formats.
                          </p>
                          <ul className="space-y-2">
                              {['Optimize images for SEO', 'Faster website loading speeds', 'Save storage space'].map((item, i) => (
                                  <li key={i} className="flex items-center text-slate-700 text-sm">
                                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> {item}
                                  </li>
                              ))}
                          </ul>
                      </div>
                      
                      <div className="space-y-6">
                          <h3 className="text-2xl font-bold text-slate-900 flex items-center">
                              <Globe className="w-6 h-6 mr-2 text-blue-500" />
                              Universal Format Conversion
                          </h3>
                          <p className="text-slate-600 leading-relaxed">
                              Need to change an image format? Our <strong>Format Converter</strong> handles everything from common formats like JPG and PNG to specialized ones like HEIC, SVG, and WEBP. We even offer powerful <strong>PDF to JPG</strong> and <strong>JPG to PDF</strong> conversion tools for document management.
                          </p>
                          <div className="flex flex-wrap gap-2">
                              {['JPG to PNG', 'PNG to PDF', 'HEIC to JPG', 'WebP Converter', 'PDF to Word'].map((tag, i) => (
                                  <span key={i} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">
                                      {tag}
                                  </span>
                              ))}
                          </div>
                      </div>
                  </div>

                  <div className="bg-slate-50 rounded-3xl p-8 sm:p-12 border border-slate-200">
                      <h3 className="text-2xl font-bold text-slate-900 mb-4">Why use our Image Resizer & Tools?</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-slate-600">
                          <div>
                              <strong className="block text-slate-900 mb-2">Fast & Browser-Based</strong>
                              <p className="text-sm">We don't queue your files. Everything processes instantly in your own browser using WebAssembly technology.</p>
                          </div>
                          <div>
                              <strong className="block text-slate-900 mb-2">Secure & Private</strong>
                              <p className="text-sm">Since files aren't uploaded to a remote server, your personal photos and documents remain completely private.</p>
                          </div>
                          <div>
                              <strong className="block text-slate-900 mb-2">Batch Processing</strong>
                              <p className="text-sm">Convert, resize, or compress multiple images at once to save time on large projects.</p>
                          </div>
                      </div>
                  </div>
              </div>

            </div>
          )}
        </main>
        
        <Footer onNavigate={handleNavigation} />
      </div>
    </div>
  );
}

export default App;
