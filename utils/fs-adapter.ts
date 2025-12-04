import { Buffer } from 'buffer';

let rootHandle: FileSystemDirectoryHandle | null = null;

export function setRootHandle(handle: FileSystemDirectoryHandle) {
    rootHandle = handle;
}

// Helper to resolve path to handle
async function getHandle(path: string, options: { create?: boolean; directory?: boolean } = {}) {
    if (!rootHandle) throw new Error("Root handle not set");
    // Normalize path
    const parts = path.split('/').filter(p => p !== '' && p !== '.');

    let current: FileSystemDirectoryHandle = rootHandle;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;

        if (isLast && !options.directory) {
            // If we are looking for a file
            try {
                return await current.getFileHandle(part, { create: options.create });
            } catch (e: any) {
                if (e.name === 'NotFoundError') throw { code: 'ENOENT' };
                throw e;
            }
        } else {
            // If we are looking for a directory (or traversing)
            try {
                current = await current.getDirectoryHandle(part, { create: options.create || (isLast && options.directory) });
            } catch (e: any) {
                if (e.name === 'NotFoundError') throw { code: 'ENOENT' };
                throw e;
            }
        }
    }
    return current;
}

export const promises = {
    readFile: async (path: string, options?: any) => {
        const handle = await getHandle(path) as FileSystemFileHandle;
        const file = await handle.getFile();
        const buffer = await file.arrayBuffer();
        const data = Buffer.from(buffer);
        if (options === 'utf8' || options?.encoding === 'utf8') {
            return data.toString('utf8');
        }
        return data;
    },
    writeFile: async (path: string, data: any, options?: any) => {
        const handle = await getHandle(path, { create: true }) as FileSystemFileHandle;
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
    },
    unlink: async (path: string) => {
        const parts = path.split('/').filter(p => p !== '' && p !== '.');
        const filename = parts.pop();
        if (!filename) throw { code: 'EINVAL' };
        const dirPath = parts.join('/');
        const dirHandle = await getHandle(dirPath, { directory: true }) as FileSystemDirectoryHandle;
        await dirHandle.removeEntry(filename);
    },
    readdir: async (path: string) => {
        const handle = await getHandle(path, { directory: true }) as FileSystemDirectoryHandle;
        const entries = [];
        // @ts-ignore - Async iterator
        for await (const [name, entry] of handle.entries()) {
            entries.push(name);
        }
        return entries;
    },
    mkdir: async (path: string) => {
        await getHandle(path, { create: true, directory: true });
    },
    rmdir: async (path: string) => {
        const parts = path.split('/').filter(p => p !== '' && p !== '.');
        const dirname = parts.pop();
        if (!dirname) throw { code: 'EINVAL' };
        const parentPath = parts.join('/');
        const parentHandle = await getHandle(parentPath, { directory: true }) as FileSystemDirectoryHandle;
        await parentHandle.removeEntry(dirname);
    },
    stat: async (path: string) => {
        const handle = await getHandle(path); // Could be file or dir
        // FileSystemHandle doesn't expose generic stat info like mtime/ctime easily for directories
        // For files we can get it.

        let stats: any = {
            isDirectory: () => handle.kind === 'directory',
            isFile: () => handle.kind === 'file',
            isSymbolicLink: () => false,
            size: 0,
            mtimeMs: Date.now(),
            mode: 0o777, // Mock mode
            uid: 0,
            gid: 0,
            ino: 0,
            dev: 0,
        };

        if (handle.kind === 'file') {
            const file = await (handle as FileSystemFileHandle).getFile();
            stats.size = file.size;
            stats.mtimeMs = file.lastModified;
        }

        return stats;
    },
    lstat: async (path: string) => {
        return promises.stat(path); // No symlink support in FS Access API usually
    },
    // readlink is required by isomorphic-git for symlinks, but we can stub it or throw
    readlink: async (path: string) => {
        throw { code: 'EINVAL', message: 'Symlinks not supported' };
    },
    symlink: async (target: string, path: string) => {
        throw { code: 'EINVAL', message: 'Symlinks not supported' };
    }
};

export default { promises };
