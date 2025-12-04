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

// File descriptor management
let nextFd = 10;

// FileHandle implementation
class FileHandle {
    private handle: FileSystemFileHandle;
    private position: number;
    public fd: number;

    constructor(handle: FileSystemFileHandle, fd: number) {
        this.handle = handle;
        this.position = 0;
        this.fd = fd;
    }

    async read(buffer: Buffer | Uint8Array, offset: number, length: number, position: number | null) {
        console.error('[FS] FileHandle.read', this.fd, 'len:', length, 'pos:', position, 'offset:', offset);
        const file = await this.handle.getFile();

        let readPos = position;
        if (readPos === null || readPos === undefined) {
            readPos = this.position;
        }

        const slice = file.slice(readPos, readPos + length);
        const arrayBuffer = await slice.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        if (position === null || position === undefined) {
            this.position += data.length;
        }

        if (Buffer.isBuffer(buffer)) {
            buffer.set(data, offset);
        } else {
            (buffer as Uint8Array).set(data, offset);
        }

        return { bytesRead: data.length, buffer };
    }

    async close() {
        console.error('[FS] FileHandle.close', this.fd);
        // No real close needed for FileSystemHandle, but we can cleanup if needed
    }

    async stat() {
        const file = await this.handle.getFile();
        return {
            isDirectory: () => false,
            isFile: () => true,
            isSymbolicLink: () => false,
            size: file.size,
            mtimeMs: file.lastModified,
            mode: 0o777,
            uid: 0,
            gid: 0,
            ino: 0,
            dev: 0,
        };
    }
}

export const promises = {
    readFile: async (path: string, options?: any) => {
        console.error('[FS] readFile', path);
        if (!path || path === 'undefined') {
            throw { code: 'ENOENT', message: `Invalid path: ${path}` };
        }
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
    },
    // Random access implementation matching Node.js fs.promises
    open: async (path: string, flags: string) => {
        console.error('[FS] open', path, flags);
        const handle = await getHandle(path, { create: flags.includes('w') }) as FileSystemFileHandle;
        const fd = nextFd++;
        return new FileHandle(handle, fd);
    }
};

export default { promises };
