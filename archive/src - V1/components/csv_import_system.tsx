import React, { useState, useRef } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, X, FileText, RefreshCw } from 'lucide-react';

interface UploadResult {
  success: boolean;
  message: string;
  details?: string | null;
  processed?: number;
  successful?: number;
  failed?: number;
  errors?: string[];
}

interface SyncRecord {
  id: number;
  filename: string;
  timestamp: string;
  status: 'completed' | 'failed';
  processed: number;
  successful: number;
  failed: number;
  errors?: string[];
}

interface CSVPreview {
  filename: string;
  data: string[][];
  rowCount: number;
}

const CSVImportSystem = () => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CSVPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sample CSV template data
  const csvTemplate = [
    ['part_number', 'description', 'manufacturer', 'category', 'list_price', 'compatible_models', 'in_stock'],
    ['123456', 'Compressor for XYZ fridge', 'True', 'Compressor', '119.00', 'T-23,T-49', 'true'],
    ['789012', 'Door Seal Assembly', 'True', 'Seals', '45.50', 'T-23,T-49,T-56', 'true'],
    ['345678', 'Thermostat Control', 'True', 'Controls', '78.25', 'T-23', 'true']
  ];

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadResult({
        success: false,
        message: 'Please upload a CSV file only.',
        details: null
      });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      // Read and parse CSV file
      const text = await file.text();
      const parsedData = parseCSV(text);
      
      // Show preview
      setCsvPreview({
        filename: file.name,
        data: parsedData,
        rowCount: parsedData.length - 1 // Exclude header
      });
      setShowPreview(true);
      
    } catch (error) {
      setUploadResult({
        success: false,
        message: 'Error reading CSV file',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setUploading(false);
    }
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.trim().split('\n');
    return lines.map((line: string) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(current.trim());
      return result;
    });
  };

  const processImport = async () => {
    if (!csvPreview) return;
    
    setUploading(true);
    
    try {
      // Simulate processing the CSV data
      const results = await simulateCSVProcessing(csvPreview.data);
      
      setUploadResult(results);
      
      // Add to sync history
      const newSyncRecord: SyncRecord = {
        id: Date.now(),
        filename: csvPreview.filename,
        timestamp: new Date().toISOString(),
        status: results.success ? 'completed' : 'failed',
        processed: results.processed || 0,
        successful: results.successful || 0,
        failed: results.failed || 0,
        errors: results.errors
      };
      
      setSyncHistory(prev => [newSyncRecord, ...prev]);
      setShowPreview(false);
      setCsvPreview(null);
      
    } catch (error) {
      setUploadResult({
        success: false,
        message: 'Error processing CSV data',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setUploading(false);
    }
  };

  const simulateCSVProcessing = async (data: string[][]): Promise<UploadResult> => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const headers = data[0];
    const rows = data.slice(1);
    
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];
    
    // Validate headers
    const requiredHeaders = ['part_number', 'description', 'manufacturer', 'category', 'list_price'];
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    
    if (missingHeaders.length > 0) {
      return {
        success: false,
        message: `Missing required columns: ${missingHeaders.join(', ')}`,
        processed: 0,
        successful: 0,
        failed: rows.length,
        errors: [`Missing columns: ${missingHeaders.join(', ')}`]
      };
    }
    
    // Process each row
    rows.forEach((row, index) => {
      const rowNum = index + 2; // +2 because index starts at 0 and we skip header
      
      // Basic validation
      if (!row[0] || !row[1]) { // part_number and description required
        failed++;
        errors.push(`Row ${rowNum}: Missing part number or description`);
        return;
      }
      
      if (isNaN(parseFloat(row[4]))) { // list_price must be numeric
        failed++;
        errors.push(`Row ${rowNum}: Invalid price format`);
        return;
      }
      
      successful++;
    });
    
    return {
      success: true,
      message: `Successfully processed ${successful} parts from ${csvPreview?.filename || 'uploaded file'}`,
      processed: rows.length,
      successful,
      failed,
      errors
    };
  };

  const downloadTemplate = () => {
    const csvContent = csvTemplate.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parts_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">CSV Import System</h1>
        <p className="text-gray-600">Upload daily CSV files to sync parts data with your inventory system.</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Upload Parts Data</h2>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download size={16} />
            Download Template
          </button>
        </div>

        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">
            Drop your CSV file here, or click to browse
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Supports CSV files up to 10MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Select File
          </button>
        </div>

        {/* Upload Result */}
        {uploadResult && (
          <div className={`mt-4 p-4 rounded-lg border ${
            uploadResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {uploadResult.success ? (
                <CheckCircle className="text-green-600" size={20} />
              ) : (
                <AlertCircle className="text-red-600" size={20} />
              )}
              <span className={`font-medium ${
                uploadResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {uploadResult.message}
              </span>
            </div>
            {uploadResult.details && (
              <p className="text-sm text-gray-600 mt-1">{uploadResult.details}</p>
            )}
            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-red-800">Errors:</p>
                <ul className="text-sm text-red-700 mt-1 space-y-1">
                  {uploadResult.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {uploading && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <RefreshCw className="text-blue-600 animate-spin" size={20} />
              <span className="text-blue-800 font-medium">Processing CSV file...</span>
            </div>
          </div>
        )}
      </div>

      {/* CSV Preview Modal */}
      {showPreview && csvPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">CSV Preview</h3>
                  <p className="text-sm text-gray-600">
                    {csvPreview.filename} • {csvPreview.rowCount} parts
                  </p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-auto max-h-96">
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {csvPreview.data[0]?.map((header, index) => (
                        <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.data.slice(1, 6).map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-2 text-sm text-gray-900 border-b">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvPreview.data.length > 6 && (
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    ... and {csvPreview.data.length - 6} more rows
                  </p>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={processImport}
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? 'Processing...' : 'Import Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync History */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sync History</h2>
        
        {syncHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>No sync history yet. Upload your first CSV file to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {syncHistory.map((record) => (
              <div key={record.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{record.filename}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      record.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {record.status}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{formatDate(record.timestamp)}</span>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Processed: {record.processed}</span>
                  <span className="text-green-600">Successful: {record.successful}</span>
                  {record.failed > 0 && (
                    <span className="text-red-600">Failed: {record.failed}</span>
                  )}
                </div>
                
                {record.errors && record.errors.length > 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs font-medium text-red-800 mb-1">Errors:</p>
                    <div className="text-xs text-red-700 space-y-1">
                      {record.errors.slice(0, 3).map((error, index) => (
                        <div key={index}>• {error}</div>
                      ))}
                      {record.errors.length > 3 && (
                        <div>... and {record.errors.length - 3} more errors</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVImportSystem;