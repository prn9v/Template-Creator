import { NextResponse } from 'next/server';
import path from 'path';
import dbConnect from '@/lib/mongodb';
import Template from '@/lib/models/Template';
import { uploadToCloudinary } from '@/lib/cloudinary';

export async function GET() {
  try {
    await dbConnect();
    const templates = await Template.find({ isActive: true }).sort({ createdAt: -1 });
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await dbConnect();
    const formData = await request.formData();
    
    const file = formData.get('file');
    const templateData = formData.get('template');
    
    if (!templateData) {
      return NextResponse.json({ error: 'Template data is required' }, { status: 400 });
    }
    
    const template = JSON.parse(templateData);
    let backgroundImagePath = template.backgroundImage;
    const isPdf = file && file.type === 'application/pdf';
    
    // Handle file upload with retry logic
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = path.extname(file.name);
      const filename = `template-${timestamp}${fileExtension}`;
      
      // Determine resource type for Cloudinary
      const resourceType = isPdf ? 'raw' : 'image';
      
      // Upload to Cloudinary with retry logic
      let uploadResult;
      let retries = 3;
      
      while (retries > 0) {
        try {
          uploadResult = await Promise.race([
            uploadToCloudinary(buffer, filename, resourceType),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Upload timeout')), 60000)
            )
          ]);
          break;
        } catch (error) {
          retries--;
          console.error(`Upload attempt failed (${3 - retries}/3):`, error);
          
          if (retries === 0) {
            throw new Error(`Failed to upload after 3 attempts: ${error.message}`);
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      backgroundImagePath = uploadResult.secure_url;
    }
    
    const newTemplate = new Template({
      name: template.name,
      description: template.description,
      category: template.category,
      backgroundImage: backgroundImagePath,
      width: template.width,
      height: template.height,
      placeholders: template.placeholders,
      isPdf: isPdf, // Set isPdf based on file type
      pdfFilePath: isPdf ? backgroundImagePath : undefined, // Set PDF file path for PDF templates
      totalPages: isPdf ? (template.totalPages || 1) : undefined, // Set total pages for PDF templates
      isActive: true,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedTemplate = await newTemplate.save();
    return NextResponse.json(savedTemplate, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create template';
    if (error.message.includes('Upload timeout')) {
      errorMessage = 'File upload timed out. Please try with a smaller file or check your internet connection.';
    } else if (error.message.includes('ECONNRESET')) {
      errorMessage = 'Connection was reset during upload. Please try again.';
    } else if (error.message.includes('Failed to upload after')) {
      errorMessage = 'Multiple upload attempts failed. Please check your file and try again.';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error.message 
    }, { status: 500 });
  }
}