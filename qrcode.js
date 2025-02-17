// Updated QR code script with error handling and debugging
document.addEventListener('DOMContentLoaded', function() {
  // Check if QRCode library is loaded
  if (typeof QRCode === 'undefined') {
      console.error('QRCode library not loaded! Please check the script inclusion.');
      showError('QR Code library failed to load. Please refresh the page.');
      return;
  }

  // Initialize QR code on page load
  try {
      generateProfileQR(generateUserId());
  } catch (error) {
      console.error('Error during initial QR generation:', error);
      showError('Failed to generate QR code. Please try again.');
  }
});

function generateUserId() {
  const name = localStorage.getItem('name') || 'user';
  const timestamp = new Date().getTime();
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${timestamp}`;
}

function generateProfileQR(userId) {
  try {
      // Get user data with error checking
      const userData = {
          name: localStorage.getItem('name') || 'Not Provided',
          age: localStorage.getItem('age') || 'Not Provided',
          bloodType: localStorage.getItem('bloodType') || 'Not Provided',
          gender: localStorage.getItem('gender') || 'Not Provided',
          emergencyContacts: JSON.parse(localStorage.getItem('emergencyContacts') || '[]'),
          medicalConditions: localStorage.getItem('medicalConditions') || 'None',
          allergies: localStorage.getItem('allergies') || 'None',
          medications: localStorage.getItem('medications') || 'None'
      };

      // Generate temporary access key
      const tempKey = Math.random().toString(36).substring(2, 15);
      
      // Create expiry timestamp (24 hours from now)
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() + 24);
      
      // Create data package
      const dataPackage = {
          userData,
          accessKey: tempKey,
          expiry: expiryTime.toISOString(),
          id: userId
      };
      
      // Convert to base64
      const encodedData = btoa(JSON.stringify(dataPackage));
      
      // Create sharing URL
      const baseUrl = window.location.origin;
      const shareUrl = `${baseUrl}/emergency-profile.html?data=${encodedData}`;
      
      // Get QR container
      const qrContainer = document.getElementById('qrcode-container');
      if (!qrContainer) {
          throw new Error('QR code container not found');
      }
      
      // Clear previous QR code
      qrContainer.innerHTML = '';
      
      // Create new QR code
      new QRCode(qrContainer, {
          text: shareUrl,
          width: 200,
          height: 200,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
      });
      
      // Show download button
      const downloadButton = document.getElementById('download-qr');
      if (downloadButton) {
          downloadButton.style.display = 'inline-block';
      }
      
      // Store access key
      localStorage.setItem(`tempAccess_${userId}`, JSON.stringify({
          key: tempKey,
          expiry: expiryTime.toISOString()
      }));
      
      return shareUrl;
  } catch (error) {
      console.error('Error generating QR code:', error);
      showError('Failed to generate QR code. Please check your data and try again.');
      return null;
  }
}

function showError(message) {
  const container = document.getElementById('qrcode-container');
  if (container) {
      container.innerHTML = `
          <div style="color: red; padding: 20px; text-align: center;">
              <p>Error: ${message}</p>
          </div>
      `;
  }
}