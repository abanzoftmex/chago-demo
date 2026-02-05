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
 * Add logo to PDF document maintaining aspect ratio
 * @param {jsPDF} doc - PDF document instance
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} maxHeight - Maximum height for the logo
 */
export const addLogoToPDF = async (doc, x = 15, y = 8, maxHeight = 25) => {
  try {
    // Try multiple logo paths in order of preference
    const logoUrls = [
      '/logo.jpg',
      window.location.origin + '/logo.jpg',
      './logo.jpg',
      'https://www.chagofc.com/demo-button-label-filled-icon.jpg',
      '/demo-button-label-filled-icon.jpg',
      window.location.protocol + '//' + window.location.host + '/demo-button-label-filled-icon.jpg',
      window.location.origin + '/demo-button-label-filled-icon.jpg',
      window.location.origin + '/public/demo-button-label-filled-icon.jpg',
      './demo-button-label-filled-icon.jpg',
      './logo.png'
    ];

    let logoData = null;
    let logoLoaded = false;

    for (const logoUrl of logoUrls) {
      try {
        logoData = await imageToBase64(logoUrl);
        logoLoaded = true;
        console.log('Logo loaded successfully from: ' + logoUrl);
        break;
      } catch (error) {
        console.log('Error with CORS from: ' + logoUrl + ' - ' + error.message);

        try {
          logoData = await imageToBase64NoCORS(logoUrl);
          logoLoaded = true;
          console.log('Logo loaded without CORS from: ' + logoUrl);
          break;
        } catch (noCorsError) {
          console.log('Error without CORS from: ' + logoUrl + ' - ' + noCorsError.message);
          continue;
        }
      }
    }

    if (!logoLoaded) {
      console.warn('Could not load logo from any location, using fallback...');
      // Use fallback text logo
      doc.setFontSize(14);
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('SISTEMA FINANCIERO', x, y + 10);
      console.log('Logo fallback applied (text)');
      return false;
    }

    // Calculate proportional width based on fixed height
    const aspectRatio = logoData.width / logoData.height;
    const logoHeight = maxHeight;
    const logoWidth = logoHeight * aspectRatio;

    // Add the logo image directly without container, maintaining aspect ratio
    doc.addImage(logoData.dataURL, 'PNG', x, y, logoWidth, logoHeight);

    console.log('Logo added successfully to PDF with proportional dimensions');
    return true;
  } catch (error) {
    console.error('Error adding logo to PDF:', error);
    console.log('Using text fallback...');

    // Fallback: Create a text logo
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.text('SISTEMA FINANCIERO', x, y + 10);

    console.log('Logo fallback applied (text)');
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