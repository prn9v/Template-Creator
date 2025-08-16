import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import dbConnect from '@/lib/mongodb';
import Template from '@/lib/models/Template';

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
    
    // Handle file upload
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = path.extname(file.name);
      const filename = `template-${timestamp}${fileExtension}`;
      const filepath = path.join(uploadsDir, filename);
      
      // Save file
      await writeFile(filepath, buffer);
      backgroundImagePath = `/uploads/${filename}`;
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
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}