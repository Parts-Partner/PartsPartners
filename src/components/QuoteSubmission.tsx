import React, { useState } from 'react';
import { Send, FileText, Mail, User, Building, Phone, MessageSquare, DollarSign, Package } from 'lucide-react';

// TypeScript interfaces - Updated to match new database structure
interface Manufacturer {
  id: string;
  make: string;
  manufacturer: string;
}

interface Part {
  id: string;
  part_number: string;
  part_description: string; // Updated from 'description'
  category: string;
  list_price: string | number;
  compatible_models: string[] | string;
  image_url?: string;
  in_stock: boolean;
  created_at?: string;
  updated_at?: string;
  manufacturer_id: string; // New field
  make_part_number?: string; // New field
  manufacturer?: Manufacturer; // Joined manufacturer data
}

interface CartItem extends Part {
  quantity: number;
  unit_price: number;
  discounted_price: number;
  line_total: number;
}

interface QuoteFormData {
  customer_name: string;
  company_name: string;
  email: string;
  phone: string;
  notes: string;
}

interface QuoteSubmissionProps {
  cartItems: CartItem[];
  userDiscount: number;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

const QuoteSubmission: React.FC<QuoteSubmissionProps> = ({ 
  cartItems, 
  userDiscount, 
  onSubmitSuccess, 
  onClose 
}) => {
  const [formData, setFormData] = useState<QuoteFormData>({
    customer_name: '',
    company_name: '',
    email: '',
    phone: '',
    notes: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const discountAmount = subtotal * (userDiscount / 100);
  const total = subtotal - discountAmount;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.customer_name.trim()) return false;
    if (!formData.email.trim()) return false;
    if (!formData.email.includes('@')) return false;
    return true;
  };

  // Generate CSV content
  const generateCSV = (): string => {
    const headers = [
      'Part Number',
      'Description',
      'Manufacturer',
      'Make',
      'Make Part Number',
      'Category',
      'Quantity',
      'Unit Price',
      'Discounted Price',
      'Line Total',
      'Compatible Models'
    ];
    
    const rows = cartItems.map(item => [
      item.part_number,
      `"${item.part_description}"`,
      item.manufacturer?.manufacturer || 'N/A',
      item.manufacturer?.make || 'N/A',
      item.make_part_number || 'N/A',
      item.category,
      item.quantity.toString(),
      `$${item.unit_price.toFixed(2)}`,
      `$${item.discounted_price.toFixed(2)}`,
      `$${item.line_total.toFixed(2)}`,
      `"${Array.isArray(item.compatible_models) ? item.compatible_models.join(', ') : item.compatible_models || 'Universal'}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    
    // Add summary rows
    const summaryRows = [
      '',
      `Subtotal,$${subtotal.toFixed(2)}`,
      `Discount (${userDiscount}%),-$${discountAmount.toFixed(2)}`,
      `Total,$${total.toFixed(2)}`,
      '',
      'Customer Information:',
      `Name,${formData.customer_name}`,
      `Company,${formData.company_name}`,
      `Email,${formData.email}`,
      `Phone,${formData.phone}`,
      `Notes,"${formData.notes}"`
    ];
    
    return csvContent + '\n' + summaryRows.join('\n');
  };

  // Generate PDF content (HTML that can be converted to PDF)
  const generatePDFHTML = (): string => {
    const currentDate = new Date().toLocaleDateString();
    const quoteNumber = `Q${Date.now()}`;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Quote ${quoteNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
        .company-name { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 5px; }
        .quote-title { font-size: 20px; margin-bottom: 10px; }
        .quote-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .customer-info, .quote-details { width: 48%; }
        .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #2563eb; }
        .info-row { margin-bottom: 5px; }
        .parts-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .parts-table th, .parts-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .parts-table th { background-color: #f8f9fa; font-weight: bold; }
        .total-section { margin-top: 20px; text-align: right; }
        .total-row { margin-bottom: 5px; }
        .total-final { font-size: 18px; font-weight: bold; color: #2563eb; }
        .notes-section { margin-top: 30px; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">Parts Partner</div>
        <div class="quote-title">PRICE QUOTE</div>
      </div>
      
      <div class="quote-info">
        <div class="customer-info">
          <div class="section-title">Bill To:</div>
          <div class="info-row"><strong>${formData.customer_name}</strong></div>
          ${formData.company_name ? `<div class="info-row">${formData.company_name}</div>` : ''}
          <div class="info-row">${formData.email}</div>
          ${formData.phone ? `<div class="info-row">${formData.phone}</div>` : ''}
        </div>
        
        <div class="quote-details">
          <div class="section-title">Quote Details:</div>
          <div class="info-row"><strong>Quote #:</strong> ${quoteNumber}</div>
          <div class="info-row"><strong>Date:</strong> ${currentDate}</div>
          <div class="info-row"><strong>Valid Until:</strong> ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
        </div>
      </div>
      
      <table class="parts-table">
        <thead>
          <tr>
            <th>Part Number</th>
            <th>Description</th>
            <th>Manufacturer</th>
            <th>Make</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Discounted Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${cartItems.map(item => `
            <tr>
              <td>${item.part_number}</td>
              <td>${item.part_description}</td>
              <td>${item.manufacturer?.manufacturer || 'N/A'}</td>
              <td>${item.manufacturer?.make || 'N/A'}</td>
              <td>${item.quantity}</td>
              <td>$${item.unit_price.toFixed(2)}</td>
              <td>$${item.discounted_price.toFixed(2)}</td>
              <td>$${item.line_total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="total-section">
        <div class="total-row">Subtotal: $${subtotal.toFixed(2)}</div>
        ${userDiscount > 0 ? `<div class="total-row">Discount (${userDiscount}%): -$${discountAmount.toFixed(2)}</div>` : ''}
        <div class="total-row total-final">Total: $${total.toFixed(2)}</div>
      </div>
      
      ${formData.notes ? `
        <div class="notes-section">
          <div class="section-title">Notes:</div>
          <div>${formData.notes}</div>
        </div>
      ` : ''}
      
      <div class="footer">
        <p>Thank you for your business!</p>
        <p>This quote is valid for 30 days from the date above.</p>
      </div>
    </body>
    </html>
    `;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      setSubmitResult({
        success: false,
        message: 'Please fill in all required fields with valid information.'
      });
      return;
    }
    
    if (cartItems.length === 0) {
      setSubmitResult({
        success: false,
        message: 'Your cart is empty. Please add some parts before submitting a quote.'
      });
      return;
    }
    
    setIsSubmitting(true);
    setSubmitResult(null);
    
    try {
      // Generate CSV and PDF content
      const csvContent = generateCSV();
      const pdfHTML = generatePDFHTML();
      
      // Create downloadable files
      const csvBlob = new Blob([csvContent], { type: 'text/csv' });
      const pdfBlob = new Blob([pdfHTML], { type: 'text/html' });
      
      // In a real implementation, you would send this to your backend
      // For now, we'll simulate the email sending process
      await simulateEmailSending(csvBlob, pdfBlob);
      
      setSubmitResult({
        success: true,
        message: 'Quote submitted successfully! Email sent to Tbanschb@gmail.com with CSV and PDF attachments.'
      });
      
      // Call success callback after a short delay
      setTimeout(() => {
        onSubmitSuccess();
      }, 2000);
      
    } catch (error) {
      setSubmitResult({
        success: false,
        message: 'Failed to submit quote. Please try again or contact support.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const simulateEmailSending = async (csvBlob: Blob, pdfBlob: Blob): Promise<void> => {
    // Convert blobs to base64 for sending to Netlify function
    const csvBase64 = await blobToBase64(csvBlob);
    const pdfBase64 = await blobToBase64(pdfBlob);
    
    // Generate unique filename timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quoteNumber = `Q${Date.now()}`;
    
    // Send to Netlify function
    const response = await fetch('/.netlify/functions/send-quote-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        formData,
        csvContent: csvBase64,
        pdfContent: pdfBase64,
        quoteNumber,
        timestamp
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to send email');
    }
    
    const result = await response.json();
    console.log('Email sent successfully:', result);
  };

  // Helper function to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]); // Remove data:type;base64, prefix
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="text-white" size={24} />
              <h2 className="text-xl font-bold text-white">Submit Quote Request</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row max-h-[calc(90vh-80px)]">
          {/* Left side - Form */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User size={16} className="inline mr-1" />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Building size={16} className="inline mr-1" />
                    Company Name
                  </label>
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ABC Company"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail size={16} className="inline mr-1" />
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone size={16} className="inline mr-1" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MessageSquare size={16} className="inline mr-1" />
                  Additional Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any special requirements or questions..."
                />
              </div>

              {/* Submit Result */}
              {submitResult && (
                <div className={`p-4 rounded-lg border ${
                  submitResult.success 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {submitResult.success ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-red-600">✗</span>
                    )}
                    {submitResult.message}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Submitting Quote...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Submit Quote Request
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right side - Quote Summary */}
          <div className="w-full lg:w-96 bg-gray-50 p-6 border-l border-gray-200 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package size={20} />
              Quote Summary
            </h3>

            <div className="space-y-4">
              {cartItems.map((item) => (
                <div key={item.id} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.part_number}</h4>
                      <p className="text-sm text-gray-600 line-clamp-2">{item.part_description}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm text-gray-500">Qty: {item.quantity}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">
                      {item.manufacturer?.manufacturer || 'N/A'} - {item.manufacturer?.make || 'N/A'}
                    </span>
                    <div className="text-right">
                      {userDiscount > 0 ? (
                        <div>
                          <span className="text-green-600 font-medium">
                            ${item.discounted_price.toFixed(2)}
                          </span>
                          <span className="text-gray-400 line-through ml-1">
                            ${item.unit_price.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-medium">${item.unit_price.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {userDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({userDiscount}%):</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span>Total:</span>
                  <span className="text-blue-600">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Email Info */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
                <Mail size={16} />
                Email Details
              </div>
              <div className="text-sm text-blue-700">
                <p>Quote will be sent to:</p>
                <p className="font-medium">Tbanschb@gmail.com</p>
                <p className="mt-2">Includes:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Detailed PDF quote</li>
                  <li>CSV file with parts data</li>
                  <li>Customer information</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteSubmission;