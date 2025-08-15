// src/features/freight/MockUPSFreightCalculator.tsx
import React, { useMemo, useState } from 'react';
import { Truck, MapPin, Clock, DollarSign, Package, AlertCircle, CheckCircle, Zap } from 'lucide-react';

export interface UPSService {
  service_code: string;
  service_name: string;
  total_charges: number;   // internal cost (pre-markup)
  customer_rate: number;   // price you charge customer
  transit_days?: string;
  delivery_date?: string;
}

export interface CartItemLite {
  id: string;
  quantity: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  hazmat?: boolean;
}

export interface FreightCalculatorProps {
  /** Optional: if provided, we’ll estimate weight/dimensions for pricing */
  cartItems?: CartItemLite[];
  /** Called when a shipping option is picked */
  onSelect?: (svc: UPSService) => void;
  /** Currently selected service (for highlighting) */
  selected?: UPSService | null;
}

/** --- helpers ----------------------------------------------------------- */

type Address = { line1: string; city: string; state: string; zip: string; country: 'US' };

const ZONE_FACTOR: Record<string, number> = {
  // close to Midwest (pretend warehouse)
  IL: 1.0, IN: 1.0, OH: 1.0, MI: 1.0, WI: 1.0,
  // regional
  MO: 1.2, IA: 1.2, KY: 1.2, TN: 1.3, KS: 1.3,
  // medium distance
  TX: 1.5, FL: 1.6, GA: 1.4, NC: 1.4, VA: 1.4,
  // far
  CA: 2.0, WA: 2.1, OR: 2.0, NV: 1.9,
  // very far
  AK: 3.5, HI: 4.0
};

const GROUND_DAYS: Record<string, string> = {
  IL: '1', IN: '1', OH: '2', MI: '2', WI: '2', MO: '2', IA: '2', KY: '2',
  TN: '3', KS: '3', TX: '3', FL: '4', GA: '3', NC: '3', VA: '3',
  CA: '5', WA: '5', OR: '5', NV: '4', AK: '7', HI: '7'
};

const groundEta = (state: string) => GROUND_DAYS[state] || '3';
const zoneFactor = (state: string) => ZONE_FACTOR[state] || 1.5;
const fmtTransit = (days?: string) => !days ? '3 business days' : days.includes('-') ? `${days} business days` : (days === '1' ? '1 business day' : `${days} business days`);
const iconFor = (code: string) => (code.startsWith('FREIGHT') ? <Truck className="w-5 h-5" /> : (code === '01' ? <Clock className="w-5 h-5" /> : <Package className="w-5 h-5" />));

/** Very light package estimate — safe defaults when no cart data is passed */
function estimatePackage(cartItems?: CartItemLite[]) {
  if (!cartItems || cartItems.length === 0) {
    return { weight: 5, length: 12, width: 10, height: 6, hazmat: false, isLTL: false };
  }
  let weight = 0, volume = 0, haz = false;
  for (const i of cartItems) {
    const w = i.weight ?? 1;
    const L = i.length ?? 12, W = i.width ?? 12, H = i.height ?? 6;
    weight += w * i.quantity;
    volume += (L * W * H) * i.quantity;
    haz ||= !!i.hazmat;
  }
  const dim = Math.ceil(Math.cbrt(Math.max(volume, 1)));
  return {
    weight: Math.max(weight, 1),
    length: Math.min(dim, 108),
    width: Math.min(dim, 108),
    height: Math.min(dim, 108),
    hazmat: haz,
    isLTL: weight > 150
  };
}

