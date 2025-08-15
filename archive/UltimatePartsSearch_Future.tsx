import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, Plus, Minus, ShoppingCart, Zap, Clock, Wrench, ChevronRight, X, 
  Lightbulb, Mic, MicOff, Camera, Upload, Brain, TrendingUp, Target,
  Volume2, VolumeX, Play, Pause, RotateCcw
} from 'lucide-react';
import { supabase } from 'services/supabaseClient';

// TypeScript interfaces
interface Manufacturer {
  id: string;
  make: string;
  manufacturer: string;
}

interface Part {
  id: string;
  part_number: string;
  part_description: string;
  category: string;
  list_price: string | number;
  compatible_models: string[] | string;
  image_url?: string;
  in_stock: boolean;
  created_at?: string;
  updated_at?: string;
  manufacturer_id: string;
  make_part_number?: string;
  manufacturer?: Manufacturer;
}

interface CartItem extends Part {
  quantity: number;
}

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'brand' | 'model' | 'part' | 'category' | 'problem' | 'recent' | 'ai' | 'voice' | 'image';
  confidence: number;
  icon?: React.ReactNode;
  description?: string;
  category?: string;
  relevance?: number;
  metadata?: any;
}

interface UserProfile {
  id: string;
  discount_percentage: number;
}

interface PartsSearchProps {
  onAddToCart: (part: Part) => void;
  cartItems?: CartItem[];
  onUpdateQuantity?: (partId: string, quantity: number) => void;
}

interface SearchAnalytics {
  query: string;
  timestamp: Date;
  resultCount: number;
  selectedResult?: string;
  searchType: 'text' | 'voice' | 'image';
  userId?: string;
}

// OpenAI Integration
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

