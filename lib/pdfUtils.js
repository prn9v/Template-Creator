// lib/pdfUtils.js
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

/**
 * Fetch PDF from URL or local path
 * @param {string} pdfPath - URL or local path to PDF
 * @returns {Buffer} - PDF buffer
 */
async function fetchPdfBuffer(pdfPath) {
  if (pdfPath.startsWith('http://') || pdfPath.startsWith('https://')) {
    // Fetch from URL (Cloudinary)
    const response = await fetch(pdfPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF from URL: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } else {
    // Read from local file system (for backward compatibility)
    const fullPath = pdfPath.startsWith('/') ? 
      path.join(process.cwd(), 'public', pdfPath) : 
      pdfPath;
    return await fs.readFile(fullPath);
  }
}

/**
 * Process PDF template with user data
 * @param {string} templateId - Template ID from database
 * @param {Object} userData - User input data for placeholders
 * @returns {Buffer} - Generated PDF buffer
 */
export async function generatePdfFromTemplate(templateId, userData) {
  try {
    // Get template from database
    const Template = require('@/models/Template').default;
    const template = await Template.findById(templateId);
    
    if (!template || !template.isPdf) {
      throw new Error('PDF template not found');
    }
    
    // Load the original PDF
    const existingPdfBytes = await fetchPdfBuffer(template.pdfFilePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Get pages
    const pages = pdfDoc.getPages();
    
    // Load fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    
    const fontMap = {
      'Arial': helvetica,
      'Helvetica': helvetica,
      'Times New Roman': timesRoman,
      'Georgia': timesRoman
    };
    
    // Process placeholders for each page
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = page.getSize();
      
      // Get placeholders for this page
      const pagePlaceholders = template.placeholders.filter(p => p.pageIndex === pageIndex);
      
      for (const placeholder of pagePlaceholders) {
        const userValue = userData[placeholder.id];
        if (!userValue && placeholder.required) {
          throw new Error(`Required field ${placeholder.placeholder} is missing`);
        }
        
        if (!userValue) continue;
        
        if (placeholder.type === 'text') {
          // Add text to PDF
          const font = fontMap[placeholder.fontFamily] || helvetica;
          const fontSize = placeholder.fontSize || 12;
          
          // Convert color from hex to RGB
          const color = hexToRgb(placeholder.color || '#000000');
          
          // Get actual PDF page dimensions
          const actualPageSize = page.getSize();
          const actualPageWidth = actualPageSize.width;
          const actualPageHeight = actualPageSize.height;
        
          
          // Coordinates are already in PDF coordinate space from admin interface
          // Just need to convert from top-left to bottom-left coordinate system
          const x = placeholder.x;
          const y = actualPageHeight - placeholder.y - placeholder.height;
          
          
          page.drawText(userValue.toString(), {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(color.r / 255, color.g / 255, color.b / 255),
            maxWidth: placeholder.width,
          });
          
        } else if (placeholder.type === 'image' && userValue instanceof File) {
          // Handle image placeholder
          try {
            const imageBytes = await userValue.arrayBuffer();
            let image;
            
            if (userValue.type === 'image/png') {
              image = await pdfDoc.embedPng(imageBytes);
            } else if (userValue.type === 'image/jpeg') {
              image = await pdfDoc.embedJpg(imageBytes);
            } else {
              console.warn(`Unsupported image type: ${userValue.type}`);
              continue;
            }
            
            // Get actual PDF page dimensions
            const actualPageSize = page.getSize();
            const actualPageWidth = actualPageSize.width;
            const actualPageHeight = actualPageSize.height;
            
            
            // Coordinates are already in PDF coordinate space from admin interface
            // Just need to convert from top-left to bottom-left coordinate system
            const x = placeholder.x;
            const y = actualPageHeight - placeholder.y - placeholder.height;
            
            
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
    
    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

/**
 * Extract page count from PDF file
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {number} - Number of pages
 */
export async function getPdfPageCount(pdfBuffer) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('Error getting PDF page count:', error);
    throw error;
  }
}

/**
 * Extract text content from PDF for preview
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {number} pageIndex - Page index (0-based)
 * @returns {string} - Extracted text
 */
export async function extractTextFromPdfPage(pdfBuffer, pageIndex) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    
    if (pageIndex >= pages.length) {
      throw new Error('Page index out of range');
    }
    
    // Note: pdf-lib doesn't have built-in text extraction
    // For production, you might want to use pdf-parse or pdf2pic
    return `Page ${pageIndex + 1} content`; // Placeholder
    
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

/**
 * Convert PDF page to image for preview
 * @param {string} pdfPath - URL or local path to PDF file
 * @param {number} pageIndex - Page index (0-based)
 * @returns {Buffer} - Image buffer
 */
export async function pdfPageToImage(pdfPath, pageIndex) {
  try {
    // This would require additional libraries like pdf2pic or pdf-poppler
    // For now, we'll return the PDF itself for embedding
    const pdfBytes = await fetchPdfBuffer(pdfPath);
    return pdfBytes;
    
  } catch (error) {
    console.error('Error converting PDF page to image:', error);
    throw error;
  }
}

/**
 * Validate PDF template structure
 * @param {Object} template - Template object
 * @returns {Object} - Validation result
 */
export function validatePdfTemplate(template) {
  const errors = [];
  
  if (!template.name) {
    errors.push('Template name is required');
  }
  
  if (!template.category) {
    errors.push('Template category is required');
  }
  
  if (!template.isPdf) {
    errors.push('Template must be marked as PDF');
  }
  
  if (!template.pdfFilePath) {
    errors.push('PDF file path is required');
  }
  
  if (!template.totalPages || template.totalPages < 1) {
    errors.push('Invalid page count');
  }
  
  // Validate placeholders
  for (const placeholder of template.placeholders) {
    if (!placeholder.id) {
      errors.push('Placeholder ID is required');
    }
    
    if (!['text', 'image'].includes(placeholder.type)) {
      errors.push(`Invalid placeholder type: ${placeholder.type}`);
    }
    
    if (placeholder.pageIndex >= template.totalPages) {
      errors.push(`Placeholder page index ${placeholder.pageIndex} exceeds total pages`);
    }
    
    if (placeholder.x < 0 || placeholder.y < 0) {
      errors.push('Placeholder position cannot be negative');
    }
    
    if (placeholder.width <= 0 || placeholder.height <= 0) {
      errors.push('Placeholder dimensions must be positive');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Helper function to convert hex color to RGB
 * @param {string} hex - Hex color string
 * @returns {Object} - RGB values
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Create a blank PDF template
 * @param {number} width - Page width
 * @param {number} height - Page height
 * @param {number} pageCount - Number of pages
 * @returns {Buffer} - PDF buffer
 */
export async function createBlankPdf(width = 595, height = 842, pageCount = 1) {
  try {
    const pdfDoc = await PDFDocument.create();
    
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.addPage([width, height]);
      
      // Add a subtle border for reference
      page.drawRectangle({
        x: 10,
        y: 10,
        width: width - 20,
        height: height - 20,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
      });
      
      // Add page number
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText(`Page ${i + 1}`, {
        x: 50,
        y: height - 50,
        size: 12,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
    
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    console.error('Error creating blank PDF:', error);
    throw error;
  }
}