function buildMockRates(addr: Address, pkg: ReturnType<typeof estimatePackage>): UPSService[] {
  const w = pkg.weight;
  const distance = zoneFactor(addr.state);
  const base = Math.max(w * 0.85 * distance, 12.5);

  const mark = (n: number) => n * 1.4; // 40% markup
  const out: UPSService[] = [];

  if (pkg.isLTL) {
    const ltl = Math.max(base * 2.5, 150);
    out.push({ service_code: 'FREIGHT', service_name: 'UPS Freight LTL', total_charges: ltl, customer_rate: mark(ltl), transit_days: '3-5' });
    if (w < 500) {
      const exp = ltl * 1.6;
      out.push({ service_code: 'FREIGHT_EXP', service_name: 'UPS Freight Express', total_charges: exp, customer_rate: mark(exp), transit_days: '2-3' });
    }
  } else {
    const ground = base;
    const twoDay = base * 2.1;
    const nextDay = base * 4.2;
    out.push({ service_code: '03', service_name: 'UPS Ground', total_charges: ground, customer_rate: mark(ground), transit_days: groundEta(addr.state) });
    out.push({ service_code: '02', service_name: 'UPS 2nd Day Air', total_charges: twoDay, customer_rate: mark(twoDay), transit_days: '2' });
    out.push({ service_code: '01', service_name: 'UPS Next Day Air', total_charges: nextDay, customer_rate: mark(nextDay), transit_days: '1' });
    if (w < 50) {
      const three = base * 1.4;
      out.push({ service_code: '12', service_name: 'UPS 3 Day Select', total_charges: three, customer_rate: mark(three), transit_days: '3' });
    }
  }

  if (pkg.hazmat) {
    for (const s of out) {
      s.total_charges += 35;
      s.customer_rate += 35 * 1.4;
    }
  }

  return out.sort((a, b) => a.customer_rate - b.customer_rate);
}

/** --- component --------------------------------------------------------- */

const MockUPSFreightCalculator: React.FC<FreightCalculatorProps> = ({ cartItems, onSelect, selected }) => {
  const [addr, setAddr] = useState<Address>({ line1: '', city: '', state: '', zip: '', country: 'US' });
  const [loading, setLoading] = useState(false);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState<string>('');
  const [quotes, setQuotes] = useState<UPSService[]>([]);

  const pkg = useMemo(() => estimatePackage(cartItems), [cartItems]);

  const validate = () => {
    if (!addr.line1 || !addr.city || !addr.state || addr.zip.length < 5) {
      setError('Please enter a complete US address.');
      setValidated(false);
      return false;
    }
    setError('');
    setValidated(true);
    return true;
  };

  const fetchRates = async () => {
    if (!validate()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));  // pretend API latency
    const res = buildMockRates(addr, pkg);
    setQuotes(res);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Truck className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Shipping Calculator</h3>
        <span className="ml-auto inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
          <Zap className="w-3 h-3" /> DEMO MODE
        </span>
      </div>

      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5" />
        Using realistic mock UPS rates. Swap to the real UPS APIs once your account is ready.
      </div>

      {/* Address */}
      <div className="space-y-4 mb-5">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Ship To</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="md:col-span-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Street Address"
            value={addr.line1}
            onChange={e=>setAddr(a=>({ ...a, line1: e.target.value }))}
          />
          <input
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="City"
            value={addr.city}
            onChange={e=>setAddr(a=>({ ...a, city: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              value={addr.state}
              onChange={e=>setAddr(a=>({ ...a, state: e.target.value }))}
            >
              <option value="">State</option>
              {'AL,AK,AZ,AR,CA,CO,CT,DE,FL,GA,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,OH,OK,OR,PA,RI,SC,SD,TN,TX,UT,VT,VA,WA,WV,WI,WY'
                .split(',')
                .map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="ZIP"
              value={addr.zip}
              onChange={e=>setAddr(a=>({ ...a, zip: e.target.value }))}
            />
          </div>
        </div>

        <button
          onClick={fetchRates}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Getting Rates…
            </>
          ) : (
            <>
              <DollarSign className="w-4 h-4" />
              Get Shipping Rates
            </>
          )}
        </button>
      </div>

      {validated && !error && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          <CheckCircle className="w-4 h-4" />
          Address validated
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Package summary (optional but nice) */}
      <div className="mb-5 p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
        <div className="font-medium mb-1">Package Estimate</div>
        <div>Weight: {pkg.weight.toFixed(1)} lbs</div>
        <div>Dims: {pkg.length}" × {pkg.width}" × {pkg.height}"</div>
        <div>Service Type: {pkg.isLTL ? 'LTL Freight' : 'Small Package'}</div>
        {pkg.hazmat && <div className="text-orange-600 font-medium">⚠ Hazmat surcharge applies</div>}
      </div>

      {/* Quotes */}
      {quotes.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700">Available Shipping Options</div>
          {quotes.map(svc => {
            const active = selected?.service_code === svc.service_code;
            return (
              <button
                type="button"
                key={svc.service_code}
                onClick={()=>onSelect?.(svc)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  active ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {iconFor(svc.service_code)}
                    <div>
                      <div className="font-medium text-gray-900">{svc.service_name}</div>
                      <div className="text-sm text-gray-600">{fmtTransit(svc.transit_days)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">${svc.customer_rate.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Freight</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MockUPSFreightCalculator;
