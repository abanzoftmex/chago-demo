/**
 * Utility functions for handling logo in PDF generation
 */

/**
 * Convert image URL to base64 for PDF embedding with transparency handling
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<string>} Base64 encoded image
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
      reject(new Error(`Timeout loading image from: ${imageUrl}`));
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
        resolve(dataURL);
      } catch (error) {
        reject(new Error(`Canvas error for ${imageUrl}: ${error.message}`));
      }
    };

    img.onerror = (error) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to load image from: ${imageUrl}`));
    };

    // Try without CORS first, then with CORS if needed
    try {
      img.src = imageUrl;
    } catch (error) {
      clearTimeout(timeout);
      reject(new Error(`Error setting image source: ${error.message}`));
    }
  });
};

/**
 * Alternative image loading without CORS for local files
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<string>} Base64 encoded image
 */
export const imageToBase64NoCORS = (imageUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const timeout = setTimeout(() => {
      reject(new Error(`Timeout loading image (no CORS) from: ${imageUrl}`));
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
        resolve(dataURL);
      } catch (error) {
        reject(new Error(`Canvas error (no CORS) for ${imageUrl}: ${error.message}`));
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Failed to load image (no CORS) from: ${imageUrl}`));
    };

    img.src = imageUrl;
  });
};

/**
 * Add logo to PDF document
 * @param {jsPDF} doc - PDF document instance
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Logo width
 * @param {number} height - Logo height
 */
export const addLogoToPDF = async (doc, x = 15, y = 8, width = 25, height = 25) => {
  try {
    // Try multiple logo paths in order of preference
    const logoUrls = [
      'https://www.chagofc.com/demo-button-label-filled-icon.jpg',
      '/demo-button-label-filled-icon.jpg',
      // Try with protocol
      `${window.location.protocol}//${window.location.host}/demo-button-label-filled-icon.jpg`,
      `${window.location.origin}/demo-button-label-filled-icon.jpg`,
      // Try relative path
      `${window.location.origin}/public/demo-button-label-filled-icon.jpg`,
      './demo-button-label-filled-icon.jpg',
      './logo.png'
    ];

    let base64Logo = null;
    let logoLoaded = false;

    for (const logoUrl of logoUrls) {
      try {
        // Try with CORS first
        base64Logo = await imageToBase64(logoUrl);
        logoLoaded = true;
        console.log(`✅ Logo cargado exitosamente desde: ${logoUrl}`);
        break;
      } catch (error) {
        console.log(`❌ Error con CORS desde: ${logoUrl} - ${error.message}`);

        // Try without CORS for local files
        try {
          base64Logo = await imageToBase64NoCORS(logoUrl);
          logoLoaded = true;
          console.log(`✅ Logo cargado sin CORS desde: ${logoUrl}`);
          break;
        } catch (noCorsError) {
          console.log(`❌ Error sin CORS desde: ${logoUrl} - ${noCorsError.message}`);
          continue;
        }
      }
    }

    if (!logoLoaded) {
      console.warn('⚠️ No se pudo cargar el logo desde ninguna ubicación, usando fallback...');
      // Use fallback instead of throwing error
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, width, height, 3, 3, 'F');
      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38); // Red
      doc.setFont('helvetica', 'bold');
      doc.text('SFC', x + width / 2, y + height / 2 + 2, { align: 'center' });

      console.log('⚠️ Logo fallback aplicado (texto SFC)');
      return false;
    }

    // Create a white background circle/rectangle for the logo to remove black background
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, width, height, 3, 3, 'F');

    // Add the logo image to PDF with transparent background handling
    doc.addImage(base64Logo, 'PNG', x + 2, y + 2, width - 4, height - 4);

    console.log('✅ Logo añadido exitosamente al PDF');
    return true;
  } catch (error) {
    console.error('❌ Error adding logo to PDF:', error);
    console.log('🔄 Usando fallback de texto estilizado...');

    // Fallback: Create a styled text logo
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, width, height, 3, 3, 'F');
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38); // Red
    doc.setFont('helvetica', 'bold');
    doc.text('SFC', x + width / 2, y + height / 2 + 2, { align: 'center' });

    console.log('⚠️ Logo fallback aplicado (texto SFC)');
    return false;
  }
};

/**
 * Test function to verify logo loading works
 */
export const testLogoLoading = async () => {
  console.log('🧪 Testing logo loading...');

  const logoUrls = [
    'https://www.chagofc.com/demo-button-label-filled-icon.jpg',
    '/demo-button-label-filled-icon.jpg',
    '/logo-santi.png'
  ];

  for (const logoUrl of logoUrls) {
    try {
      const base64 = await imageToBase64(logoUrl);
      console.log(`✅ Successfully loaded: ${logoUrl}`);
      return { success: true, url: logoUrl, base64 };
    } catch (error) {
      console.log(`❌ Failed to load: ${logoUrl} - ${error.message}`);
    }
  }

  return { success: false, message: 'No logo could be loaded' };
};