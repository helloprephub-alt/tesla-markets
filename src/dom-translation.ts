import { supabase } from './lib/supabase';
import {
  getCachedPublicTranslation,
  publicText,
  restorePublicTranslations,
  setPublicTranslations,
  type PublicLanguage,
} from './public-i18n';

type TextTarget = { node: Text; source: string; prefix: string; suffix: string };
type AttributeTarget = { element: Element; name: string; source: string };
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'aria-description', 'alt', 'data-tooltip'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO']);
const SKIP_TEXT_TAGS = new Set([...SKIP_TAGS, 'TEXTAREA', 'INPUT']);

export function startPublicDomTranslation(language: PublicLanguage, onFailure?: () => void): () => void {
  if (language === 'en' || typeof document === 'undefined' || !document.body) return () => {};
  restorePublicTranslations(language);
  document.documentElement.lang = language;
  document.documentElement.dir = ['ar', 'he', 'fa', 'ur'].includes(language) ? 'rtl' : 'ltr';

  const originals = new Map<Text, { value: string; translated: string }>();
  const attributeOriginals = new Map<Element, Map<string, { value: string; translated: string }>>();
  const pending = new Map<string, Array<() => void>>();
  const queue: string[] = [];
  let processing = false;
  let disposed = false;
  let initialPass = true;
  let failed = false;
  let observer: MutationObserver | null = null;

  const styleId = 'tm-language-visibility-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = 'html.tm-language-pending #root{visibility:hidden!important}';
    document.head.appendChild(style);
  }
  document.documentElement.classList.add('tm-language-pending');
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'tm-language-loading-overlay';
  loadingOverlay.setAttribute('role', 'status');
  loadingOverlay.setAttribute('aria-live', 'polite');
  loadingOverlay.setAttribute('data-no-translate', 'true');
  loadingOverlay.textContent = 'TESLA MARKETS\nPreparing your selected language…';
  Object.assign(loadingOverlay.style, {
    position: 'fixed', inset: '0', zIndex: '2147483647', display: 'grid',
    placeItems: 'center', padding: '28px', whiteSpace: 'pre-line',
    background: '#f5f5f5', color: '#171717', fontFamily: 'Arial, sans-serif',
    fontSize: '17px', fontWeight: '600', letterSpacing: '.02em', textAlign: 'center'
  });
  document.body.appendChild(loadingOverlay);

  const fallbackToEnglish = () => {
    if (failed || disposed) return;
    failed = true;
    pending.clear();
    queue.length = 0;
    observer?.disconnect();
    for (const [node, original] of originals) {
      if (node.isConnected && node.nodeValue === original.translated) node.nodeValue = original.value;
    }
    for (const [element, attributes] of attributeOriginals) {
      if (!element.isConnected) continue;
      for (const [name, original] of attributes) {
        if (element.getAttribute(name) === original.translated) element.setAttribute(name, original.value);
      }
    }
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    document.documentElement.classList.remove('tm-language-pending');
    loadingOverlay.remove();
    const notice = document.createElement('div');
    notice.className = 'tm-translation-fallback-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Translations are temporarily unavailable. This page is being shown in English.';
    Object.assign(notice.style, { position: 'fixed', zIndex: '99999', left: '12px', right: '12px', bottom: '12px', padding: '10px 14px', borderRadius: '10px', background: '#202124', color: '#fff', fontSize: '13px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,.2)' });
    document.body.appendChild(notice);
    window.setTimeout(() => notice.remove(), 6500);
    onFailure?.();
  };

  const isSkipped = (element: Element | null): boolean => {
    let current = element;
    while (current) {
      if (SKIP_TEXT_TAGS.has(current.tagName) || current.hasAttribute('data-no-translate') || current.getAttribute('contenteditable') === 'true') return true;
      if (current.matches('.tm-chat-message,.tm-chat-bubble,.tm-message-bubble,.chat-message,.user-message,.visitor-message')) return true;
      current = current.parentElement;
    }
    return false;
  };

  const isTextInViewport = (node: Text) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight && rect.right >= 0 && rect.left <= window.innerWidth;
  };

  const isElementInViewport = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight && rect.right >= 0 && rect.left <= window.innerWidth;
  };

  const applyText = (target: TextTarget, translated: string) => {
    if (disposed || failed || !target.node.isConnected) return;
    const current = target.node.nodeValue || '';
    if (current.trim() !== target.source) return;
    const value = target.prefix + translated + target.suffix;
    originals.set(target.node, { value: current, translated: value });
    target.node.nodeValue = value;
  };

  const applyAttribute = (target: AttributeTarget, translated: string) => {
    if (disposed || failed || !target.element.isConnected || target.element.getAttribute(target.name) !== target.source) return;
    const current = attributeOriginals.get(target.element) || new Map();
    current.set(target.name, { value: target.source, translated });
    attributeOriginals.set(target.element, current);
    target.element.setAttribute(target.name, translated);
  };

  const requestTranslation = (source: string, apply: () => void) => {
    const cached = getCachedPublicTranslation(language, source);
    if (cached) {
      apply();
      return cached;
    }
    const staticTranslation = publicText(source, language);
    if (staticTranslation !== source) {
      apply();
      return staticTranslation;
    }
    const callbacks = pending.get(source);
    if (callbacks) callbacks.push(apply);
    else {
      pending.set(source, [apply]);
      queue.push(source);
    }
    void flush();
    return null;
  };

  const translateTextNode = (node: Text) => {
    const parent = node.parentElement;
    if (!parent || isSkipped(parent) || failed || !isTextInViewport(node)) return;
    const current = node.nodeValue || '';
    const previous = originals.get(node);
    if (previous && current === previous.translated) return;
    const source = current.trim();
    if (!source || source.length < 2 || /^([\p{P}\p{S}\s]|\d)+$/u.test(source)) return;
    const start = current.indexOf(source);
    const target: TextTarget = {
      node,
      source,
      prefix: current.slice(0, start),
      suffix: current.slice(start + source.length),
    };
    const translated = getCachedPublicTranslation(language, source) || publicText(source, language);
    if (translated !== source) {
      applyText(target, translated);
      return;
    }
    requestTranslation(source, () => {
      const result = getCachedPublicTranslation(language, source) || publicText(source, language);
      if (result !== source) applyText(target, result);
    });
  };

  const translateAttributes = (element: Element) => {
    if (failed || !isElementInViewport(element)) return;
    let current: Element | null = element;
    while (current) {
      if (SKIP_TAGS.has(current.tagName) || current.hasAttribute('data-no-translate')) return;
      current = current.parentElement;
    }
    for (const name of TRANSLATABLE_ATTRIBUTES) {
      const source = element.getAttribute(name);
      if (!source || source.trim().length < 2) continue;
      const original = attributeOriginals.get(element)?.get(name);
      if (original && source === original.translated) continue;
      const cached = getCachedPublicTranslation(language, source) || publicText(source, language);
      if (cached !== source) {
        applyAttribute({ element, name, source }, cached);
      } else {
        requestTranslation(source, () => {
          const translated = getCachedPublicTranslation(language, source) || publicText(source, language);
          if (translated !== source) applyAttribute({ element, name, source }, translated);
        });
      }
    }
  };

  const scan = (root: Node) => {
    if (failed || disposed) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root as Text);
      return;
    }
    if (!(root instanceof Element) && root !== document.body) return;
    if (root instanceof Element) translateAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) translateTextNode(node as Text);
    if (root instanceof Element) root.querySelectorAll('*').forEach(translateAttributes);
  };

  async function flush() {
    if (processing || disposed || failed) return;
    processing = true;
    try {
      while (queue.length && !disposed && !failed) {
        const batches: string[][] = [];
        for (let index = 0; index < 2 && queue.length; index += 1) {
          batches.push(queue.splice(0, 20));
        }
        const translatedBatches = await Promise.all(batches.map(async (batch) => {
          const { data, error } = await supabase.functions.invoke('tesla-markets-translate', {
            body: {
              target_language: language,
              source_language: 'en',
              component: 'public-dom',
              texts: batch.map((text, index) => ({ key: String(index), text })),
            },
          });
          if (error || !Array.isArray(data?.translations) || data.translations.length !== batch.length) {
            throw new Error(error?.message || data?.error || 'Incomplete translation response');
          }
          const entries: Array<{ source: string; translated: string }> = [];
          for (const row of data.translations) {
            const index = Number(row?.key);
            const source = Number.isInteger(index) ? batch[index] : undefined;
            const translated = typeof row?.text === 'string' ? row.text.trim() : '';
            if (source && translated) entries.push({ source, translated });
          }
          if (entries.length !== batch.length) throw new Error('Translation response did not include every requested item');
          return entries;
        }));
        if (disposed || failed) return;
        const translatedEntries = translatedBatches.flat();
        setPublicTranslations(language, translatedEntries);
        for (const entry of translatedEntries) {
          for (const apply of pending.get(entry.source) || []) apply();
          pending.delete(entry.source);
        }
      }
    } catch (error) {
      console.error('Tesla Markets UI translation failed:', error instanceof Error ? error.message : error);
      fallbackToEnglish();
    } finally {
      processing = false;
      if (initialPass && !failed && !queue.length) {
        initialPass = false;
        document.documentElement.classList.remove('tm-language-pending');
        loadingOverlay.remove();
      }
      if (queue.length && !disposed && !failed) void flush();
    }
  }

  scan(document.body);
  if (!queue.length) {
    initialPass = false;
    document.documentElement.classList.remove('tm-language-pending');
    loadingOverlay.remove();
  }
  observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData' && record.target.nodeType === Node.TEXT_NODE) {
        translateTextNode(record.target as Text);
      } else if (record.type === 'attributes' && record.target instanceof Element && record.attributeName) {
        translateAttributes(record.target);
        if (['class', 'style', 'hidden', 'aria-expanded'].includes(record.attributeName)) scan(record.target);
      } else {
        record.addedNodes.forEach(scan);
      }
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...TRANSLATABLE_ATTRIBUTES, 'class', 'style', 'hidden', 'aria-expanded'] });

  let scrollScanQueued = false;
  const scanVisibleContent = () => {
    if (scrollScanQueued || disposed || failed) return;
    scrollScanQueued = true;
    window.requestAnimationFrame(() => {
      scrollScanQueued = false;
      if (!disposed && !failed) scan(document.body);
    });
  };
  window.addEventListener('scroll', scanVisibleContent, { passive: true });
  document.addEventListener('scroll', scanVisibleContent, { passive: true, capture: true });
  window.addEventListener('resize', scanVisibleContent, { passive: true });

  const fallback = window.setTimeout(() => { if (initialPass) fallbackToEnglish(); }, 90000);
  return () => {
    disposed = true;
    observer?.disconnect();
    window.removeEventListener('scroll', scanVisibleContent);
    document.removeEventListener('scroll', scanVisibleContent, true);
    window.removeEventListener('resize', scanVisibleContent);
    window.clearTimeout(fallback);
    document.documentElement.classList.remove('tm-language-pending');
    loadingOverlay.remove();
    for (const [node, original] of originals) {
      if (node.isConnected && node.nodeValue === original.translated) node.nodeValue = original.value;
    }
    for (const [element, attributes] of attributeOriginals) {
      if (!element.isConnected) continue;
      for (const [name, original] of attributes) {
        if (element.getAttribute(name) === original.translated) element.setAttribute(name, original.value);
      }
    }
  };
}
