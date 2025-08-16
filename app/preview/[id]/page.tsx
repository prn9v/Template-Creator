'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, Edit } from 'lucide-react';
import Link from 'next/link';

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
}

export default function PreviewPage() {
  const params = useParams();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchTemplate(params.id as string);
    }
  }, [params.id]);

  const fetchTemplate = async (id: string) => {
    try {
      const response = await fetch(`/api/templates/${id}`);
      if (response.ok) {
        const templateData = await response.json();
        setTemplate(templateData);
      }
    } catch (error) {
      console.error('Error fetching template:', error);
    } finally {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-gray-50">
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
              <h1 className="text-3xl font-bold text-gray-900">{template.name}</h1>
              <p className="text-gray-600">{template.description}</p>
              <span className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full mt-2">
                {template.category}
              </span>
            </div>
          </div>
          <Link
            href={`/customize/${template._id}`}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors flex items-center"
          >
            <Edit className="w-4 h-4 mr-2" />
            Customize Template
          </Link>
        </div>

        {/* Template Preview */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Template Preview</h2>
          <div className="flex justify-center">
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div
                className="relative"
                style={{ width: template.width, height: template.height }}
              >
                <img
                  src={template.backgroundImage}
                  alt="Template background"
                  className="w-full h-full object-cover"
                />
                
                {/* Placeholder indicators */}
                {template.placeholders.map((placeholder) => (
                  <div
                    key={placeholder.id}
                    className="absolute border-2 border-dashed border-blue-400 bg-blue-100 bg-opacity-30 flex items-center justify-center"
                    style={{
                      left: placeholder.x,
                      top: placeholder.y,
                      width: placeholder.width,
                      height: placeholder.height
                    }}
                  >
                    <span className="text-blue-600 text-xs font-medium bg-white px-2 py-1 rounded">
                      {placeholder.placeholder || `${placeholder.type} field`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Template Info */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-md font-semibold mb-2">Template Details</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>Dimensions:</strong> {template.width} × {template.height}px</p>
                <p><strong>Placeholders:</strong> {template.placeholders.length}</p>
                <p><strong>Text Fields:</strong> {template.placeholders.filter(p => p.type === 'text').length}</p>
                <p><strong>Image Fields:</strong> {template.placeholders.filter(p => p.type === 'image').length}</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-md font-semibold mb-2">Required Fields</h3>
              <div className="space-y-1">
                {template.placeholders
                  .filter(p => p.required)
                  .map((placeholder) => (
                    <div key={placeholder.id} className="text-sm text-gray-600">
                      • {placeholder.placeholder || `${placeholder.type} field`}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
