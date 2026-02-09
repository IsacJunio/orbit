const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

// Configuração
const CACHE_DIR = path.resolve('.cache/electron-builder');
const WIN_CODE_SIGN_VER = 'winCodeSign-2.6.0';
const DOWNLOAD_URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${WIN_CODE_SIGN_VER}/${WIN_CODE_SIGN_VER}.7z`;
const DEST_DIR = path.join(CACHE_DIR, 'winCodeSign', WIN_CODE_SIGN_VER);
const SEVEN_ZIP_PATH = path.resolve('node_modules/7zip-bin/win/x64/7za.exe');

async function main() {
    console.log('[TOOLS] Verificando ferramentas de build...');

    if (fs.existsSync(DEST_DIR)) {
        console.log(`[OK] ${WIN_CODE_SIGN_VER} ja existe em: ${DEST_DIR}`);
        // Validar se tem arquivos dentro
        if (fs.readdirSync(DEST_DIR).length > 0) {
            return;
        }
    }

    console.log(`[INFO] Baixando ${WIN_CODE_SIGN_VER}...`);

    // Criar diretórios
    const winCodeSignCacheDir = path.dirname(DEST_DIR);
    if (!fs.existsSync(winCodeSignCacheDir)) {
        fs.mkdirSync(winCodeSignCacheDir, { recursive: true });
    }

    const archivePath = path.join(winCodeSignCacheDir, `${WIN_CODE_SIGN_VER}.7z`);

    // 1. Download com suporte a Redirect
    try {
        await downloadFileFollowRedirects(DOWNLOAD_URL, archivePath);
    } catch (e) {
        console.error('[ERRO] Falha no download:', e.message);
        process.exit(1);
    }

    // 2. Extract
    console.log('[INFO] Extraindo arquivos (ignorando erros de symlink)...');

    if (!fs.existsSync(SEVEN_ZIP_PATH)) {
        console.error(`[ERRO] 7zip binario nao encontrado em: ${SEVEN_ZIP_PATH}`);
        process.exit(1);
    }

    try {
        // x: extract
        // -y: yes to all
        // -o: output dir
        const cmd = `"${SEVEN_ZIP_PATH}" x -bd -y "${archivePath}" -o"${DEST_DIR}"`;
        execSync(cmd, { stdio: 'pipe' });
    } catch (error) {
        const stderr = error.stderr ? error.stderr.toString() : '';
        const stdout = error.stdout ? error.stdout.toString() : '';

        // Se for erro de symlink, ignorar
        if (stderr.includes('Cannot create symbolic link') || stdout.includes('Cannot create symbolic link')) {
            console.log('[AVISO] Erros de Symlink detectados e ignorados (seguro para Windows).');
        } else {
            console.log('[AVISO] Erro na extracao (pode ser inofensivo):', stderr || error.message);
        }
    }

    // 3. Cleanup
    if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
    }

    console.log(`[OK] Ferramentas preparadas.`);
}

function downloadFileFollowRedirects(url, dest) {
    return new Promise((resolve, reject) => {
        const getRequest = (currentUrl) => {
            https.get(currentUrl, (response) => {
                // Redirect handle
                if (response.statusCode === 301 || response.statusCode === 302) {
                    if (response.headers.location) {
                        console.log(`[INFO] Redirecionando para: ${response.headers.location}`);
                        getRequest(response.headers.location);
                        return;
                    }
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`Falha no download. Status: ${response.statusCode}`));
                    return;
                }

                const file = fs.createWriteStream(dest);
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => { });
                reject(err);
            });
        };
        getRequest(url);
    });
}

main().catch(err => {
    console.error('[ERRO Fatal]', err);
    process.exit(1);
});
