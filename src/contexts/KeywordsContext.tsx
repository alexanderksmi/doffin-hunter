import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Keyword {
  id: string;
  keyword: string;
  weight: number;
  category: 'positive' | 'negative';
}

interface KeywordsContextType {
  keywords: Keyword[];
  setKeywords: (keywords: Keyword[]) => void;
  addKeyword: (keyword: Omit<Keyword, 'id'>) => void;
  deleteKeyword: (id: string) => void;
  resetToStandard: () => Promise<void>;
  addKeywordToDatabase: (keyword: Omit<Keyword, 'id'>) => Promise<void>;
  deleteKeywordFromDatabase: (id: string) => Promise<void>;
  loading: boolean;
}

const KeywordsContext = createContext<KeywordsContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'session-keywords';

export const KeywordsProvider = ({ children }: { children: ReactNode }) => {
  const [keywords, setKeywordsState] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch standard keywords from database
  const fetchStandardKeywords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('keywords')
      .select('*')
      .order('category', { ascending: true })
      .order('keyword', { ascending: true });

    if (!error && data) {
      const keywordsData = data as Keyword[];
      setKeywordsState(keywordsData);
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(keywordsData));
    }
    setLoading(false);
  };

  // Initialize keywords from database (always start fresh)
  useEffect(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    fetchStandardKeywords();
  }, []);

  const setKeywords = (newKeywords: Keyword[]) => {
    setKeywordsState(newKeywords);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newKeywords));
  };

  const addKeyword = (newKeyword: Omit<Keyword, 'id'>) => {
    const keyword: Keyword = {
      ...newKeyword,
      id: `temp-${Date.now()}-${Math.random()}`,
    };
    const updated = [...keywords, keyword];
    setKeywordsState(updated);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
  };

  const deleteKeyword = (id: string) => {
    const updated = keywords.filter(k => k.id !== id);
    setKeywordsState(updated);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
  };

  const resetToStandard = async () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    await fetchStandardKeywords();
  };

  const addKeywordToDatabase = async (newKeyword: Omit<Keyword, 'id'>) => {
    const { data, error } = await supabase
      .from('keywords')
      .insert({
        keyword: newKeyword.keyword,
        weight: newKeyword.weight,
        category: newKeyword.category
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update local state and session
    if (data) {
      const updated = [...keywords, data as Keyword];
      setKeywordsState(updated);
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
      
      // Automatically fetch new tenders with the updated keywords
      await fetchNewTenders(updated);
    }
  };

  const deleteKeywordFromDatabase = async (id: string) => {
    const { error } = await supabase
      .from('keywords')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    // Update local state and session
    const updated = keywords.filter(k => k.id !== id);
    setKeywordsState(updated);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
    
    // Automatically fetch new tenders with the updated keywords
    await fetchNewTenders(updated);
  };

  const fetchNewTenders = async (updatedKeywords: Keyword[]) => {
    try {
      await supabase.functions.invoke('fetch-doffin-tenders', {
        body: { keywords: updatedKeywords }
      });
    } catch (error) {
      console.error('Failed to fetch new tenders:', error);
    }
  };

  return (
    <KeywordsContext.Provider
      value={{
        keywords,
        setKeywords,
        addKeyword,
        deleteKeyword,
        resetToStandard,
        addKeywordToDatabase,
        deleteKeywordFromDatabase,
        loading,
      }}
    >
      {children}
    </KeywordsContext.Provider>
  );
};

export const useKeywords = () => {
  const context = useContext(KeywordsContext);
  if (context === undefined) {
    throw new Error("useKeywords must be used within a KeywordsProvider");
  }
  return context;
};
