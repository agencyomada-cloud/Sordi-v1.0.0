export interface ExtractOptions {
  paper_size?: string;
  landscape?: boolean;
}

/**
 * Fetches external CSS content and returns it as a string
 */
async function fetchCss(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch CSS from ${url}:`, error);
    return '';
  }
}

/**
 * Converts an image URL to a Base64 data URL
 */
async function imageToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) return url;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`Failed to convert image to base64: ${url}`, error);
    return url;
  }
}

export const extractInvoiceHtml = async (elementId: string, options?: ExtractOptions): Promise<string> => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id ${elementId} not found`);
  }

  // Sync form values to attributes so they are captured in cloneNode
  const inputs = element.querySelectorAll('input');
  inputs.forEach(input => {
    if (input.type === 'checkbox' || input.type === 'radio') {
      if (input.checked) input.setAttribute('checked', 'checked');
      else input.removeAttribute('checked');
    } else {
      input.setAttribute('value', input.value);
    }
  });

  const textareas = element.querySelectorAll('textarea');
  textareas.forEach(textarea => {
    textarea.textContent = textarea.value;
  });

  const selects = element.querySelectorAll('select');
  selects.forEach(select => {
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) {
      selectedOption.setAttribute('selected', 'selected');
    }
  });

  // Clone to avoid modifying the live view
  const clone = element.cloneNode(true) as HTMLElement;

  // Determine dimensions
  const isA3 = options?.paper_size?.toUpperCase() === 'A3';
  const isLandscape = options?.landscape === true;

  // Widths in mm
  const widthMm = isA3 ? (isLandscape ? 420 : 297) : (isLandscape ? 297 : 210);
  const heightMm = isA3 ? (isLandscape ? 297 : 420) : (isLandscape ? 210 : 297);

  // Ensure it's using the full width for print/pdf
  clone.style.width = `${widthMm}mm`;
  clone.style.minHeight = `${heightMm}mm`;
  clone.style.height = 'auto'; // allow expansion
  clone.style.margin = '0 auto';
  clone.style.backgroundColor = 'white';

  // Fix: Remove preview-specific styles (margins, shadows) from pages for clean PDF generation
  const pages = clone.querySelectorAll('[id^="invoice-preview-page-"]');
  pages.forEach((node) => {
    const page = node as HTMLElement;
    page.style.margin = '0';
    page.style.boxShadow = 'none';
    page.style.transform = 'none';
  });

  // We want to capture the styles
  let styles = '';

  // 1. Get all style tags (Tailwind injects here in dev)
  const styleTags = document.querySelectorAll('style');
  styleTags.forEach(tag => {
    styles += tag.outerHTML;
  });

  // 2. Get all linked stylesheets (Production build, Google Fonts)
  // CRITICAL: We fetch and inline these because the backend can't resolve tauri:// URLs
  const linkTags = document.querySelectorAll('link[rel="stylesheet"]');
  for (const tag of Array.from(linkTags)) {
    const href = (tag as HTMLLinkElement).href;
    if (href) {
      let absoluteHref = href;
      if (href.startsWith('/')) {
        absoluteHref = `${window.location.origin}${href}`;
      }

      // Don't inline Google Fonts or external CDN links to avoid massive Blobs, 
      // but inline local app styles (main.css / index.css bundled output)
      if (absoluteHref.includes(window.location.origin) || !absoluteHref.startsWith('http')) {
        const cssContent = await fetchCss(absoluteHref);
        styles += `<style data-inlined-from="${absoluteHref}">${cssContent}</style>\n`;
      } else {
        // Keep external links as is (though backend might still fail to fetch them, 
        // usually Google Fonts are okay if backend has internet)
        styles += tag.outerHTML;
      }
    }
  }

  // 3. Process images in the clone to ensure absolute paths and Base64 inlining
  const images = clone.querySelectorAll('img');
  for (const img of Array.from(images)) {
    const src = img.getAttribute('src');
    if (src) {
      let absoluteSrc = src;
      if (src.startsWith('/')) {
        absoluteSrc = `${window.location.origin}${src}`;
      }

      // Convert to Base64 to ensure it works in headless chrome without local server access
      const base64 = await imageToBase64(absoluteSrc);
      img.setAttribute('src', base64);
    }
  }

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Invoice PDF</title>
        ${styles}
        <style>
          /* Inject print specific resets */
          @page {
            size: ${options?.paper_size || 'A4'} ${isLandscape ? 'landscape' : 'portrait'};
            margin: 0;
          }
          html {
            font-size: 16px; /* Ensure 1rem = 16px consistency */
            -webkit-font-smoothing: antialiased;
          }
          body {
            margin: 0;
            padding: 0;
            background-color: white;
            -webkit-print-color-adjust: exact;
            width: ${widthMm}mm;
          }
          /* Ensure strict box-sizing */
          *, *::before, *::after {
            box-sizing: border-box;
          }
          /* Ensure visible */
          * {
             visibility: visible !important;
          }
        </style>
      </head>
      <body>
        <div style="width: ${widthMm}mm; margin: 0; padding: 0;">
          ${clone.outerHTML}
        </div>
      </body>
    </html>
  `;

  return fullHtml;
};
