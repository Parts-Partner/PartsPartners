import React, { useState } from 'react';
import { MapPin, Phone, Building2, Navigation, X, Search, Users } from 'lucide-react';
import { supabase } from 'services/supabaseClient';

// TypeScript interfaces
interface Technician {
  id: string;
  full_name: string;
  company_name: string;
  phone: string;
  email: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  zip_code: string;
  service_radius_miles: number;
  distance?: number;
}

interface TechFinderProps {
  isOpen: boolean;
  onClose: () => void;
}

const TechFinder: React.FC<TechFinderProps> = ({ isOpen, onClose }) => {
  const [searchZip, setSearchZip] = useState('');
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Calculate distance between two zip codes (simplified calculation)
  const calculateDistance = (zip1: string, zip2: string): number => {
    // This is a simplified distance calculation
    // In production, you'd use a proper geocoding API
    const zipDiff = Math.abs(parseInt(zip1) - parseInt(zip2));
    
    // Rough approximation: 1 zip code difference ≈ 10-15 miles
    // This is just for demo purposes
    if (zipDiff === 0) return 0;
    if (zipDiff <= 10) return zipDiff * 2;
    if (zipDiff <= 50) return zipDiff * 3;
    if (zipDiff <= 100) return zipDiff * 5;
    return zipDiff * 8;
  };

  const searchTechnicians = async () => {
    if (!searchZip || searchZip.length !== 5) {
      setError('Please enter a valid 5-digit zip code');
      return;
    }

    setLoading(true);
    setError('');
    setHasSearched(true);

    try {
      // Fetch real technicians from database
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_technician', true)
        .not('zip_code', 'is', null);

      if (fetchError) {
        throw fetchError;
      }

      // Add mock technicians for better testing
      const mockTechnicians = [
        {
          id: 'mock-1',
          full_name: 'Sarah Johnson',
          company_name: 'Johnson Appliance Service',
          phone: '812-555-0103',
          email: 'sarah@johnsonappliance.com',
          address_line_1: '789 Elm St',
          city: 'New Albany',
          state: 'IN',
          zip_code: '47150',
          service_radius_miles: 35,
          is_technician: true
        },
        {
          id: 'mock-2',
          full_name: 'Mike Williams',
          company_name: 'Williams HVAC Solutions',
          phone: '502-555-0104',
          email: 'mike@williamshvac.com',
          address_line_1: '321 Pine Dr',
          city: 'Louisville',
          state: 'KY',
          zip_code: '40220',
          service_radius_miles: 40,
          is_technician: true
        },
        {
          id: 'mock-3',
          full_name: 'Lisa Chen',
          company_name: 'Chen Refrigeration Experts',
          phone: '502-555-0105',
          email: 'lisa@chenrefrig.com',
          address_line_1: '567 Maple Ave',
          city: 'Louisville',
          state: 'KY',
          zip_code: '40204',
          service_radius_miles: 30,
          is_technician: true
        },
        {
          id: 'mock-4',
          full_name: 'Robert Martinez',
          company_name: 'Martinez Commercial HVAC',
          phone: '812-555-0106',
          email: 'robert@martinezhvac.com',
          address_line_1: '890 Business Blvd',
          city: 'Clarksville',
          state: 'IN',
          zip_code: '47129',
          service_radius_miles: 25,
          is_technician: true
        },
        {
          id: 'mock-5',
          full_name: 'Jennifer Davis',
          company_name: 'Davis Family Appliance Repair',
          phone: '502-555-0107',
          email: 'jen@davisfamilyrepair.com',
          address_line_1: '234 Home St',
          city: 'Prospect',
          state: 'KY',
          zip_code: '40059',
          service_radius_miles: 45,
          is_technician: true
        }
      ];

      // Combine real and mock data
      const allTechnicians = [...(data || []), ...mockTechnicians];

      // Calculate distances and sort by proximity
      const techsWithDistance = allTechnicians
        .map((tech: any) => ({
          ...tech,
          distance: calculateDistance(searchZip, tech.zip_code)
        }))
        .filter((tech: any) => tech.distance <= tech.service_radius_miles)
        .sort((a: any, b: any) => a.distance - b.distance);

      setTechnicians(techsWithDistance);
    } catch (error: any) {
      console.error('Error searching technicians:', error);
      setError('Failed to search technicians. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchTechnicians();
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      zIndex: 50
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        maxWidth: '700px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                padding: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px'
              }}>
                <Users size={24} style={{ color: 'white' }} />
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: 'white',
                margin: 0
              }}>
                Find a Tech Near You!
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                color: 'white',
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '32px' }}>
          {/* Search Section */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '8px'
            }}>
              Enter Your Zip Code
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '16px'
            }}>
              Find qualified technicians in your area who can help with parts and service
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                value={searchZip}
                onChange={(e) => setSearchZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                onKeyPress={handleKeyPress}
                placeholder="Enter 5-digit zip code"
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />
              <button
                onClick={searchTechnicians}
                disabled={loading || !searchZip || searchZip.length !== 5}
                style={{
                  padding: '12px 24px',
                  background: loading 
                    ? '#9ca3af' 
                    : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minWidth: '120px',
                  justifyContent: 'center'
                }}
              >
                {loading ? (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #ffffff40',
                    borderTop: '2px solid #ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                ) : (
                  <>
                    <Search size={16} />
                    Search
                  </>
                )}
              </button>
            </div>

            {error && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '0.875rem'
              }}>
                {error}
              </div>
            )}
          </div>

          {/* Results Section */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {hasSearched && !loading && technicians.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: '#6b7280'
              }}>
                <MapPin size={48} style={{ margin: '0 auto 16px', color: '#d1d5db' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>
                  No technicians found in your area
                </h3>
                <p style={{ fontSize: '0.875rem' }}>
                  Try searching a nearby zip code or contact us for assistance finding service in your area.
                </p>
              </div>
            )}

            {technicians.map((tech) => (
              <div
                key={tech.id}
                style={{
                  padding: '20px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  marginBottom: '16px',
                  backgroundColor: '#fafafa',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f9ff';
                  e.currentTarget.style.borderColor = '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fafafa';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '4px'
                    }}>
                      {tech.full_name}
                    </h3>
                    {tech.company_name && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#6b7280',
                        fontSize: '0.875rem',
                        marginBottom: '8px'
                      }}>
                        <Building2 size={14} />
                        {tech.company_name}
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    backgroundColor: '#dcfce7',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#166534'
                  }}>
                    <Navigation size={12} />
                    {tech.distance?.toFixed(1)} mi
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#6b7280',
                    fontSize: '0.875rem'
                  }}>
                    <MapPin size={14} />
                    <span>
                      {tech.city}, {tech.state} {tech.zip_code}
                    </span>
                  </div>

                  {tech.phone && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#6b7280',
                      fontSize: '0.875rem'
                    }}>
                      <Phone size={14} />
                      <a
                        href={`tel:${tech.phone}`}
                        style={{
                          color: '#3b82f6',
                          textDecoration: 'none',
                          fontWeight: '500'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {formatPhone(tech.phone)}
                      </a>
                    </div>
                  )}
                </div>

                <div style={{
                  marginTop: '12px',
                  fontSize: '0.75rem',
                  color: '#9ca3af'
                }}>
                  Services within {tech.service_radius_miles} miles
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TechFinder;