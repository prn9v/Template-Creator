'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Download, ArrowLeft, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import Link from 'next/link';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Placeholder {
  id: string;
  type: 'text' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  placeholder?: string;
  required: boolean;
  pageIndex?: number;
}

interface Template {
  _id: string;
  name: string;
  description: string;
  category: string;
  backgroundImage: string;
  width: number;
  height: number;
  placeholders: Placeholder[];
  isPdf?: boolean;
  totalPages?: number;
  pdfFilePath?: string;
}

interface UserData {
  [key: string]: string | File | null;
}

export default function CustomizePage() {
  const params = useParams();
  const [template, setTemplate] = useState<Template | null>(null);
  const [userData, setUserData] = useState<UserData>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfLib, setPdfLib] = useState<any>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load PDF libraries
  useEffect(() => {
    const loadPdfLibraries = async () => {
      try {
        // Load pdf-lib
        const pdfLibScript = document.createElement('script');
        pdfLibScript.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
        pdfLibScript.onload = () => {
          setPdfLib((window as any).PDFLib);
        };
        document.head.appendChild(pdfLibScript);

        // Load PDF.js for rendering
        const pdfJsScript = document.createElement('script');
        pdfJsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        pdfJsScript.onload = () => {
          // Configure PDF.js worker
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        };
        document.head.appendChild(pdfJsScript);
      } catch (error) {
        console.error('Error loading PDF libraries:', error);
      }
    };

    loadPdfLibraries();
  }, []);

  useEffect(() => {
    if (params.id) {
      fetchTemplate(params.id as string);
    }
  }, [params.id]);

  // Add keyboard navigation for PDF pages
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!template?.isPdf) return;
      
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        navigateToPage('prev');
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        navigateToPage('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [template, currentPage]);

  const fetchTemplate = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/templates/${id}`);
      if (response.ok) {
        const templateData = await response.json();
        setTemplate(templateData);
        
        // Initialize user data with empty values
        const initialData: UserData = {};
        templateData.placeholders.forEach((placeholder: Placeholder) => {
          initialData[placeholder.id] = '';
        });
        setUserData(initialData);

        // If it's a PDF template, load and process it
        if (templateData.isPdf && templateData.pdfFilePath) {
          await loadPdfTemplate(templateData.pdfFilePath);
        } else if (templateData.isPdf && !templateData.pdfFilePath) {
          console.warn('PDF template detected but no pdfFilePath provided');
          setPdfError('PDF file path not found in template data');
        }
      } else {
        throw new Error('Template not found');
      }
    } catch (error) {
      console.error('Error fetching template:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPdfTemplate = async (pdfPath: string) => {
    if (!pdfLib) {
      console.warn('PDF-lib not loaded yet, retrying...');
      setTimeout(() => loadPdfTemplate(pdfPath), 1000);
      return;
    }
    
    try {
      setPdfLoading(true);
      setPdfError(null);
      console.log('Loading PDF from:', pdfPath);
      
      const response = await fetch(pdfPath, { 
        mode: 'cors',
        headers: {
          'Accept': 'application/pdf'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log('PDF loaded, size:', arrayBuffer.byteLength);
      
      const pdf = await pdfLib.PDFDocument.load(arrayBuffer);
      const totalPages = pdf.getPageCount();
      console.log('PDF pages detected:', totalPages);
      
      setPdfDoc(pdf);
      
      // Update template totalPages if not set correctly
      if (template && (!template.totalPages || template.totalPages !== totalPages)) {
        setTemplate(prev => prev ? { ...prev, totalPages } : null);
      }
      
      // Generate page images for preview
      const images: string[] = [];
      
      for (let i = 0; i < totalPages; i++) {
        try {
          console.log(`Rendering page ${i + 1}/${totalPages}`);
          const pageImage = await renderPdfPage(pdf, i);
          if (pageImage) {
            images.push(pageImage);
            console.log(`Page ${i + 1} rendered successfully`);
          } else {
            console.warn(`Page ${i + 1} failed to render`);
            images.push('');
          }
        } catch (pageError) {
          console.error(`Error rendering page ${i + 1}:`, pageError);
          images.push('');
        }
      }
      
      console.log('Total pages rendered:', images.filter(img => img).length);
      setPageImages(images);
      setCurrentPage(0);
      setPdfLoading(false);
    } catch (error) {
      console.error('Error loading PDF template:', error);
      setPdfError(`Failed to load PDF template: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPdfLoading(false);
    }
  };

  const renderPdfPage = async (pdfDoc: any, pageIndex: number): Promise<string> => {
    if (!pdfLib || !pdfDoc) return '';
    
    try {
      // Wait for PDF.js to be available
      if (!(window as any).pdfjsLib) {
        console.warn('PDF.js not loaded, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if ((window as any).pdfjsLib) {
        const pdfBytes = await pdfDoc.save();
        const loadingTask = (window as any).pdfjsLib.getDocument({ 
          data: pdfBytes,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageIndex + 1);
        
        // Calculate scale to fit the template dimensions
        const scale = Math.min(2.0, 800 / page.getViewport({ scale: 1.0 }).width);
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas context not available');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          enableWebGL: false
        };
        
        await page.render(renderContext).promise;
        
        // Clean up
        pdf.destroy();
        
        return canvas.toDataURL('image/png', 0.9);
      } else {
        console.warn('PDF.js not available, using fallback');
        // Enhanced fallback method - create a single page PDF
        const newPdf = await pdfLib.PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
        newPdf.addPage(copiedPage);
        
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
      }
    } catch (error) {
      console.error('Error rendering PDF page:', error);
      // Return a placeholder image URL or empty string
      return '';
    }
  };

  const handleInputChange = (placeholderId: string, value: string) => {
    setUserData(prev => ({
      ...prev,
      [placeholderId]: value
    }));
  };

  const handleImageUpload = (placeholderId: string, file: File | null) => {
    setUserData(prev => ({
      ...prev,
      [placeholderId]: file
    }));
  };

  const navigateToPage = (direction: 'prev' | 'next') => {
    if (!template || !template.isPdf) return;
    
    const totalPages = template.totalPages || pageImages.length || 1;
    
    if (direction === 'prev' && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    } else if (direction === 'next' && currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPage = (pageNumber: number) => {
    if (!template || !template.isPdf) return;
    
    const totalPages = template.totalPages || pageImages.length || 1;
    const targetPage = Math.max(0, Math.min(pageNumber - 1, totalPages - 1));
    setCurrentPage(targetPage);
  };

  const generatePDF = async () => {
    if (!template) return;

    setGenerating(true);
    try {
      if (template.isPdf && pdfDoc) {
        await generatePdfFromTemplate();
      } else {
        await generatePdfFromCanvas();
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const generatePdfFromTemplate = async () => {
    if (!pdfLib || !pdfDoc || !template) return;

    try {
      const newPdf = await pdfLib.PDFDocument.create();
      const pages = await newPdf.copyPages(pdfDoc, Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i));
      
      pages.forEach(page => newPdf.addPage(page));
      
      // Embed fonts
      const helvetica = await newPdf.embedFont(pdfLib.StandardFonts.Helvetica);
      const timesRoman = await newPdf.embedFont(pdfLib.StandardFonts.TimesRoman);
      
      const fontMap: { [key: string]: any } = {
        'Arial': helvetica,
        'Helvetica': helvetica,
        'Times New Roman': timesRoman,
        'Georgia': timesRoman
      };

      const newPages = newPdf.getPages();
      
      for (let pageIndex = 0; pageIndex < newPages.length; pageIndex++) {
        const page = newPages[pageIndex];
        const { height: pageHeight } = page.getSize();
        
        const pagePlaceholders = template.placeholders.filter(p => p.pageIndex === pageIndex);
        
        for (const placeholder of pagePlaceholders) {
          const userValue = userData[placeholder.id];
          if (!userValue && placeholder.required) {
            alert(`Required field "${placeholder.placeholder}" is missing on page ${pageIndex + 1}`);
            return;
          }
          
          if (!userValue) continue;
          
          if (placeholder.type === 'text') {
            const font = fontMap[placeholder.fontFamily || 'Arial'] || helvetica;
            const fontSize = placeholder.fontSize || 12;
            const color = hexToRgb(placeholder.color || '#000000');
            
            const x = placeholder.x;
            const y = pageHeight - placeholder.y - (placeholder.height || fontSize);
            
            page.drawText(userValue.toString(), {
              x,
              y,
              size: fontSize,
              font,
              color: pdfLib.rgb(color.r / 255, color.g / 255, color.b / 255),
              maxWidth: placeholder.width,
            });
          } else if (placeholder.type === 'image' && userValue instanceof File) {
            try {
              const imageBytes = await userValue.arrayBuffer();
              let image;
              
              if (userValue.type === 'image/png') {
                image = await newPdf.embedPng(imageBytes);
              } else if (userValue.type === 'image/jpeg' || userValue.type === 'image/jpg') {
                image = await newPdf.embedJpg(imageBytes);
              } else {
                console.warn(`Unsupported image type: ${userValue.type}`);
                continue;
              }
              
              const x = placeholder.x;
              const y = pageHeight - placeholder.y - placeholder.height;
              
              page.drawImage(image, {
                x,
                y,
                width: placeholder.width,
                height: placeholder.height,
              });
            } catch (imageError) {
              console.error('Error processing image:', imageError);
            }
          }
        }
      }
      
      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.name}-customized.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF from template:', error);
      throw error;
    }
  };

  const generatePdfFromCanvas = async () => {
    if (!canvasRef.current || !template) return;

    // Hide placeholder borders before capturing
    const placeholderElements = canvasRef.current.querySelectorAll('[data-placeholder-border="true"]');
    placeholderElements.forEach(el => {
      (el as HTMLElement).style.border = 'none';
      (el as HTMLElement).style.backgroundColor = 'transparent';
    });

    const canvas = await html2canvas(canvasRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    // Restore placeholder borders after capturing
    placeholderElements.forEach(el => {
      (el as HTMLElement).style.border = '2px dashed #60a5fa';
      (el as HTMLElement).style.backgroundColor = 'rgba(219, 234, 254, 0.3)';
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: template.width > template.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [template.width, template.height]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, template.width, template.height);
    pdf.save(`${template.name}-customized.pdf`);
  };

  const downloadImage = async () => {
    if (!canvasRef.current) return;

    setGenerating(true);
    try {
      // Hide placeholder borders before capturing
      const placeholderElements = canvasRef.current.querySelectorAll('[data-placeholder-border="true"]');
      placeholderElements.forEach(el => {
        (el as HTMLElement).style.border = 'none';
        (el as HTMLElement).style.backgroundColor = 'transparent';
      });

      const canvas = await html2canvas(canvasRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // Restore placeholder borders after capturing
      placeholderElements.forEach(el => {
        (el as HTMLElement).style.border = '2px dashed #60a5fa';
        (el as HTMLElement).style.backgroundColor = 'rgba(219, 234, 254, 0.3)';
      });

      const link = document.createElement('a');
      link.download = `${template?.name}-customized.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Error generating image. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const getCurrentPagePlaceholders = () => {
    if (!template) return [];
    if (!template.isPdf) return template.placeholders;
    return template.placeholders.filter(p => p.pageIndex === currentPage);
  };

  const getCurrentBackgroundImage = () => {
    if (template?.isPdf && pageImages[currentPage]) {
      return pageImages[currentPage];
    }
    return template?.backgroundImage || '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading template...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Template not found</p>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            Back to Templates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Link
              href="/"
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center">
                <h1 className="text-3xl font-bold text-gray-900 mr-3">{template.name}</h1>
                {template.isPdf && (
                  <div className="flex items-center bg-blue-50 px-2 py-1 rounded-md">
                    <FileText className="w-4 h-4 text-blue-600 mr-1" />
                    <span className="text-sm text-blue-600">PDF Template</span>
                  </div>
                )}
              </div>
              <p className="text-gray-600">{template.description}</p>
              {template.isPdf && (
                <p className="text-sm text-blue-600 mt-1">
                  {Math.max(template.totalPages || 0, pageImages.length)} pages • Current: Page {currentPage + 1}
                </p>
              )}
            </div>
          </div>
          <div className="flex space-x-3">
            {!template.isPdf && (
              <button
                onClick={downloadImage}
                disabled={generating}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-2" />
                {generating ? 'Generating...' : 'Download PNG'}
              </button>
            )}
            <button
              onClick={generatePDF}
              disabled={generating}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-2" />
              {generating ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Form */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Customize Your Template</h2>
              
              {/* PDF Page Navigation in Form */}
              {template.isPdf && (pageImages.length > 1 || (template.totalPages && template.totalPages > 1)) && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Navigate Pages</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => navigateToPage('prev')}
                        disabled={currentPage === 0}
                        className="p-2 rounded bg-white border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Previous Page"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-sm text-gray-600 px-2">
                        Page {currentPage + 1} of {Math.max(template.totalPages || 0, pageImages.length)}
                      </span>
                      <button
                        onClick={() => navigateToPage('next')}
                        disabled={currentPage >= (Math.max(template.totalPages || 0, pageImages.length) - 1)}
                        className="p-2 rounded bg-white border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Next Page"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-md font-medium text-gray-800">
                  {template.isPdf ? `Page ${currentPage + 1} Fields` : 'Template Fields'}
                </h3>
                
                {getCurrentPagePlaceholders().map((placeholder) => (
                  <div key={placeholder.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {placeholder.placeholder || `${placeholder.type} field`}
                      {placeholder.required && <span className="text-red-500 ml-1">*</span>}
                      {template.isPdf && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1 rounded">
                          Page {(placeholder.pageIndex || 0) + 1}
                        </span>
                      )}
                    </label>
                    
                    {placeholder.type === 'text' ? (
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={placeholder.placeholder}
                        value={userData[placeholder.id] as string || ''}
                        onChange={(e) => handleInputChange(placeholder.id, e.target.value)}
                      />
                    ) : (
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          onChange={(e) => handleImageUpload(placeholder.id, e.target.files?.[0] || null)}
                        />
                        {userData[placeholder.id] && userData[placeholder.id] instanceof File && (
                          <p className="mt-1 text-sm text-green-600">
                            Selected: {(userData[placeholder.id] as File).name}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {getCurrentPagePlaceholders().length === 0 && (
                  <p className="text-gray-500 text-sm italic">
                    No fields on this page
                  </p>
                )}
              </div>
            </div>

            {/* All Fields Summary for PDF */}
            {template.isPdf && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">All Template Fields</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {template.placeholders.map((placeholder) => (
                    <div key={placeholder.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                      <span className="font-medium">
                        {placeholder.placeholder || `${placeholder.type} field`}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded">
                          P{(placeholder.pageIndex || 0) + 1}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${
                          userData[placeholder.id] ? 'bg-green-500' : 'bg-gray-300'
                        }`}></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Preview</h2>
                
                {/* Enhanced PDF Navigation in Preview */}
                {template.isPdf && (pageImages.length > 1 || (template.totalPages && template.totalPages > 1)) && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => navigateToPage('prev')}
                      disabled={currentPage === 0}
                      className="p-2 rounded-md bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-5 h-5 text-blue-600" />
                    </button>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="1"
                        max={Math.max(template.totalPages || 0, pageImages.length)}
                        value={currentPage + 1}
                        onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-sm text-gray-600">
                        of {Math.max(template.totalPages || 0, pageImages.length)}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => navigateToPage('next')}
                      disabled={currentPage >= (Math.max(template.totalPages || 0, pageImages.length) - 1)}
                      className="p-2 rounded-md bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Next Page"
                    >
                      <ChevronRight className="w-5 h-5 text-blue-600" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                <div className="flex justify-center items-center min-h-[400px] p-4">
                  <div
                    ref={canvasRef}
                    className="relative shadow-lg"
                    style={{ 
                      width: template.isPdf ? 'fit-content' : Math.min(template.width || 800, 800), 
                      height: template.isPdf ? 'fit-content' : Math.min(template.height || 600, 600),
                      maxWidth: '100%',
                      maxHeight: '80vh',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  >
                  {pdfLoading ? (
                    <div className="w-full h-96 flex items-center justify-center bg-gray-50">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading PDF pages...</p>
                      </div>
                    </div>
                  ) : pdfError ? (
                    <div className="w-full h-96 flex items-center justify-center bg-red-50">
                      <div className="text-center">
                        <p className="text-red-600 mb-4">{pdfError}</p>
                        <button
                          onClick={() => template?.pdfFilePath && loadPdfTemplate(template.pdfFilePath)}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : getCurrentBackgroundImage() ? (
                    <>
                      {template.isPdf ? (
                        getCurrentBackgroundImage() ? (
                          <img
                            src={getCurrentBackgroundImage()}
                            alt={`PDF page ${currentPage + 1}`}
                            className="w-full h-auto object-contain"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              console.error('Error loading PDF page:', e);
                              setPdfError(`Failed to load page ${currentPage + 1}`);
                            }}
                            onLoad={() => console.log(`PDF page ${currentPage + 1} loaded successfully`)}
                            style={{ 
                              display: 'block',
                              maxWidth: '100%',
                              maxHeight: '70vh',
                              height: 'auto',
                              width: 'auto'
                            }}
                          />
                        ) : (
                          <div className="w-full h-96 flex items-center justify-center bg-gray-100">
                            <div className="text-center">
                              <p className="text-gray-600 mb-2">Page {currentPage + 1} failed to render</p>
                              <button
                                onClick={() => template?.pdfFilePath && loadPdfTemplate(template.pdfFilePath)}
                                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                              >
                                Retry
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <img
                          src={getCurrentBackgroundImage()}
                          alt="Template background"
                          className="w-full h-full object-contain"
                          crossOrigin="anonymous"
                          onError={(e) => console.error('Error loading image:', e)}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '70vh',
                            height: 'auto'
                          }}
                        />
                      )}
                      
                      {/* Rendered placeholders for current page */}
                      {getCurrentPagePlaceholders().map((placeholder) => {
                        const value = userData[placeholder.id];
                        
                        // Calculate display coordinates based on image scaling
                        const imgElement = canvasRef.current?.querySelector('img') as HTMLElement;
                        let displayX = placeholder.x;
                        let displayY = placeholder.y;
                        let displayWidth = placeholder.width;
                        let displayHeight = placeholder.height;

                        if (imgElement) {
                          const imgRect = imgElement.getBoundingClientRect();
                          const containerRect = canvasRef.current?.getBoundingClientRect();
                          if (containerRect && template.width && template.height) {
                            const scaleX = imgRect.width / template.width;
                            const scaleY = imgRect.height / template.height;
                            displayX = placeholder.x * scaleX;
                            displayY = placeholder.y * scaleY;
                            displayWidth = placeholder.width * scaleX;
                            displayHeight = placeholder.height * scaleY;
                          }
                        }
                        
                        return (
                          <div
                            key={placeholder.id}
                            className="absolute flex items-center justify-center print:border-none print:bg-transparent"
                            style={{
                              left: displayX,
                              top: displayY,
                              width: displayWidth,
                              height: displayHeight,
                              pointerEvents: 'none',
                              border: '2px dashed #60a5fa',
                              backgroundColor: 'rgba(219, 234, 254, 0.3)'
                            }}
                            data-placeholder-border="true"
                          >
                            {placeholder.type === 'text' ? (
                              <div
                                className="w-full h-full flex items-center justify-center text-center break-words overflow-hidden"
                                style={{
                                  fontSize: placeholder.fontSize || 16,
                                  fontFamily: placeholder.fontFamily || 'Arial',
                                  color: placeholder.color || '#000000',
                                  lineHeight: '1.2',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  textAlign: 'center',
                                  wordWrap: 'break-word',
                                  hyphens: 'auto'
                                }}
                              >
                                <span style={{ 
                                  display: 'block',
                                  width: '100%',
                                  textAlign: 'center'
                                }}>
                                  {(typeof value === 'string' ? value : '') || placeholder.placeholder}
                                </span>
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded">
                                {value && value instanceof File ? (
                                  <img
                                    src={URL.createObjectURL(value)}
                                    alt="User uploaded"
                                    className="w-full h-full object-contain"
                                    style={{
                                      objectFit: 'contain',
                                      width: '100%',
                                      height: '100%'
                                    }}
                                    onError={(e) => console.error('Error loading uploaded image:', e)}
                                  />
                                ) : (
                                  <span className="text-gray-500 text-xs text-center p-1">
                                    {placeholder.placeholder || 'Upload Image'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <span className="text-gray-500">Loading template...</span>
                    </div>
                  )}
                  </div>
                </div>
              </div>
              
              {/* Page Summary for PDF */}
              {template.isPdf && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      Fields on this page: {getCurrentPagePlaceholders().length}
                    </span>
                    <span className="text-gray-500">
                      Completed: {getCurrentPagePlaceholders().filter(p => userData[p.id]).length} / {getCurrentPagePlaceholders().length}
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ 
                        width: `${getCurrentPagePlaceholders().length > 0 ? 
                          (getCurrentPagePlaceholders().filter(p => userData[p.id]).length / getCurrentPagePlaceholders().length) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}