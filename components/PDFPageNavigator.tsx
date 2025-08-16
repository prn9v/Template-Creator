import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';

interface PDFPageNavigatorProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (direction: 'prev' | 'next') => void;
  showTitle?: boolean;
  compact?: boolean;
}

export default function PDFPageNavigator({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  showTitle = false,
  compact = false 
}: PDFPageNavigatorProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-2'}`}>
      {showTitle && (
        <div className="flex items-center text-blue-700 mr-3">
          <FileText className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">PDF</span>
        </div>
      )}
      
      <button
        onClick={() => onPageChange('prev')}
        disabled={currentPage === 0}
        className={`${compact ? 'p-1' : 'p-2'} rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
        title="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      
      <span className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600 ${compact ? 'px-1' : 'px-2'} min-w-max`}>
        Page {currentPage + 1} of {totalPages}
      </span>
      
      <button
        onClick={() => onPageChange('next')}
        disabled={currentPage === totalPages - 1}
        className={`${compact ? 'p-1' : 'p-2'} rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
        title="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}