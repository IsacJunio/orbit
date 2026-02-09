// Simple test to check Electron loading
try {
    const electron = require('electron');
    console.log('Electron module loaded:', typeof electron);
    console.log('electron.app:', typeof electron.app);
    console.log('Keys:', Object.keys(electron));
} catch (e) {
    console.error('Error:', e.message);
}
