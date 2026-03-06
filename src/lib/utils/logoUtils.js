/**
 * Utility functions for handling logo in PDF generation
 */

/**
 * Convert image URL to base64 for PDF embedding with transparency handling
 * Also returns image dimensions
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<{dataURL: string, width: number, height: number}>} Base64 encoded image with dimensions
 */
export const imageToBase64 = (imageUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // Set CORS for external URLs, but not for local ones
    if (imageUrl.startsWith('http') && !imageUrl.includes(window.location.origin)) {
      img.crossOrigin = 'anonymous';
    }

    // Set timeout for loading
    const timeout = setTimeout(() => {
      reject(new Error('Timeout loading image from: ' + imageUrl));
    }, 10000); // 10 second timeout for external URLs

    img.onload = () => {
      clearTimeout(timeout);

      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = img.width;
        canvas.height = img.height;

        // Fill with white background first to handle transparency
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the image on top
        ctx.drawImage(img, 0, 0);

        // Convert to PNG for better transparency support
        const dataURL = canvas.toDataURL('image/png');
        resolve({ dataURL: dataURL, width: img.width, height: img.height });
      } catch (error) {
        reject(new Error('Canvas error for ' + imageUrl + ': ' + error.message));
      }
    };

    img.onerror = (error) => {
      clearTimeout(timeout);
      reject(new Error('Failed to load image from: ' + imageUrl));
    };

    // Try without CORS first, then with CORS if needed
    try {
      img.src = imageUrl;
    } catch (error) {
      clearTimeout(timeout);
      reject(new Error('Error setting image source: ' + error.message));
    }
  });
};

/**
 * Alternative image loading without CORS for local files
 * Also returns image dimensions
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<{dataURL: string, width: number, height: number}>} Base64 encoded image with dimensions
 */
export const imageToBase64NoCORS = (imageUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const timeout = setTimeout(() => {
      reject(new Error('Timeout loading image (no CORS) from: ' + imageUrl));
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);

      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = img.width;
        canvas.height = img.height;

        // Fill with white background first
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the image on top
        ctx.drawImage(img, 0, 0);

        const dataURL = canvas.toDataURL('image/png');
        resolve({ dataURL: dataURL, width: img.width, height: img.height });
      } catch (error) {
        reject(new Error('Canvas error (no CORS) for ' + imageUrl + ': ' + error.message));
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load image (no CORS) from: ' + imageUrl));
    };

    img.src = imageUrl;
  });
};

/**
 * Draw "EYS" initials as fallback logo in PDF header
 */
const drawEYSFallback = (doc, x, y, maxHeight) => {
  const boxW = 30;
  const boxH = maxHeight;
  doc.setFillColor(255, 255, 255, 0.15);
  doc.roundedRect(x, y, boxW, boxH, 3, 3, 'F');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('EYS', x + boxW / 2, y + boxH / 2 + 3, { align: 'center' });
};

/**
 * Add logo to PDF document maintaining aspect ratio.
 * @param {jsPDF} doc - PDF document instance
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} maxHeight - Maximum height for the logo
 * @param {string|null} logoUrl - Firebase Storage URL for the logo (optional)
 */
export const addLogoToPDF = async (doc, x = 15, y = 8, maxHeight = 25, logoUrl = null) => {
  if (!logoUrl) {
    drawEYSFallback(doc, x, y, maxHeight);
    return false;
  }

  try {
    let logoData = null;

    try {
      logoData = await imageToBase64(logoUrl);
    } catch {
      logoData = await imageToBase64NoCORS(logoUrl);
    }

    const aspectRatio = logoData.width / logoData.height;
    const logoHeight = maxHeight;
    const logoWidth = logoHeight * aspectRatio;

    doc.addImage(logoData.dataURL, 'PNG', x, y, logoWidth, logoHeight);
    return true;
  } catch (error) {
    console.warn('Could not load logo image, using EYS fallback:', error.message);
    drawEYSFallback(doc, x, y, maxHeight);
    return false;
  }
};

/**
 * Test function to verify logo loading works
 */
export const testLogoLoading = async () => {
  console.log('Testing logo loading...');

  const logoUrls = [
    'https://www.chagofc.com/demo-button-label-filled-icon.jpg',
    '/demo-button-label-filled-icon.jpg',
    '/logo-santi.png'
  ];

  for (const logoUrl of logoUrls) {
    try {
      const logoData = await imageToBase64(logoUrl);
      console.log('Successfully loaded: ' + logoUrl);
      return { success: true, url: logoUrl, data: logoData };
    } catch (error) {
      console.log('Failed to load: ' + logoUrl + ' - ' + error.message);
    }
  }

  return { success: false, message: 'No logo could be loaded' };
};