import fs from 'fs';
import pngToIco from 'png-to-ico';

console.log('Generating icon.ico from icon.png...');

// png-to-ico might expect a file path string or array
try {
    const buf = await pngToIco('resources/icon.png');
    fs.writeFileSync('resources/icon.ico', buf);
    console.log('Successfully created resources/icon.ico with multiple sizes!');
} catch (err) {
    console.error('Error converting icon:', err);
    process.exit(1);
}
