import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Clock, DollarSign, Package, AlertCircle, CheckCircle, Zap } from 'lucide-react';

interface CartItem {
  id: string;
  part_number: string;
  quantity: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  hazmat?: boolean;
}

interface ShippingAddress {
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface UPSService {
  service_code: string;
  service_name: string;
  total_charges: number;
  customer_rate: number; // With 40% markup
  transit_days?: string;
  delivery_date?: string;
}

interface FreightCalculatorProps {
  cartItems: CartItem[];
  onFreightSelect: (service: UPSService) => void;
  selectedFreight?: UPSService | null;
}

const MockUPSFreightCalculator: React.FC<FreightCalculatorProps> = ({
  cartItems,
  onFreightSelect,
  selectedFreight
}) => {
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    address_line1: '',
    city: '',
    state: '',
    zip: '',
    country: 'US'
  });

  const [availableServices, setAvailableServices] = useState<UPSService[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [addressValid, setAddressValid] = useState(false);

  // Calculate total package weight and dimensions
  const calculatePackageDetails = () => {
    let totalWeight = 0;
    let totalVolume = 0;
    let hasHazmat = false;

    cartItems.forEach(item => {
      const weight = item.weight || 1; // Default 1 lb if no weight
      const length = item.length || 12;
      const width = item.width || 12;
      const height = item.height || 6;
      
      totalWeight += weight * item.quantity;
      totalVolume += (length * width * height) * item.quantity;
      
      if (item.hazmat) hasHazmat = true;
    });

    // Estimate package dimensions (simple cube root for now)
    const estimatedDimension = Math.ceil(Math.cbrt(totalVolume));
    
    return {
      weight: Math.max(totalWeight, 1), // Minimum 1 lb
      length: Math.min(estimatedDimension, 108), // UPS max 108"
      width: Math.min(estimatedDimension, 108),
      height: Math.min(estimatedDimension, 108),
      hasHazmat,
      isLTL: totalWeight > 150 // Use LTL for shipments over 150 lbs
    };
  };

  // Mock address validation (just check if fields are filled)
  const validateAddress = async (address: ShippingAddress): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay

    if (!address.address_line1 || !address.city || !address.state || !address.zip) {
      setError('Please fill in all address fields');
      return false;
    }

    if (address.zip.length < 5) {
      setError('Please enter a valid ZIP code');
      return false;
    }

    setAddressValid(true);
    return true;
  };

  // Mock shipping rates calculation
  const getMockShippingRates = async () => {
    if (!shippingAddress.address_line1 || !shippingAddress.city || !shippingAddress.zip) {
      setError('Please enter a complete shipping address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Mock address validation
      const isValid = await validateAddress(shippingAddress);
      if (!isValid) {
        setLoading(false);
        return;
      }

      const packageDetails = calculatePackageDetails();
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Generate mock rates based on package details and destination
      const mockServices = generateMockRates(packageDetails, shippingAddress);
      setAvailableServices(mockServices);

    } catch (error) {
      setError('Failed to get shipping rates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generate realistic mock shipping rates
  const generateMockRates = (packageDetails: any, destination: ShippingAddress): UPSService[] => {
    const services: UPSService[] = [];
    
    // Base rate calculation factors
    const weightFactor = packageDetails.weight * 0.85;
    const distanceFactor = getDistanceFactor(destination.state);
    const baseCost = weightFactor * distanceFactor;

    if (packageDetails.isLTL) {
      // LTL Freight rates
      const freightCost = Math.max(baseCost * 2.5, 150); // Minimum $150 for freight
      services.push({
        service_code: 'FREIGHT',
        service_name: 'UPS Freight LTL',
        total_charges: freightCost,
        customer_rate: freightCost * 1.40, // 40% markup
        transit_days: '3-5'
      });

      if (packageDetails.weight < 500) {
        const expeditedFreight = freightCost * 1.6;
        services.push({
          service_code: 'FREIGHT_EXP',
          service_name: 'UPS Freight Express',
          total_charges: expeditedFreight,
          customer_rate: expeditedFreight * 1.40,
          transit_days: '2-3'
        });
      }
    } else {
      // Small package rates
      const groundCost = Math.max(baseCost, 12.50);
      const twoDayCost = groundCost * 2.1;
      const nextDayCost = groundCost * 4.2;

      services.push({
        service_code: '03',
        service_name: 'UPS Ground',
        total_charges: groundCost,
        customer_rate: groundCost * 1.40,
        transit_days: getGroundTransitDays(destination.state)
      });

      services.push({
        service_code: '02',
        service_name: 'UPS 2nd Day Air',
        total_charges: twoDayCost,
        customer_rate: twoDayCost * 1.40,
        transit_days: '2'
      });

      services.push({
        service_code: '01',
        service_name: 'UPS Next Day Air',
        total_charges: nextDayCost,
        customer_rate: nextDayCost * 1.40,
        transit_days: '1'
      });

      // Add 3 Day Select for lighter packages
      if (packageDetails.weight < 50) {
        const threeDayCost = groundCost * 1.4;
        services.push({
          service_code: '12',
          service_name: 'UPS 3 Day Select',
          total_charges: threeDayCost,
          customer_rate: threeDayCost * 1.40,
          transit_days: '3'
        });
      }
    }

    // Add hazmat surcharge if needed
    if (packageDetails.hasHazmat) {
      services.forEach(service => {
        const hazmatFee = 35;
        service.total_charges += hazmatFee;
        service.customer_rate += hazmatFee * 1.40;
      });
    }

    return services.sort((a, b) => a.customer_rate - b.customer_rate);
  };

  // Mock distance factor based on state (simulates shipping zones)
  const getDistanceFactor = (state: string): number => {
    const zoneFactors: { [key: string]: number } = {
      // Zone 1 (close) - assuming warehouse in midwest
      'IL': 1.0, 'IN': 1.0, 'OH': 1.0, 'MI': 1.0, 'WI': 1.0,
      // Zone 2 (regional)
      'MO': 1.2, 'IA': 1.2, 'KY': 1.2, 'TN': 1.3, 'KS': 1.3,
      // Zone 3 (medium distance)
      'TX': 1.5, 'FL': 1.6, 'GA': 1.4, 'NC': 1.4, 'VA': 1.4,
      // Zone 4 (far)
      'CA': 2.0, 'WA': 2.1, 'OR': 2.0, 'NV': 1.9,
      // Zone 5 (very far)
      'AK': 3.5, 'HI': 4.0
    };
    return zoneFactors[state] || 1.5; // Default to zone 3
  };

  // Mock ground transit days
  const getGroundTransitDays = (state: string): string => {
    const transitDays: { [key: string]: string } = {
      'IL': '1', 'IN': '1', 'OH': '2', 'MI': '2', 'WI': '2',
      'MO': '2', 'IA': '2', 'KY': '2', 'TN': '3', 'KS': '3',
      'TX': '3', 'FL': '4', 'GA': '3', 'NC': '3', 'VA': '3',
      'CA': '5', 'WA': '5', 'OR': '5', 'NV': '4',
      'AK': '7', 'HI': '7'
    };
    return transitDays[state] || '3';
  };

  const getServiceIcon = (serviceCode: string) => {
    if (serviceCode === 'FREIGHT' || serviceCode === 'FREIGHT_EXP') return <Truck className="w-5 h-5" />;
    if (serviceCode === '01' || serviceCode === '13' || serviceCode === '14') return <Clock className="w-5 h-5" />;
    return <Package className="w-5 h-5" />;
  };

  const formatTransitTime = (days: string) => {
    if (days.includes('-')) return `${days} business days`;
    const numDays = parseInt(days);
    if (numDays === 1) return '1 business day';
    return `${numDays} business days`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Truck className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Shipping Calculator</h3>
        <div className="ml-auto flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
          <Zap className="w-3 h-3" />
          DEMO MODE
        </div>
      </div>

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 text-blue-800 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium">Testing Mode:</span>
        </div>
        <p className="text-blue-700 text-sm mt-1">
          Using mock UPS rates with realistic pricing. Real UPS API integration ready for when your developer account is approved!
        </p>
      </div>

      {/* Shipping Address Form */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Shipping Address</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Street Address"
              value={shippingAddress.address_line1}
              onChange={(e) => setShippingAddress(prev => ({ ...prev, address_line1: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <input
            type="text"
            placeholder="City"
            value={shippingAddress.city}
            onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={shippingAddress.state}
              onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">State</option>
              <option value="AL">AL</option>
              <option value="AK">AK</option>
              <option value="AZ">AZ</option>
              <option value="AR">AR</option>
              <option value="CA">CA</option>
              <option value="CO">CO</option>
              <option value="CT">CT</option>
              <option value="DE">DE</option>
              <option value="FL">FL</option>
              <option value="GA">GA</option>
              <option value="HI">HI</option>
              <option value="ID">ID</option>
              <option value="IL">IL</option>
              <option value="IN">IN</option>
              <option value="IA">IA</option>
              <option value="KS">KS</option>
              <option value="KY">KY</option>
              <option value="LA">LA</option>
              <option value="ME">ME</option>
              <option value="MD">MD</option>
              <option value="MA">MA</option>
              <option value="MI">MI</option>
              <option value="MN">MN</option>
              <option value="MS">MS</option>
              <option value="MO">MO</option>
              <option value="MT">MT</option>
              <option value="NE">NE</option>
              <option value="NV">NV</option>
              <option value="NH">NH</option>
              <option value="NJ">NJ</option>
              <option value="NM">NM</option>
              <option value="NY">NY</option>
              <option value="NC">NC</option>
              <option value="ND">ND</option>
              <option value="OH">OH</option>
              <option value="OK">OK</option>
              <option value="OR">OR</option>
              <option value="PA">PA</option>
              <option value="RI">RI</option>
              <option value="SC">SC</option>
              <option value="SD">SD</option>
              <option value="TN">TN</option>
              <option value="TX">TX</option>
              <option value="UT">UT</option>
              <option value="VT">VT</option>
              <option value="VA">VA</option>
              <option value="WA">WA</option>
              <option value="WV">WV</option>
              <option value="WI">WI</option>
              <option value="WY">WY</option>
            </select>

            <input
              type="text"
              placeholder="ZIP"
              value={shippingAddress.zip}
              onChange={(e) => setShippingAddress(prev => ({ ...prev, zip: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <button
          onClick={getMockShippingRates}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Getting Rates...
            </>
          ) : (
            <>
              <DollarSign className="w-4 h-4" />
              Get Shipping Rates
            </>
          )}
        </button>
      </div>

      {/* Address Validation Status */}
      {addressValid && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-800">Address validated successfully</span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      {/* Package Information */}
      {cartItems.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Package Details</h4>
          {(() => {
            const details = calculatePackageDetails();
            return (
              <div className="text-sm text-gray-600 space-y-1">
                <p>Total Weight: {details.weight.toFixed(1)} lbs</p>
                <p>Estimated Dimensions: {details.length}" × {details.width}" × {details.height}"</p>
                <p>Service Type: {details.isLTL ? 'LTL Freight' : 'Small Package'}</p>
                {details.hasHazmat && (
                  <p className="text-orange-600 font-medium">⚠️ Contains hazardous materials</p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Available Services */}
      {availableServices.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Available Shipping Options</h4>
          
          {availableServices.map((service, index) => (
            <div
              key={index}
              onClick={() => onFreightSelect(service)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedFreight?.service_code === service.service_code
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getServiceIcon(service.service_code)}
                  <div>
                    <div className="font-medium text-gray-900">{service.service_name}</div>
                    <div className="text-sm text-gray-600">
                      {formatTransitTime(service.transit_days || '3')}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    ${service.customer_rate.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Freight
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedFreight && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="font-medium text-blue-900">Selected Shipping:</span>
            <span className="font-bold text-blue-900">
              {selectedFreight.service_name} - ${selectedFreight.customer_rate.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MockUPSFreightCalculator;