const UltimatePartsSearch: React.FC<PartsSearchProps> = ({ 
  onAddToCart, 
  cartItems = [], 
  onUpdateQuantity 
}) => {
  // Core search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [parts, setParts] = useState<Part[]>([]);
  const [filteredParts, setFilteredParts] = useState<Part[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [userDiscount, setUserDiscount] = useState<number>(0);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);

  // AI Search state
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEnhanced, setAiEnhanced] = useState(false);

  // Voice search state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [voiceResult, setVoiceResult] = useState('');
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  // Image search state
  const [imageSearch, setImageSearch] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // Analytics and learning
  const [searchHistory, setSearchHistory] = useState<SearchAnalytics[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularParts, setPopularParts] = useState<Array<{id: string, name: string, category: string}>>([]);

  // Refs
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const placeholderImageUrl = '/No_Product_Image_Filler.png';

  // Equipment database for local matching
  const equipmentDatabase = {
    brands: [
      'Hobart', 'Manitowoc', 'Hoshizaki', 'True', 'Vulcan', 'Imperial', 'Garland',
      'Southbend', 'Blodgett', 'Rational', 'Cleveland', 'Market Forge', 'Groen',
      'Traulsen', 'Beverage Air', 'Turbo Air', 'Delfield', 'Victory', 'Nor-Lake',
      'Master-Bilt', 'American Range', 'Wolf', 'Jade Range', 'Montague', 'US Range'
    ],
    partTypes: [
      'compressor', 'evaporator', 'condenser', 'heating element', 'thermostat',
      'door seal', 'gasket', 'fan motor', 'control board', 'pump', 'valve',
      'igniter', 'burner', 'grate', 'pilot light', 'safety valve', 'pressure switch',
      'temperature sensor', 'drain pan', 'filter', 'belt', 'bearing', 'switch'
    ],
    equipment: [
      'ice machine', 'refrigerator', 'freezer', 'oven', 'range', 'fryer', 'grill',
      'steamer', 'dishwasher', 'mixer', 'slicer', 'scale', 'warmer', 'cooler',
      'walk-in', 'reach-in', 'convection oven', 'combi oven', 'broiler', 'griddle'
    ],
    problems: [
      'not cooling', 'not heating', 'leaking', 'making noise', 'not working',
      'overheating', 'freezing up', 'not igniting', 'poor temperature control',
      'door not sealing', 'not making ice', 'water leak', 'electrical issue'
    ]
  };

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setSpeechSupported(true);
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const result = event.results[0][0].transcript;
        setVoiceResult(result);
        if (event.results[0].isFinal) {
          setSearchTerm(result);
          setIsListening(false);
          logSearchAnalytics(result, 'voice');
        }
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // OpenAI Integration for natural language processing
  const processWithOpenAI = async (query: string): Promise<SearchSuggestion[]> => {
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured');
      return [];
    }

    try {
      setAiLoading(true);
      
      const systemPrompt = `You are an expert in commercial kitchen equipment and restaurant parts. 
      Analyze the user's query and provide helpful search suggestions.
      Consider: equipment brands, part types, common problems, and maintenance needs.
      Return suggestions in this JSON format:
      [{"text": "suggestion", "type": "part|brand|problem|category", "confidence": 0.95, "description": "why this helps"}]`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Help me find parts for: "${query}"` }
          ],
          max_tokens: 500,
          temperature: 0.3
        })
      });

      if (!response.ok) throw new Error('OpenAI API error');

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      try {
        const aiSuggestions = JSON.parse(content);
        return aiSuggestions.map((suggestion: any, index: number) => ({
          id: `ai-${index}`,
          text: suggestion.text,
          type: 'ai',
          confidence: suggestion.confidence || 0.8,
          icon: <Brain size={16} className="text-purple-500" />,
          description: `AI: ${suggestion.description}`,
          metadata: suggestion
        }));
      } catch {
        // Fallback if JSON parsing fails
        return [{
          id: 'ai-fallback',
          text: content,
          type: 'ai',
          confidence: 0.7,
          icon: <Brain size={16} className="text-purple-500" />,
          description: 'AI suggestion'
        }];
      }
    } catch (error) {
      console.error('OpenAI processing error:', error);
      return [];
    } finally {
      setAiLoading(false);
    }
  };

  // Image recognition using OpenAI Vision
  const processImageWithAI = async (imageData: string): Promise<SearchSuggestion[]> => {
    if (!OPENAI_API_KEY) return [];

    try {
      setAiLoading(true);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this commercial kitchen equipment part. Identify the part type, possible equipment it belongs to, and suggest search terms. Return as JSON array with text, type, and description fields.'
                },
                {
                  type: 'image_url',
                  image_url: { url: imageData }
                }
              ]
            }
          ],
          max_tokens: 300
        })
      });

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      try {
        const suggestions = JSON.parse(content);
        return suggestions.map((suggestion: any, index: number) => ({
          id: `image-ai-${index}`,
          text: suggestion.text,
          type: 'image',
          confidence: 0.85,
          icon: <Camera size={16} className="text-green-500" />,
          description: `Image AI: ${suggestion.description}`
        }));
      } catch {
        return [{
          id: 'image-fallback',
          text: content,
          type: 'image',
          confidence: 0.7,
          icon: <Camera size={16} className="text-green-500" />,
          description: 'Image analysis result'
        }];
      }
    } catch (error) {
      console.error('Image AI error:', error);
      return [];
    } finally {
      setAiLoading(false);
    }
  };

  // Fuzzy matching function
  const fuzzyMatch = (query: string, target: string): number => {
    query = query.toLowerCase();
    target = target.toLowerCase();
    
    if (target.includes(query)) return 0.9;
    
    let score = 0;
    let queryIndex = 0;
    
    for (let i = 0; i < target.length && queryIndex < query.length; i++) {
      if (target[i] === query[queryIndex]) {
        score++;
        queryIndex++;
      }
    }
    
    return queryIndex === query.length ? score / query.length * 0.7 : 0;
  };

  // Generate local suggestions
  const generateLocalSuggestions = useCallback((searchQuery: string): SearchSuggestion[] => {
    if (!searchQuery.trim()) {
      const suggestions: SearchSuggestion[] = [];
      
      // Recent searches
      recentSearches.slice(0, 3).forEach((recent, index) => {
        suggestions.push({
          id: `recent-${index}`,
          text: recent,
          type: 'recent',
          confidence: 0.8,
          icon: <Clock size={16} className="text-gray-400" />,
          description: 'Recent search'
        });
      });

      // Popular parts
      popularParts.slice(0, 3).forEach((part, index) => {
        suggestions.push({
          id: `popular-${index}`,
          text: part.name,
          type: 'part',
          confidence: 0.7,
          icon: <TrendingUp size={16} className="text-orange-500" />,
          description: `Trending in ${part.category}`,
          category: part.category
        });
      });

      return suggestions;
    }

    const suggestions: SearchSuggestion[] = [];
    const query = searchQuery.toLowerCase().trim();

    // Brand matching
    equipmentDatabase.brands.forEach(brand => {
      const score = fuzzyMatch(query, brand);
      if (score > 0.3) {
        suggestions.push({
          id: `brand-${brand}`,
          text: brand,
          type: 'brand',
          confidence: score,
          icon: <div className="w-4 h-4 bg-purple-500 rounded text-white text-xs flex items-center justify-center font-bold">B</div>,
          description: 'Equipment brand'
        });
      }
    });

    // Part type matching
    equipmentDatabase.partTypes.forEach(partType => {
      const score = fuzzyMatch(query, partType);
      if (score > 0.3) {
        suggestions.push({
          id: `part-${partType}`,
          text: partType,
          type: 'part',
          confidence: score,
          icon: <Wrench size={16} className="text-blue-500" />,
          description: 'Part type'
        });
      }
    });

    // Equipment matching
    equipmentDatabase.equipment.forEach(equipment => {
      const score = fuzzyMatch(query, equipment);
      if (score > 0.3) {
        suggestions.push({
          id: `equipment-${equipment}`,
          text: equipment,
          type: 'category',
          confidence: score,
          icon: <Target size={16} className="text-green-500" />,
          description: 'Equipment type'
        });
      }
    });

    // Problem/symptom matching
    equipmentDatabase.problems.forEach(problem => {
      const score = fuzzyMatch(query, problem);
      if (score > 0.3) {
        suggestions.push({
          id: `problem-${problem}`,
          text: `Equipment ${problem}`,
          type: 'problem',
          confidence: score,
          icon: <Lightbulb size={16} className="text-orange-500" />,
          description: 'Troubleshooting'
        });
      }
    });

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 6);
  }, [recentSearches, popularParts]);

  // Voice search functions
  const startVoiceSearch = () => {
    if (recognitionRef.current && speechSupported) {
      setIsListening(true);
      setVoiceResult('');
      recognitionRef.current.start();
    }
  };

  const stopVoiceSearch = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Text-to-speech for results
  const speakResult = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      
      utterance.onstart = () => setIsPlayingVoice(true);
      utterance.onend = () => setIsPlayingVoice(false);
      
      speechSynthesis.speak(utterance);
    }
  };

  // Image search functions
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
        processImageWithAI(result).then(suggestions => {
          if (suggestions.length > 0) {
            setSuggestions(prev => [...suggestions, ...prev]);
            setAiEnhanced(true);
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const startCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setImageSearch(true);
      }
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Camera access denied. Please use file upload instead.');
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg');
      setImagePreview(imageData);
      
      // Stop camera
      const stream = video.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      setImageSearch(false);
      
      // Process with AI
      processImageWithAI(imageData).then(suggestions => {
        if (suggestions.length > 0) {
          setSuggestions(prev => [...suggestions, ...prev]);
          setAiEnhanced(true);
        }
      });
    }
  };

  // Analytics and learning
  const logSearchAnalytics = (query: string, type: 'text' | 'voice' | 'image', resultCount?: number) => {
    const analytics: SearchAnalytics = {
      query,
      timestamp: new Date(),
      resultCount: resultCount || 0,
      searchType: type
    };
    
    setSearchHistory(prev => [...prev, analytics].slice(-100)); // Keep last 100 searches
    
    // Update recent searches
    setRecentSearches(prev => {
      const updated = [query, ...prev.filter(s => s !== query)].slice(0, 10);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      return updated;
    });
  };

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentSearches');
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }
  }, []);

  // Main search logic with all AI enhancements
  useEffect(() => {
    const localSuggestions = generateLocalSuggestions(searchTerm);
    setSuggestions(localSuggestions);
    setSelectedIndex(-1);
    
    // Enhanced AI processing for longer queries
    if (searchTerm.trim().length >= 3) {
      processWithOpenAI(searchTerm).then(aiSuggestions => {
        if (aiSuggestions.length > 0) {
          setSuggestions(prev => [...aiSuggestions, ...prev]);
          setAiEnhanced(true);
        }
      });
    } else {
      setAiEnhanced(false);
    }
  }, [searchTerm, generateLocalSuggestions]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isSearchOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setIsSearchOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setSearchTerm(suggestion.text);
    setIsSearchOpen(false);
    
    // Apply smart filters based on suggestion type
    if (suggestion.type === 'brand') {
      const manufacturer = manufacturers.find(m => 
        m.manufacturer.toLowerCase().includes(suggestion.text.toLowerCase())
      );
      if (manufacturer) setSelectedManufacturer(manufacturer.id);
    }
    
    logSearchAnalytics(suggestion.text, 'text', filteredParts.length);
  };

  // Manual search
  const handleSearch = () => {
    if (searchTerm.trim()) {
      setIsSearchOpen(false);
      logSearchAnalytics(searchTerm, 'text', filteredParts.length);
    }
  };

  // Rest of your existing component logic (fetchParts, etc.)
  const fetchManufacturers = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('manufacturers')
        .select('*')
        .order('manufacturer');

      if (error) {
        console.error('Supabase error details:', error);
        return;
      }

      setManufacturers(data || []);
    } catch (error) {
      console.error('Catch block error:', error);
    }
  };

  const fetchParts = async (): Promise<void> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('parts')
        .select(`
          *,
          manufacturer:manufacturer_id (
            id,
            make,
            manufacturer
          )
        `)
        .order('part_number');

      if (error) {
        console.error('Supabase error:', error);
        return;
      }

      const typedParts: Part[] = (data || []).map((item: any) => ({
        id: item.id,
        part_number: item.part_number || '',
        part_description: item.part_description || '',
        category: item.category || '',
        list_price: item.list_price || '0',
        compatible_models: item.compatible_models || [],
        image_url: item.image_url,
        in_stock: Boolean(item.in_stock),
        created_at: item.created_at,
        updated_at: item.updated_at,
        manufacturer_id: item.manufacturer_id,
        make_part_number: item.make_part_number,
        manufacturer: item.manufacturer
      }));

      setParts(typedParts);
      setFilteredParts(typedParts);
    } catch (error) {
      console.error('Network error fetching parts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDiscount = async (): Promise<void> => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('discount_percentage')
        .eq('id', user.id)
        .single();

      if (error) return;

      const profile = data as UserProfile | null;
      const discount = profile?.discount_percentage || 0;
      setUserDiscount(discount);
    } catch (error) {
      console.log('Error fetching user discount:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchParts();
      await fetchManufacturers();
      setTimeout(fetchUserDiscount, 500);
    };
    
    loadData();
  }, []);

  useEffect(() => {
    let filtered: Part[] = parts;

    if (searchTerm) {
      filtered = filtered.filter((part: Part) => {
        const compatibleModels = Array.isArray(part.compatible_models) 
          ? part.compatible_models 
          : typeof part.compatible_models === 'string' 
            ? [part.compatible_models] 
            : [];
            
        return (
          part.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.part_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.manufacturer?.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.manufacturer?.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.make_part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          compatibleModels.some((model: string) => 
            model.toLowerCase().includes(searchTerm.toLowerCase())
          )
        );
      });
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((part: Part) => part.category === selectedCategory);
    }

    if (selectedManufacturer !== 'all') {
      filtered = filtered.filter((part: Part) => 
        part.manufacturer?.id === selectedManufacturer
      );
    }

    setFilteredParts(filtered);
  }, [searchTerm, selectedCategory, selectedManufacturer, parts]);

  const calculateDiscountedPrice = (price: string | number): string => {
    const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
    const discountAmount = numericPrice * (userDiscount / 100);
    return (numericPrice - discountAmount).toFixed(2);
  };

  const getUniqueCategories = (): string[] => {
    return Array.from(new Set(parts.map((part: Part) => part.category)));
  };

  const isInCart = (partId: string): boolean => {
    return cartItems.some((item: CartItem) => item.id === partId);
  };

  const getCartQuantity = (partId: string): number => {
    const item = cartItems.find((item: CartItem) => item.id === partId);
    return item ? item.quantity : 0;
  };

  const handleQuantityDecrease = (e: React.MouseEvent, partId: string) => {
    e.stopPropagation();
    const currentQuantity = getCartQuantity(partId);
    if (currentQuantity > 0 && onUpdateQuantity) {
      onUpdateQuantity(partId, currentQuantity - 1);
    }
  };

  const handleQuantityIncrease = (e: React.MouseEvent, part: Part) => {
    e.stopPropagation();
    const currentQuantity = getCartQuantity(part.id);
    if (currentQuantity === 0) {
      onAddToCart(part);
    } else if (onUpdateQuantity) {
      onUpdateQuantity(part.id, currentQuantity + 1);
    }
  };

  const handleAddToCartClick = (e: React.MouseEvent, part: Part) => {
    e.stopPropagation();
    onAddToCart(part);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 16px' }}>
        {/* Ultimate AI Search Bar */}
        <div ref={searchRef} style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          padding: '32px',
          marginBottom: '32px',
          position: 'relative',
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            flexDirection: window.innerWidth >= 1024 ? 'row' : 'column',
            gap: '24px'
          }}>
            {/* Ultimate Search Input */}
            <div style={{ flex: 1, position: 'relative' }}>
              {/* Search Input with AI Enhancement */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4">
                  {aiLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                  ) : (
                    <Search className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search parts, describe problems, or ask for help..."
                  className="w-full pl-12 pr-32 py-4 text-lg border-2 border-red-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
                />
                
                {/* AI Enhancement Indicators */}
                <div className="absolute inset-y-0 right-4 flex items-center gap-2">
                  {aiEnhanced && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                      <Brain size={12} />
                      AI
                    </div>
                  )}
                  
                  {voiceResult && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      <Mic size={12} />
                      Voice
                    </div>
                  )}
                  
                  {imagePreview && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      <Camera size={12} />
                      Image
                    </div>
                  )}
                  
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setVoiceResult('');
                        setImagePreview('');
                        setIsSearchOpen(false);
                        inputRef.current?.focus();
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              </div>

              {/* Voice Search Controls */}
              <div className="flex items-center gap-2 mt-3">
                {speechSupported && (
                  <button
                    onClick={isListening ? stopVoiceSearch : startVoiceSearch}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isListening 
                        ? 'bg-red-100 text-red-700 animate-pulse' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    {isListening ? 'Stop Listening' : 'Voice Search'}
                  </button>
                )}

                {/* Image Search Controls */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium transition-all"
                >
                  <Upload size={16} />
                  Upload Image
                </button>

                <button
                  onClick={startCameraCapture}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg text-sm font-medium transition-all"
                >
                  <Camera size={16} />
                  Camera
                </button>

                {/* Text-to-Speech */}
                {filteredParts.length > 0 && (
                  <button
                    onClick={() => speakResult(`Found ${filteredParts.length} parts for ${searchTerm}`)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isPlayingVoice 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {isPlayingVoice ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    Read Results
                  </button>
                )}
              </div>

              {/* Voice Result Display */}
              {voiceResult && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800 text-sm font-medium mb-1">
                    <Mic size={16} />
                    Voice Input:
                  </div>
                  <p className="text-blue-900">{voiceResult}</p>
                </div>
              )}

              {/* Image Preview */}
              {imagePreview && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 text-sm font-medium mb-2">
                    <Camera size={16} />
                    Image Analysis:
                  </div>
                  <img 
                    src={imagePreview} 
                    alt="Analyzed part" 
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                </div>
              )}

              {/* AI Suggestions Dropdown */}
              {isSearchOpen && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {searchTerm ? 'AI-Enhanced Suggestions' : 'Quick Access'}
                      </span>
                      <div className="flex gap-2">
                        {aiEnhanced && (
                          <div className="flex items-center gap-1 text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                            <Brain size={10} />
                            AI Enhanced
                          </div>
                        )}
                        {suggestions.some(s => s.type === 'voice') && (
                          <div className="flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                            <Mic size={10} />
                            Voice
                          </div>
                        )}
                        {suggestions.some(s => s.type === 'image') && (
                          <div className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                            <Camera size={10} />
                            Image
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Suggestions List */}
                  <div className="py-2">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.id}
                        ref={(el) => {
                          suggestionRefs.current[index] = el;
                        }}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`px-4 py-3 cursor-pointer transition-colors duration-150 flex items-center gap-3 ${
                          index === selectedIndex 
                            ? 'bg-purple-50 border-l-4 border-purple-500' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Icon */}
                        <div className="flex-shrink-0">
                          {suggestion.icon}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">
                              {suggestion.text}
                            </span>
                            {suggestion.type === 'ai' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                <Brain size={10} className="mr-1" />
                                AI
                              </span>
                            )}
                            {suggestion.type === 'voice' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Mic size={10} className="mr-1" />
                                Voice
                              </span>
                            )}
                            {suggestion.type === 'image' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <Camera size={10} className="mr-1" />
                                Image
                              </span>
                            )}
                          </div>
                          {suggestion.description && (
                            <p className="text-sm text-gray-500 truncate">
                              {suggestion.description}
                            </p>
                          )}
                        </div>
                        
                        {/* Confidence indicator */}
                        {suggestion.type === 'ai' && (
                          <div className="flex-shrink-0">
                            <div className="w-2 h-8 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="bg-purple-500 rounded-full transition-all duration-300"
                                style={{ height: `${suggestion.confidence * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                        
                        <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                    <p className="text-xs text-gray-500 text-center">
                      AI-powered suggestions • Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">↵</kbd> to search
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Traditional Filters */}
            <div style={{ minWidth: '224px', position: 'relative' }}>
              <select
                value={selectedCategory}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  color: '#111827',
                  fontSize: '16px',
                  outline: 'none',
                  cursor: 'pointer',
                  marginBottom: '12px'
                }}
              >
                <option value="all">All Categories</option>
                {getUniqueCategories().map((category: string) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <select
                value={selectedManufacturer}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedManufacturer(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  color: '#111827',
                  fontSize: '16px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Manufacturers</option>
                {manufacturers.map((manufacturer: Manufacturer) => (
                  <option key={manufacturer.id} value={manufacturer.id}>
                    {manufacturer.manufacturer}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Analytics Display */}
          {searchHistory.length > 0 && (
            <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 text-blue-800 text-sm font-medium mb-2">
                <TrendingUp size={16} />
                Search Insights
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Searches:</span>
                  <span className="ml-2 font-medium text-blue-900">{searchHistory.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Voice Searches:</span>
                  <span className="ml-2 font-medium text-green-900">
                    {searchHistory.filter(s => s.searchType === 'voice').length}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Image Searches:</span>
                  <span className="ml-2 font-medium text-orange-900">
                    {searchHistory.filter(s => s.searchType === 'image').length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Summary with AI Insights */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '1.125rem', fontWeight: '500', color: '#374151', margin: 0 }}>
                Showing <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{filteredParts.length}</span> of <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{parts.length}</span> parts
                {aiEnhanced && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                    <Brain size={12} className="mr-1" />
                    AI Enhanced Results
                  </span>
                )}
              </p>
              {searchTerm && (
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' }}>
                  Results for "{searchTerm}"
                  {voiceResult && voiceResult !== searchTerm && (
                    <span className="text-blue-600"> (from voice: "{voiceResult}")</span>
                  )}
                </div>
              )}
            </div>
            
            {/* Quick AI Actions */}
            <div className="flex items-center gap-2">
              {searchTerm && (
                <button
                  onClick={() => speakResult(`Found ${filteredParts.length} parts matching ${searchTerm}`)}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-medium transition-all"
                >
                  <Volume2 size={14} />
                  Speak Results
                </button>
              )}
              
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedManufacturer('all');
                  setVoiceResult('');
                  setImagePreview('');
                }}
                className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-all"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Parts Grid - Same as before */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(300px, 1fr))`,
          gap: '32px'
        }}>
          {filteredParts.map((part: Part) => {
            const compatibleModels = Array.isArray(part.compatible_models) 
              ? part.compatible_models 
              : typeof part.compatible_models === 'string' 
                ? [part.compatible_models] 
                : [];

            const listPrice = typeof part.list_price === 'string' ? parseFloat(part.list_price) : part.list_price;
            const discountedPrice = userDiscount > 0 ? parseFloat(calculateDiscountedPrice(part.list_price)) : listPrice;
            const currentQuantity = getCartQuantity(part.id);

            return (
              <div 
                key={part.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  border: '1px solid #e5e7eb',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                }}
              >
                {/* Clickable part tile area */}
                <div 
                  onClick={() => setSelectedPart(part)}
                  style={{ cursor: 'pointer', padding: '16px' }}
                >
                  {/* Part Image */}
                  <div style={{
                    width: '100%',
                    height: '160px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    marginBottom: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <img
                      src={part.image_url || placeholderImageUrl}
                      alt={part.part_description}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                        const target = e.target as HTMLImageElement;
                        target.src = placeholderImageUrl;
                      }}
                    />
                  </div>

                  {/* Part Number */}
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '4px',
                    lineHeight: '1.3'
                  }}>
                    {part.part_number}
                  </h3>

                  {/* Description */}
                  <p style={{
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    marginBottom: '8px',
                    lineHeight: '1.4',
                    height: '40px',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {part.part_description}
                  </p>

                  {/* Manufacturer Info */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    <span><strong>OEM:</strong> {part.manufacturer?.manufacturer || 'N/A'}</span>
                    <span>•</span>
                    <span><strong>Make:</strong> {part.manufacturer?.make || 'N/A'}</span>
                  </div>

                  {/* Price Section */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color: '#059669',
                      marginBottom: '4px'
                    }}>
                      ${discountedPrice.toFixed(2)}
                    </div>
                    {userDiscount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.875rem',
                          color: '#9ca3af',
                          textDecoration: 'line-through'
                        }}>
                          ${listPrice.toFixed(2)}
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#dc2626',
                          fontWeight: '600',
                          backgroundColor: '#fef2f2',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {userDiscount}% OFF
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Add to Cart Section */}
                <div style={{
                  padding: '0 16px 16px',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  {currentQuantity > 0 ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <button
                          onClick={(e) => handleQuantityDecrease(e, part.id)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: 'white',
                            color: '#374151',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <Minus size={14} />
                        </button>
                        
                        <span style={{
                          minWidth: '24px',
                          textAlign: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#111827'
                        }}>
                          {currentQuantity}
                        </span>
                        
                        <button
                          onClick={(e) => handleQuantityIncrease(e, part)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: 'white',
                            color: '#374151',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.875rem',
                        color: '#059669',
                        fontWeight: '500'
                      }}>
                        <ShoppingCart size={16} />
                        In Cart
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => handleAddToCartClick(e, part)}
                      disabled={!part.in_stock}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        border: 'none',
                        cursor: part.in_stock ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                        background: part.in_stock 
                          ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                          : '#d1d5db',
                        color: part.in_stock ? 'white' : '#6b7280',
                        boxShadow: part.in_stock ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none'
                      }}
                    >
                      <Plus size={16} />
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* No Results State with AI Suggestions */}
        {filteredParts.length === 0 && searchTerm && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              padding: '48px',
              maxWidth: '512px',
              margin: '0 auto'
            }}>
              <div style={{ color: '#9ca3af', marginBottom: '24px' }}>
                <Search style={{ width: '80px', height: '80px', margin: '0 auto' }} />
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '16px'
              }}>
                No parts found for "{searchTerm}"
              </h3>
              <p style={{
                color: '#6b7280',
                marginBottom: '24px',
                lineHeight: '1.5'
              }}>
                Try our AI-powered search suggestions or describe your problem differently
              </p>
              
              {/* AI-powered alternative suggestions */}
              <div className="space-y-2 mb-6">
                <p className="text-sm font-medium text-purple-700">AI Suggestions:</p>
                <button 
                  onClick={() => setSearchTerm('compressor parts')}
                  className="block w-full p-2 text-left bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-700 text-sm transition-colors"
                >
                  🔧 Try "compressor parts" instead
                </button>
                <button 
                  onClick={() => setSearchTerm('heating elements')}
                  className="block w-full p-2 text-left bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-700 text-sm transition-colors"
                >
                  🔥 Try "heating elements" instead
                </button>
                <button 
                  onClick={() => setSearchTerm('door seals')}
                  className="block w-full p-2 text-left bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-700 text-sm transition-colors"
                >
                  🚪 Try "door seals" instead
                </button>
              </div>
              
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedManufacturer('all');
                  setVoiceResult('');
                  setImagePreview('');
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  borderRadius: '12px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />

      {/* Camera Modal */}
      {imageSearch && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setImageSearch(false)}
        >
          <div 
            className="bg-white rounded-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Capture Part Image</h3>
              <button
                onClick={() => setImageSearch(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            
            <video
              ref={videoRef}
              className="w-full h-64 bg-gray-900 rounded-lg mb-4"
              autoPlay
              playsInline
            />
            
            <div className="flex gap-3">
              <button
                onClick={captureImage}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Camera size={16} />
                Capture
              </button>
              <button
                onClick={() => setImageSearch(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Canvas for Image Capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Product Detail Modal with AI Enhancement */}
      {selectedPart && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedPart(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with AI Features */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedPart.part_number}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => speakResult(`Part details for ${selectedPart.part_number}. ${selectedPart.part_description}`)}
                      className="flex items-center gap-1 px-2 py-1 bg-white/20 text-white rounded text-xs hover:bg-white/30 transition-colors"
                    >
                      <Volume2 size={12} />
                      Listen
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPart(null)}
                  className="text-white hover:text-gray-200 transition-colors text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product Image */}
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={selectedPart.image_url || placeholderImageUrl}
                    alt={selectedPart.part_description}
                    className="w-full h-full object-cover"
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      const target = e.target as HTMLImageElement;
                      target.src = placeholderImageUrl;
                    }}
                  />
                </div>

                {/* Product Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedPart.part_number}</h3>
                    <p className="text-gray-600 text-lg">{selectedPart.part_description}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">OEM:</span>
                      <span className="text-gray-900">{selectedPart.manufacturer?.manufacturer || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Make:</span>
                      <span className="text-gray-900">{selectedPart.manufacturer?.make || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Category:</span>
                      <span className="text-gray-900">{selectedPart.category}</span>
                    </div>
                    {selectedPart.make_part_number && (
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">Make P/N:</span>
                        <span className="text-gray-900">{selectedPart.make_part_number}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Stock Status:</span>
                      <span className={`font-medium ${selectedPart.in_stock ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedPart.in_stock ? '✓ In Stock' : '✗ Out of Stock'}
                      </span>
                    </div>
                  </div>

                  {/* Compatible Models */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Compatible Models:</h4>
                    <p className="text-gray-900 text-sm">
                      {Array.isArray(selectedPart.compatible_models) 
                        ? selectedPart.compatible_models.join(', ')
                        : selectedPart.compatible_models || 'Universal'}
                    </p>
                  </div>

                  {/* AI-Generated Installation Tips */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-purple-800 text-sm font-medium mb-2">
                      <Brain size={16} />
                      AI Installation Tips
                    </div>
                    <ul className="text-purple-700 text-sm space-y-1">
                      <li>• Always disconnect power before installation</li>
                      <li>• Check compatibility with your equipment model</li>
                      <li>• Consider professional installation for complex parts</li>
                      <li>• Keep original packaging for warranty purposes</li>
                    </ul>
                  </div>

                  {/* Pricing */}
                  <div className="border-t pt-4">
                    {userDiscount > 0 ? (
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl font-bold text-green-600">
                            ${calculateDiscountedPrice(selectedPart.list_price)}
                          </span>
                          <span className="text-lg text-gray-500 line-through">
                            ${typeof selectedPart.list_price === 'string' ? selectedPart.list_price : selectedPart.list_price.toString()}
                          </span>
                        </div>
                        <div className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                          {userDiscount}% discount applied
                        </div>
                      </div>
                    ) : (
                      <span className="text-2xl font-bold text-gray-900">
                        ${typeof selectedPart.list_price === 'string' ? selectedPart.list_price : selectedPart.list_price.toString()}
                      </span>
                    )}
                  </div>

                  {/* Enhanced Add to Cart Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(selectedPart);
                      speakResult(`Added ${selectedPart.part_number} to cart`);
                    }}
                    disabled={!selectedPart.in_stock}
                    className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                      selectedPart.in_stock
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isInCart(selectedPart.id) ? (
                      <>
                        <ShoppingCart className="w-5 h-5" />
                        In Cart ({getCartQuantity(selectedPart.id)})
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Add to Cart
                      </>
                    )}
                  </button>

                  {/* AI-Powered Related Parts */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-800 text-sm font-medium mb-3">
                      <Zap size={16} />
                      Frequently Bought Together
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-700">Installation hardware kit</span>
                        <button className="text-blue-600 hover:text-blue-800 font-medium">
                          + Add
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-700">Gasket sealant</span>
                        <button className="text-blue-600 hover:text-blue-800 font-medium">
                          + Add
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-700">Digital multimeter</span>
                        <button className="text-blue-600 hover:text-blue-800 font-medium">
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UltimatePartsSearch;