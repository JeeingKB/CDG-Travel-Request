
import { useState, useCallback } from 'react';
import { translateContent } from '../services/geminiService';
import { useTranslation } from '../services/translations';

export const useAiTranslation = () => {
  const { language } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translate = useCallback(async (text: string, targetLang?: 'th' | 'en' | 'zh') => {
    if (!text.trim()) return '';
    
    setIsLoading(true);
    setError(null);
    try {
      // Use provided targetLang or fallback to current app language
      const target = targetLang || language;
      const result = await translateContent(text, target);
      return result;
    } catch (err) {
      console.error("Translation Hook Error:", err);
      setError((err as Error).message);
      return text; // Return original as fallback
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  return { translate, isLoading, error };
};
