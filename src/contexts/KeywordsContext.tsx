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
  loading: boolean;
}

const KeywordsContext = createContext<KeywordsContextType | undefined>(undefined);

export const KeywordsProvider = ({ children }: { children: ReactNode }) => {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch standard keywords from database on mount
  const fetchStandardKeywords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('keywords')
      .select('*')
      .order('category', { ascending: true })
      .order('keyword', { ascending: true });

    if (!error && data) {
      setKeywords(data as Keyword[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStandardKeywords();
  }, []);

  const addKeyword = (newKeyword: Omit<Keyword, 'id'>) => {
    const keyword: Keyword = {
      ...newKeyword,
      id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID for session
    };
    setKeywords(prev => [...prev, keyword]);
  };

  const deleteKeyword = (id: string) => {
    setKeywords(prev => prev.filter(k => k.id !== id));
  };

  const resetToStandard = async () => {
    await fetchStandardKeywords();
  };

  return (
    <KeywordsContext.Provider
      value={{
        keywords,
        setKeywords,
        addKeyword,
        deleteKeyword,
        resetToStandard,
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
