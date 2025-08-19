
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Plus, Trash2, Move, Type, ImageIcon, Save, Eye, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface Placeholder {
  id: string;
  type: 'text' | 'image' | 'textarea';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  placeholder?: string;
  required: boolean;
  pageIndex?: number; // Add page index for PDF support
  lineHeight?: number; // Line height for textarea
  maxLines?: number; // Maximum lines for textarea
  isGlobal?: boolean; // Global placeholder appears on all pages
  pageOverrides?: { [key: number]: { x: number; y: number; width: number; height: number } }; // Position overrides for specific pages
}

interface Template {
  name: string;
  description: string;
  category: string;
  backgroundImage: string;
  width: number;
  height: number;
  placeholders: Placeholder[];
  isPdf?: boolean; // Flag to identify PDF templates
  totalPages?: number; // Total pages in PDF
}

export default function AdminPage() {
  const [template, setTemplate] = useState<Template>({
    name: '',
    description: '',
    category: '',
    backgroundImage: '',
    width: 800,
    height: 600,
    placeholders: [],
    isPdf: false,
    totalPages: 1
  });
  
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<string | null>(null);
  const [isAddingPlaceholder, setIsAddingPlaceholder] = useState<'text' | 'image' | 'textarea' | null>(null);
  const [draggedPlaceholder, setDraggedPlaceholder] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load pdf-lib dynamically
  const [pdfLib, setPdfLib] = useState<any>(null);
  
  useEffect(() => {
    const loadPdfLib = async () => {
      try {
        // Load pdf-lib from CDN
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
        script.onload = () => {
          setPdfLib((window as any).PDFLib);
        };
        document.head.appendChild(script);

        // Also load PDF.js for better PDF rendering
        const pdfJsScript = document.createElement('script');
        pdfJsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        document.head.appendChild(pdfJsScript);
      } catch (error) {
        console.error('Error loading pdf libraries:', error);
      }
    };

    loadPdfLib();
  }, []);

  const renderPdfPage = async (pdfDoc: any, pageIndex: number): Promise<string> => {
    if (!pdfLib) return '';
    
    try {
      // Use PDF.js for better rendering if available
      if ((window as any).pdfjsLib) {
        const pdfBytes = await pdfDoc.save();
        const loadingTask = (window as any).pdfjsLib.getDocument({ data: pdfBytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageIndex + 1);
        
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        return canvas.toDataURL();
      } else {
        // Fallback to pdf-lib method
        const newPdf = await pdfLib.PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
        newPdf.addPage(copiedPage);
        
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
      }
    } catch (error) {
      console.error('Error rendering PDF page:', error);
      return '';
    }
  };

  const processPdfFile = async (file: File) => {
    if (!pdfLib) return;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfLib.PDFDocument.load(arrayBuffer);
      const pageCount = pdf.getPageCount();
      
      // Get actual PDF page dimensions from the first page
      const firstPage = pdf.getPage(0);
      const { width: pdfWidth, height: pdfHeight } = firstPage.getSize();
      
      setPdfDoc(pdf);
      setTemplate(prev => ({
        ...prev,
        isPdf: true,
        totalPages: pageCount,
        width: pdfWidth, // Use actual PDF width
        height: pdfHeight // Use actual PDF height
      }));

      // Generate images for all pages
      const images: string[] = [];
      for (let i = 0; i < pageCount; i++) {
        const pageImage = await renderPdfPage(pdf, i);
        images.push(pageImage);
      }
      setPageImages(images);
      setCurrentPage(0);
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert('Error processing PDF file');
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      
      if (file.type === 'application/pdf') {
        await processPdfFile(file);
      } else {
        // Handle image files as before
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          setTemplate(prev => ({
            ...prev,
            backgroundImage: url,
            width: img.width,
            height: img.height,
            isPdf: false,
            totalPages: 1
          }));
        };
        img.src = url;
      }
    }
  }, [pdfLib]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingPlaceholder) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Get the actual image element to calculate proper coordinates
    const imgElement = canvasRef.current.querySelector('img, embed') as HTMLElement;
    if (!imgElement) return;

    const imgRect = imgElement.getBoundingClientRect();
    const scaleX = template.width / imgRect.width;
    const scaleY = template.height / imgRect.height;

    const x = (e.clientX - imgRect.left) * scaleX;
    const y = (e.clientY - imgRect.top) * scaleY;

    const newPlaceholder: Placeholder = {
      id: `placeholder-${Date.now()}`,
      type: isAddingPlaceholder,
      x,
      y,
      width: isAddingPlaceholder === 'text' ? 200 : isAddingPlaceholder === 'textarea' ? 300 : 150,
      height: isAddingPlaceholder === 'text' ? 30 : isAddingPlaceholder === 'textarea' ? 120 : 100,
      fontSize: 16,
      fontFamily: 'Arial',
      color: '#000000',
      placeholder: isAddingPlaceholder === 'text' ? 'Enter text here' : isAddingPlaceholder === 'textarea' ? 'Enter paragraph text here' : 'Upload image',
      required: true,
      pageIndex: template.isPdf ? currentPage : 0, // Set page index for PDF
      lineHeight: isAddingPlaceholder === 'textarea' ? 1.2 : undefined,
      maxLines: isAddingPlaceholder === 'textarea' ? 5 : undefined,
      isGlobal: false,
      pageOverrides: {}
    };

    setTemplate(prev => ({
      ...prev,
      placeholders: [...prev.placeholders, newPlaceholder]
    }));

    setIsAddingPlaceholder(null);
  };

  const updatePlaceholder = (id: string, updates: Partial<Placeholder>) => {
    setTemplate(prev => ({
      ...prev,
      placeholders: prev.placeholders.map(p => 
        p.id === id ? { ...p, ...updates } : p
      )
    }));
  };

  const deletePlaceholder = (id: string) => {
    setTemplate(prev => ({
      ...prev,
      placeholders: prev.placeholders.filter(p => p.id !== id)
    }));
    setSelectedPlaceholder(null);
  };

  const generatePageOverrides = (placeholder: Placeholder, totalPages: number) => {
    const overrides: { [key: number]: { x: number; y: number; width: number; height: number } } = {};
    for (let i = 0; i < totalPages; i++) {
      overrides[i] = {
        x: placeholder.x,
        y: placeholder.y,
        width: placeholder.width,
        height: placeholder.height
      };
    }
    return overrides;
  };

  const handlePlaceholderMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDraggedPlaceholder(id);
    setSelectedPlaceholder(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedPlaceholder) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Get the actual image element to calculate proper coordinates
    const imgElement = canvasRef.current.querySelector('img, embed') as HTMLElement;
    if (!imgElement) return;

    const imgRect = imgElement.getBoundingClientRect();
    const scaleX = template.width / imgRect.width;
    const scaleY = template.height / imgRect.height;

    const x = (e.clientX - imgRect.left) * scaleX;
    const y = (e.clientY - imgRect.top) * scaleY;

    updatePlaceholder(draggedPlaceholder, { x, y });
  };

  const handleMouseUp = () => {
    setDraggedPlaceholder(null);
  };

  const navigateToPage = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    } else if (direction === 'next' && currentPage < (template.totalPages || 1) - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const saveTemplate = async () => {
    try {
      const formData = new FormData();
      if (uploadedFile) {
        formData.append('file', uploadedFile);
      }
      formData.append('template', JSON.stringify(template));

      const response = await fetch('/api/templates', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        alert('Template saved successfully!');
        // Reset form
        setTemplate({
          name: '',
          description: '',
          category: '',
          backgroundImage: '',
          width: 800,
          height: 600,
          placeholders: [],
          isPdf: false,
          totalPages: 1
        });
        setUploadedFile(null);
        setPdfDoc(null);
        setPageImages([]);
        setCurrentPage(0);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error saving template');
    }
  };

  // Filter placeholders for current page (including global placeholders)
  const currentPagePlaceholders = template.placeholders.filter(p => 
    !template.isPdf || p.pageIndex === currentPage || p.isGlobal
  );

  const selectedPlaceholderData = template.placeholders.find(p => p.id === selectedPlaceholder);

  const getCurrentBackgroundImage = () => {
    if (template.isPdf && pageImages[currentPage]) {
      return pageImages[currentPage];
    }
    return template.backgroundImage;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Template Admin</h1>
          <p className="text-gray-600">Create and manage templates with interactive placeholders. Now supports PDFs with page navigation!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Template Info & Upload */}
          <div className="space-y-6">
            {/* Template Details */}
            <div className="bg-white text-black rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Template Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={template.name}
                    onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Template name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    value={template.description}
                    onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Template description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Category</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={template.category}
                    onChange={(e) => setTemplate(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="">Select category</option>
                    <option value="Certificate">Certificate</option>
                    <option value="Business Card">Business Card</option>
                    <option value="Flyer">Flyer</option>
                    <option value="Poster">Poster</option>
                    <option value="Invoice">Invoice</option>
                    <option value="Resume">Resume</option>
                  </select>
                </div>
                
                {/* PDF Info */}
                {template.isPdf && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <div className="flex items-center text-blue-700">
                      <FileText className="w-4 h-4 mr-2" />
                      <span className="text-sm font-medium">PDF Template</span>
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      {template.totalPages} pages • Current: Page {currentPage + 1}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* File Upload */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Upload Background</h2>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {isDragActive ? 'Drop the file here' : 'Drag & drop PDF or image, or click to select'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Supports: PNG, JPG, PDF</p>
              </div>
              {uploadedFile && (
                <p className="mt-2 text-sm text-green-600">
                  Uploaded: {uploadedFile.name}
                </p>
              )}
            </div>

            {/* Placeholder Tools */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Add Placeholders</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setIsAddingPlaceholder('text')}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-md transition-colors ${
                    isAddingPlaceholder === 'text'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Type className="w-4 h-4 mr-2" />
                  Add Text Placeholder
                </button>
                <button
                  onClick={() => setIsAddingPlaceholder('image')}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-md transition-colors ${
                    isAddingPlaceholder === 'image'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Add Image Placeholder
                </button>
                <button
                  onClick={() => setIsAddingPlaceholder('textarea')}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-md transition-colors ${
                    isAddingPlaceholder === 'textarea'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Add Textarea Placeholder
                </button>
              </div>
              {isAddingPlaceholder && (
                <p className="mt-2 text-sm text-blue-600">
                  Click on the canvas to place the {isAddingPlaceholder} placeholder
                  {template.isPdf && ` on page ${currentPage + 1}`}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="space-y-2">
                <button
                  onClick={saveTemplate}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center"
                  disabled={!template.name || (!template.backgroundImage && pageImages.length === 0)}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Template
                </button>
              </div>
            </div>
          </div>

          {/* Center Panel - Canvas */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Template Canvas</h2>
                
                {/* PDF Navigation */}
                {template.isPdf && template.totalPages! > 1 && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigateToPage('prev')}
                      disabled={currentPage === 0}
                      className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage + 1} of {template.totalPages}
                    </span>
                    <button
                      onClick={() => navigateToPage('next')}
                      disabled={currentPage === (template.totalPages! - 1)}
                      className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              {getCurrentBackgroundImage() ? (
                <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                  <div className="flex justify-center items-center min-h-[500px] p-4">
                    <div
                      ref={canvasRef}
                      className="relative cursor-crosshair shadow-lg border border-gray-200 rounded-lg"
                      style={{ 
                        width: 'fit-content',
                        height: 'fit-content',
                        maxWidth: '100%',
                        maxHeight: '80vh',
                        backgroundColor: '#ffffff'
                      }}
                      onClick={handleCanvasClick}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                    >
                    {(window as any).pdfjsLib && template.isPdf ? (
                      <img
                        src={getCurrentBackgroundImage()}
                        alt="PDF page"
                        className="w-full h-auto object-contain"
                        draggable={false}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '70vh',
                          height: 'auto',
                          width: 'auto'
                        }}
                      />
                    ) : template.isPdf ? (
                      <embed
                        src={getCurrentBackgroundImage()}
                        className="w-full h-auto object-contain"
                        type="application/pdf"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '70vh',
                          height: 'auto'
                        }}
                      />
                    ) : (
                      <img
                        src={getCurrentBackgroundImage()}
                        alt="Template background"
                        className="w-full h-auto object-contain"
                        draggable={false}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '70vh',
                          height: 'auto'
                        }}
                      />
                    )}
                    
                    {/* Placeholders for current page */}
                    {currentPagePlaceholders.map((placeholder) => {
                      // Calculate display coordinates based on image scaling
                      const imgElement = canvasRef.current?.querySelector('img, embed') as HTMLElement;
                      let displayX = placeholder.x;
                      let displayY = placeholder.y;
                      let displayWidth = placeholder.width;
                      let displayHeight = placeholder.height;

                      if (imgElement) {
                        const imgRect = imgElement.getBoundingClientRect();
                        const containerRect = canvasRef.current?.getBoundingClientRect();
                        if (containerRect) {
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
                          className={`absolute border-2 cursor-move ${
                            selectedPlaceholder === placeholder.id
                              ? 'border-blue-500 bg-blue-100'
                              : 'border-red-400 bg-red-100'
                          } bg-opacity-50 flex items-center justify-center text-xs font-medium`}
                          style={{
                            left: displayX,
                            top: displayY,
                            width: displayWidth,
                            height: displayHeight
                          }}
                          onMouseDown={(e) => handlePlaceholderMouseDown(e, placeholder.id)}
                        >
                        {placeholder.type === 'text' ? (
                          <Type className="w-4 h-4" />
                        ) : placeholder.type === 'textarea' ? (
                          <FileText className="w-4 h-4" />
                        ) : (
                          <ImageIcon className="w-4 h-4" />
                        )}
                        <span className="ml-1">{placeholder.type}</span>
                        {template.isPdf && (
                          <span className="ml-1 text-xs bg-gray-200 px-1 rounded">
                            {placeholder.isGlobal ? 'ALL' : `P${(placeholder.pageIndex || 0) + 1}`}
                          </span>
                        )}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg h-96 flex items-center justify-center">
                  <div className="text-center">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Upload a background image or PDF to start</p>
                  </div>
                </div>
              )}
            </div>

            {/* Placeholder Properties */}
            {selectedPlaceholderData && (
              <div className="mt-6 bg-white text-black rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Placeholder Properties</h3>
                  <button
                    onClick={() => deletePlaceholder(selectedPlaceholderData.id)}
                    className="text-red-600 hover:text-red-800 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">X Position</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={selectedPlaceholderData.x}
                      onChange={(e) => updatePlaceholder(selectedPlaceholderData.id, { x: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Y Position</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={selectedPlaceholderData.y}
                      onChange={(e) => updatePlaceholder(selectedPlaceholderData.id, { y: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={selectedPlaceholderData.width}
                      onChange={(e) => updatePlaceholder(selectedPlaceholderData.id, { width: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={selectedPlaceholderData.height}
                      onChange={(e) => updatePlaceholder(selectedPlaceholderData.id, { height: parseInt(e.target.value) })}
                    />
                  </div>
                  
                  {template.isPdf && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Page</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={selectedPlaceholderData.pageIndex || 0}
                        onChange={(e) => updatePlaceholder(selectedPlaceholderData.id, { pageIndex: parseInt(e.target.value) })}
                      >
                        {Array.from({ length: template.totalPages || 1 }, (_, i) => (
                          <option key={i} value={i}>Page {i + 1}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {(selectedPlaceholderData.type === 'text' || selectedPlaceholderData.type === 'textarea') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={selectedPlaceholderData.fontSize}
                          onChange={(e) => updatePlaceholder(selectedPlaceholderData.id, { fontSize: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={selectedPlaceholderData.fontFamily}
                          onChange={(e) => updatePlaceholder(selectedPlaceholderData.id, { fontFamily: e.target.value })}
                        >
                          <option value="Arial">Arial</option>
                          <option value="Helvetica">Helvetica</option>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Georgia">Georgia</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                        <input
                          type="color"
                          className="w-full h-10 border border-gray-300 rounded-md"
                          value={selectedPlaceholderData.color}
                          onChange={(e) => updatePlaceholder(selectedPlaceholderData.id, { color: e.target.value })}
                        />
                      </div>
                      {selectedPlaceholderData.type === 'textarea' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Line Height</label>
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              max="3"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={selectedPlaceholderData.lineHeight || 1.2}
                              onChange={(e) => updatePlaceholder(selectedPlaceholderData.id, { lineHeight: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Max Lines</label>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={selectedPlaceholderData.maxLines || 5}
                              onChange={(e) => updatePlaceholder(selectedPlaceholderData.id, { maxLines: parseInt(e.target.value) })}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder Text</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={selectedPlaceholderData.placeholder}
                      onChange={(e) => updatePlaceholder(selectedPlaceholderData.id, { placeholder: e.target.value })}
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selectedPlaceholderData.required}
                        onChange={(e) => updatePlaceholder(selectedPlaceholderData.id, { required: e.target.checked })}
                      />
                      Required field
                    </label>
                    {template.isPdf && (
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            className="mr-2"
                            checked={selectedPlaceholderData.isGlobal || false}
                            onChange={(e) => {
                              const isGlobal = e.target.checked;
                              updatePlaceholder(selectedPlaceholderData.id, { 
                                isGlobal,
                                // If making global, copy current position to all pages
                                pageOverrides: isGlobal ? generatePageOverrides(selectedPlaceholderData, template.totalPages || 1) : {}
                              });
                            }}
                          />
                          <span className="text-sm font-medium">Global placeholder (appears on all pages with same coordinates)</span>
                        </label>
                        {selectedPlaceholderData.isGlobal && (
                          <div className="bg-blue-50 p-2 rounded text-xs text-blue-700">
                            <strong>Global Mode:</strong> This placeholder will appear at the same position (X: {selectedPlaceholderData.x}, Y: {selectedPlaceholderData.y}) on all {template.totalPages} pages.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}