// Modified 2026 by Treslibre Project (Treslibre).
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const desktopRoot = path.resolve(import.meta.dirname, '..');
const targets = ['tsconfig.json', 'config', 'src', 'packaging'];
const tsconfigFiles = [];

function collect(relPath) {
    const absPath = path.join(desktopRoot, relPath);
    const stat = fs.statSync(absPath);
    if (stat.isFile()) {
        if (path.basename(absPath) === 'tsconfig.json') {
            tsconfigFiles.push(relPath);
        }
        return;
    }
    for (const entry of fs.readdirSync(absPath, {withFileTypes: true})) {
        if (entry.isDirectory()) {
            collect(path.join(relPath, entry.name));
        } else if (entry.name === 'tsconfig.json') {
            tsconfigFiles.push(path.join(relPath, entry.name));
        }
    }
}

for (const target of targets) {
    collect(target);
}

const tscBin = path.join(
    desktopRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);

for (const tsconfig of tsconfigFiles) {
    execFileSync(tscBin, ['--noEmit', '-p', tsconfig], {
        cwd: desktopRoot,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
}
