// =============================================================================
// SEO Hook - Dynamic Meta Tags Management
// Updates page meta tags based on current language
// =============================================================================

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const useSEO = () => {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    // Update document title
    const title = t('seo.title');
    document.title = title;

    // Update meta description
    const description = t('seo.description');
    updateMetaTag('name', 'description', description);

    // Update meta keywords
    const keywords = t('seo.keywords');
    updateMetaTag('name', 'keywords', keywords);

    // Update Open Graph tags
    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:locale', i18n.language);

    // Update Twitter tags
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', description);

    // Update HTML lang attribute
    document.documentElement.lang = i18n.language;
  }, [t, i18n.language]);
};

const updateMetaTag = (attribute: string, attributeValue: string, content: string) => {
  let element = document.querySelector(`meta[${attribute}="${attributeValue}"]`);
  
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, attributeValue);
    document.head.appendChild(element);
  }
  
  element.setAttribute('content', content);
};
