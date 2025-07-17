import React, { useState } from 'react';
import { X, Plus, ShoppingCart, Package, Info, Star, Truck, Shield, Check } from 'lucide-react';

// TypeScript interfaces
interface Part {
  id: string;
  part_number: string;
  description: string;
  manufacturer: string;
  category: string;
  list_price: string | number;
  compatible_models: string[] | string;
  image_url?: string;
  in_stock: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CartItem extends Part {
  quantity: number;
  unit_price: number;
  discounted_price: number;
  line_total: number;
}

interface ProductDetailModalProps {
  part: Part | null;
  userDiscount: number;
  onClose: () => void;
  onAddToCart: (part: Part) => void;
  isInCart: boolean;
  cartQuantity: number;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  part,
  userDiscount,
  onClose,
  onAddToCart,
  isInCart,
  cartQuantity
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  if (!part) return null;

  // Create placeholder image if needed
  const createPlaceholderImage = (text: string): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, 400, 400);
      ctx.fillStyle = '#6b7280';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 200, 200);
    }
    
    return canvas.toDataURL();
  };

  const placeholderImageUrl = createPlaceholderImage('No Image');

  // Calculate pricing
  const unitPrice = typeof part.list_price === 'string' ? parseFloat(part.list_price) : part.list_price;
  const discountAmount = unitPrice * (userDiscount / 100);
  const discountedPrice = unitPrice - discountAmount;
  const totalPrice = discountedPrice * quantity;

  // Format compatible models
  const compatibleModels = Array.isArray(part.compatible_models) 
    ? part.compatible_models 
    : typeof part.compatible_models === 'string' 
      ? [part.compatible_models] 
      : [];

  // Sample additional images (in real app, you'd have multiple images)
  const images = [
    part.image_url || placeholderImageUrl,
    placeholderImageUrl, // Could be different angles
    placeholderImageUrl
  ];

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      onAddToCart(part);
    }
    setQuantity(1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{part.part_number}</h2>
                <p className="text-gray-600">Part Details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row max-h-[calc(90vh-100px)]">
          {/* Left side - Images */}
          <div className="lg:w-1/2 p-6 bg-gray-50">
            <div className="space-y-4">
              {/* Main image */}
              <div className="relative bg-white rounded-xl shadow-sm overflow-hidden">
                <img
                  src={images[selectedImage]}
                  alt={part.description}
                  className="w-full h-96 object-cover"
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    const target = e.target as HTMLImageElement;
                    target.src = placeholderImageUrl;
                  }}
                />
                
                {/* Stock status badge */}
                <div className="absolute top-4 left-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    part.in_stock 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {part.in_stock ? (
                      <><Check size={16} className="mr-1" /> In Stock</>
                    ) : (
                      'Out of Stock'
                    )}
                  </span>
                </div>
              </div>

              {/* Thumbnail images */}
              <div className="flex gap-2">
                {images.slice(0, 3).map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === index 
                        ? 'border-blue-500 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={image}
                      alt={`View ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right side - Details */}
          <div className="lg:w-1/2 p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Product info */}
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{part.description}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <span className="bg-gray-100 px-3 py-1 rounded-full">{part.manufacturer}</span>
                  <span className="bg-blue-100 px-3 py-1 rounded-full text-blue-700">{part.category}</span>
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <div className="space-y-3">
                  {userDiscount > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-medium text-gray-600">Your Price:</span>
                        <span className="text-3xl font-bold text-green-600">${discountedPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">List Price:</span>
                        <span className="text-gray-500 line-through">${unitPrice.toFixed(2)}</span>
                      </div>
                      <div className="bg-green-100 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-green-700">
                          <Star size={16} />
                          <span className="font-medium">You save ${discountAmount.toFixed(2)} ({userDiscount}% discount)</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium text-gray-600">Price:</span>
                      <span className="text-3xl font-bold text-gray-900">${unitPrice.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Specifications */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Info size={20} />
                  Specifications
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="font-medium text-gray-600">Part Number:</span>
                    <span className="font-mono text-gray-900">{part.part_number}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="font-medium text-gray-600">Manufacturer:</span>
                    <span className="text-gray-900">{part.manufacturer}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="font-medium text-gray-600">Category:</span>
                    <span className="text-gray-900">{part.category}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="font-medium text-gray-600">Availability:</span>
                    <span className={`font-medium ${part.in_stock ? 'text-green-600' : 'text-red-600'}`}>
                      {part.in_stock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Compatible models */}
              {compatibleModels.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">Compatible Models</h3>
                  <div className="flex flex-wrap gap-2">
                    {compatibleModels.map((model, index) => (
                      <span 
                        key={index}
                        className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium"
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Features */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Features</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Truck className="w-5 h-5 text-blue-500" />
                    <span>Fast shipping available</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Shield className="w-5 h-5 text-green-500" />
                    <span>Manufacturer warranty included</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Check className="w-5 h-5 text-purple-500" />
                    <span>Quality guaranteed OEM part</span>
                  </div>
                </div>
              </div>

              {/* Quantity and Add to Cart */}
              <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium text-gray-900">Quantity:</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center border shadow-sm transition-colors"
                    >
                      -
                    </button>
                    <span className="w-12 text-center font-medium text-lg">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center border shadow-sm transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {quantity > 1 && (
                  <div className="text-center text-gray-600">
                    Total: <span className="font-bold text-gray-900">${totalPrice.toFixed(2)}</span>
                  </div>
                )}

                <button
                  onClick={handleAddToCart}
                  disabled={!part.in_stock}
                  className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 ${
                    part.in_stock
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {part.in_stock ? (
                    <div className="flex items-center justify-center gap-2">
                      {isInCart ? (
                        <>
                          <ShoppingCart size={20} />
                          Add More to Cart ({cartQuantity} in cart)
                        </>
                      ) : (
                        <>
                          <Plus size={20} />
                          Add to Quote Cart
                        </>
                      )}
                    </div>
                  ) : (
                    'Out of Stock'
                  )}
                </button>

                {isInCart && (
                  <div className="text-center text-sm text-green-600 font-medium">
                    ✓ Already in cart ({cartQuantity} items)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;