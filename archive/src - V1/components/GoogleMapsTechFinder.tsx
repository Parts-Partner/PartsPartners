import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Phone, Building2, X, Search, Users, Filter } from 'lucide-react';
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
  lat?: number;
  lng?: number;
}

interface TechFinderProps {
  isOpen: boolean;
  onClose: () => void;
}

// Load Google Maps API
const loadGoogleMapsAPI = (apiKey: string): Promise<typeof google> => {
  return new Promise((resolve, reject) => {
    if (window.google) {
      resolve(window.google);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      if (window.google) {
        resolve(window.google);
      } else {
        reject(new Error('Google Maps API failed to load'));
      }
    };
    
    script.onerror = () => reject(new Error('Failed to load Google Maps API'));
    document.head.appendChild(script);
  });
};

// Geocoding function
const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    if (!window.google) return null;
    
    const geocoder = new window.google.maps.Geocoder();
    const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results) {
          resolve(results);
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });

    if (result.length > 0) {
      const location = result[0].geometry.location;
      return {
        lat: location.lat(),
        lng: location.lng()
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

const GoogleMapsTechFinder: React.FC<TechFinderProps> = ({ isOpen, onClose }) => {
  const [searchZip, setSearchZip] = useState('');
  const [searchRadius, setSearchRadius] = useState(25);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedTech, setSelectedTech] = useState<Technician | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // Initialize Google Maps
  useEffect(() => {
    if (isOpen) {
      
      const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY!;
      
      loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY)
        .then(() => {
          initializeMap();
        })
        .catch((error) => {
          console.error('Failed to load Google Maps:', error);
          setError('Failed to load maps. Please check your API key.');
        });
    }
  }, [isOpen]);

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;

    // Default center (adjust to your area)
    const defaultCenter = { lat: 38.2527, lng: -85.7585 }; // Louisville, KY area
    
    const map = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 10,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    mapInstanceRef.current = map;
  };

  // Clear existing markers
  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  };

  // Add markers to map
  const addMarkersToMap = async (techs: Technician[]) => {
    if (!mapInstanceRef.current || !window.google) return;

    clearMarkers();
    const bounds = new window.google.maps.LatLngBounds();

    // Add search center marker if we have mapCenter
    if (mapCenter) {
      const centerMarker = new window.google.maps.Marker({
        position: mapCenter,
        map: mapInstanceRef.current,
        title: `Search Center (${searchZip})`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="white" stroke-width="2"/>
              <circle cx="12" cy="12" r="3" fill="white"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(24, 24)
        }
      });
      markersRef.current.push(centerMarker);
      bounds.extend(mapCenter);

      // Add search radius circle
      const radiusCircle = new window.google.maps.Circle({
        strokeColor: '#3b82f6',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        map: mapInstanceRef.current,
        center: mapCenter,
        radius: searchRadius * 1609.34 // Convert miles to meters
      });
    }

    // Add technician markers
    for (const tech of techs) {
      if (tech.lat && tech.lng) {
        const marker = new window.google.maps.Marker({
          position: { lat: tech.lat, lng: tech.lng },
          map: mapInstanceRef.current,
          title: tech.full_name,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#16a34a" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="10" r="3" fill="white"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(32, 32)
          }
        });

        // Add info window
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="max-width: 300px; padding: 8px;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">${tech.full_name}</h3>
              ${tech.company_name ? `<p style="margin: 0 0 4px 0; color: #666;"><strong>${tech.company_name}</strong></p>` : ''}
              <p style="margin: 0 0 4px 0; font-size: 14px;">${tech.city}, ${tech.state} ${tech.zip_code}</p>
              ${tech.phone ? `<p style="margin: 0 0 8px 0; font-size: 14px;"><a href="tel:${tech.phone}" style="color: #3b82f6;">${formatPhone(tech.phone)}</a></p>` : ''}
              <p style="margin: 0; font-size: 12px; color: #888;">Distance: ${tech.distance?.toFixed(1)} miles</p>
            </div>
          `
        });

        marker.addListener('click', () => {
          setSelectedTech(tech);
          infoWindow.open(mapInstanceRef.current, marker);
        });

        markersRef.current.push(marker);
        bounds.extend({ lat: tech.lat, lng: tech.lng });
      }
    }

    // Fit map to show all markers
    if (markersRef.current.length > 0) {
      mapInstanceRef.current.fitBounds(bounds);
      // Don't zoom in too much for single markers
      const listener = window.google.maps.event.addListener(mapInstanceRef.current, 'idle', () => {
        if (mapInstanceRef.current!.getZoom()! > 15) {
          mapInstanceRef.current!.setZoom(15);
        }
        window.google.maps.event.removeListener(listener);
      });
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    if (!window.google) return 0;
    
    const point1 = new window.google.maps.LatLng(lat1, lng1);
    const point2 = new window.google.maps.LatLng(lat2, lng2);
    
    return window.google.maps.geometry.spherical.computeDistanceBetween(point1, point2) * 0.000621371; // Convert meters to miles
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
      // Geocode the search zip code
      const searchLocation = await geocodeAddress(searchZip);
      if (!searchLocation) {
        throw new Error('Could not find location for zip code');
      }
      
      setMapCenter(searchLocation);

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
        }
      ];

      // Combine real and mock data
      const allTechnicians = [...(data || []), ...mockTechnicians];

      // Geocode each technician's address and calculate distance
      const techsWithLocation = await Promise.all(
        allTechnicians.map(async (tech: any) => {
          const address = `${tech.address_line_1}, ${tech.city}, ${tech.state} ${tech.zip_code}`;
          const location = await geocodeAddress(address);
          
          if (location) {
            const distance = calculateDistance(
              searchLocation.lat, 
              searchLocation.lng, 
              location.lat, 
              location.lng
            );
            
            return {
              ...tech,
              lat: location.lat,
              lng: location.lng,
              distance
            };
          }
          return null;
        })
      );

      // Filter by search radius and remove null entries
      const filteredTechs = techsWithLocation
        .filter((tech): tech is Technician => tech !== null && tech.distance! <= searchRadius)
        .sort((a, b) => a.distance! - b.distance!);

      setTechnicians(filteredTechs);
      
      // Add markers to map
      setTimeout(() => {
        addMarkersToMap(filteredTechs);
      }, 100);

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
        maxWidth: '1200px',
        width: '100%',
        height: '80vh',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column'
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
                <MapPin size={24} style={{ color: 'white' }} />
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: 'white',
                margin: 0
              }}>
                Find Technicians Near You
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

        {/* Search Controls */}
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                Zip Code
              </label>
              <input
                type="text"
                value={searchZip}
                onChange={(e) => setSearchZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                onKeyPress={handleKeyPress}
                placeholder="Enter 5-digit zip code"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ minWidth: '150px' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                Search Radius
              </label>
              <select
                value={searchRadius}
                onChange={(e) => setSearchRadius(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none',
                  backgroundColor: 'white'
                }}
              >
                <option value={10}>10 miles</option>
                <option value={25}>25 miles</option>
                <option value={50}>50 miles</option>
                <option value={75}>75 miles</option>
                <option value={100}>100 miles</option>
              </select>
            </div>

            <button
              onClick={searchTechnicians}
              disabled={loading || !searchZip || searchZip.length !== 5}
              style={{
                padding: '10px 20px',
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
                whiteSpace: 'nowrap'
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #ffffff40',
                    borderTop: '2px solid #ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Searching...
                </>
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

        {/* Content Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Map */}
          <div style={{ flex: 2, minHeight: '400px' }}>
            <div
              ref={mapRef}
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#f3f4f6'
              }}
            />
          </div>

          {/* Results List */}
          <div style={{
            flex: 1,
            borderLeft: '1px solid #e5e7eb',
            overflow: 'auto',
            backgroundColor: '#fafafa'
          }}>
            <div style={{ padding: '20px' }}>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Users size={18} />
                Found {technicians.length} technician{technicians.length !== 1 ? 's' : ''}
              </h3>

              {hasSearched && !loading && technicians.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  color: '#6b7280'
                }}>
                  <MapPin size={48} style={{ margin: '0 auto 16px', color: '#d1d5db' }} />
                  <p style={{ fontSize: '0.875rem' }}>
                    No technicians found within {searchRadius} miles of {searchZip}
                  </p>
                </div>
              )}

              {technicians.map((tech) => (
                <div
                  key={tech.id}
                  style={{
                    padding: '16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  onClick={() => {
                    if (tech.lat && tech.lng && mapInstanceRef.current) {
                      mapInstanceRef.current.setCenter({ lat: tech.lat, lng: tech.lng });
                      mapInstanceRef.current.setZoom(15);
                      setSelectedTech(tech);
                    }
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    marginBottom: '8px'
                  }}>
                    <h4 style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#111827',
                      margin: 0
                    }}>
                      {tech.full_name}
                    </h4>
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: '#dcfce7',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      color: '#166534'
                    }}>
                      {tech.distance?.toFixed(1)} mi
                    </span>
                  </div>

                  {tech.company_name && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#6b7280',
                      fontSize: '0.875rem',
                      marginBottom: '6px'
                    }}>
                      <Building2 size={12} />
                      {tech.company_name}
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    marginBottom: '6px'
                  }}>
                    <MapPin size={12} />
                    {tech.city}, {tech.state}
                  </div>

                  {tech.phone && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.875rem'
                    }}>
                      <Phone size={12} style={{ color: '#6b7280' }} />
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
              ))}
            </div>
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

export default GoogleMapsTechFinder;