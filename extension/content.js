// Content script for extracting text from pages

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    const selectedText = window.getSelection().toString().trim();
    sendResponse({ text: selectedText, success: !!selectedText });
  } else if (request.action === 'getMediumArticle') {
    const result = extractMediumArticle();
    sendResponse(result);
  }
  return true;
});

// Extract text from Medium article
function extractMediumArticle() {
  const hostname = window.location.hostname;

  // Check if we're on Medium or a Medium-based site
  const isMedium = hostname.includes('medium.com') ||
                   document.querySelector('meta[property="al:android:app_name"][content="Medium"]') ||
                   document.querySelector('script[src*="medium.com"]');

  if (!isMedium && !hostname.includes('medium.com')) {
    // Try to detect Medium-like article structure anyway
    const article = extractGenericArticle();
    if (article.success) {
      return article;
    }
    return {
      success: false,
      error: 'This doesn\'t appear to be a Medium article. Try selecting text instead.'
    };
  }

  try {
    let articleText = '';

    // Medium article selectors (they change sometimes, so we try multiple)
    const selectors = [
      'article',
      '[data-testid="post-content"]',
      '.postArticle-content',
      '.section-content',
      'main article',
      '.story-content'
    ];

    let articleElement = null;
    for (const selector of selectors) {
      articleElement = document.querySelector(selector);
      if (articleElement) break;
    }

    if (!articleElement) {
      return { success: false, error: 'Could not find article content on this page.' };
    }

    // Get all paragraphs and headings
    const contentElements = articleElement.querySelectorAll('p, h1, h2, h3, h4, blockquote, li');

    const textParts = [];
    contentElements.forEach(el => {
      // Skip elements that are likely not content
      if (el.closest('footer') ||
          el.closest('[data-testid="headerSocialLinks"]') ||
          el.closest('.postMetaInline') ||
          el.closest('figcaption')) {
        return;
      }

      const text = el.textContent.trim();
      if (text && text.length > 0) {
        textParts.push(text);
      }
    });

    articleText = textParts.join(' ');

    if (!articleText || articleText.length < 50) {
      return { success: false, error: 'Could not extract enough text from this article.' };
    }

    // Get article title
    const titleEl = document.querySelector('h1') || document.querySelector('title');
    const title = titleEl ? titleEl.textContent.trim() : 'Medium Article';

    return {
      success: true,
      text: articleText,
      title: title,
      wordCount: articleText.split(/\s+/).length
    };

  } catch (error) {
    return { success: false, error: 'Error extracting article: ' + error.message };
  }
}

// Try to extract from any article-like page
function extractGenericArticle() {
  try {
    // Common article selectors
    const selectors = [
      'article',
      '[role="article"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      'main .content',
      '.story-body'
    ];

    let articleElement = null;
    for (const selector of selectors) {
      articleElement = document.querySelector(selector);
      if (articleElement) break;
    }

    if (!articleElement) {
      return { success: false };
    }

    const contentElements = articleElement.querySelectorAll('p, h1, h2, h3, h4, blockquote, li');
    const textParts = [];

    contentElements.forEach(el => {
      if (el.closest('footer') || el.closest('nav') || el.closest('aside')) {
        return;
      }
      const text = el.textContent.trim();
      if (text && text.length > 0) {
        textParts.push(text);
      }
    });

    const articleText = textParts.join(' ');

    if (!articleText || articleText.length < 100) {
      return { success: false };
    }

    const titleEl = document.querySelector('h1') || document.querySelector('title');
    const title = titleEl ? titleEl.textContent.trim() : 'Article';

    return {
      success: true,
      text: articleText,
      title: title,
      wordCount: articleText.split(/\s+/).length
    };

  } catch (error) {
    return { success: false };
  }
}
