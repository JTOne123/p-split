import git from 'isomorphic-git';
import fs, { setRootHandle } from './fs-adapter';

const dir = '/';

export async function initializeRepo(handle: FileSystemDirectoryHandle) {
    setRootHandle(handle);
    try {
        await git.resolveRef({ fs, dir, ref: 'HEAD' });
        return true;
    } catch (e) {
        throw new Error("Not a valid git repository");
    }
}

export async function getBranches() {
    return await git.listBranches({ fs, dir });
}

export async function getCurrentBranch() {
    return await git.currentBranch({ fs, dir });
}

export async function createBranch(name: string) {
    await git.branch({ fs, dir, ref: name });
}

export async function checkout(ref: string) {
    await git.checkout({ fs, dir, ref });
}

export interface FileDiff {
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'unmodified';
}

export async function getChangedFiles(baseBranch: string, targetBranch: string): Promise<FileDiff[]> {
    // This is a simplified diff. Real diffing requires comparing trees.
    // We will compare targetBranch (e.g. 'feature') against baseBranch (e.g. 'main')

    const baseCommit = await git.resolveRef({ fs, dir, ref: baseBranch });
    const targetCommit = await git.resolveRef({ fs, dir, ref: targetBranch });

    const { walk, TREE, WORKDIR } = git;

    // We want to compare the two trees.
    // Actually, usually we want to compare the WORKDIR (or current HEAD) vs a base branch.
    // The user requirement: "get current git branch compare to master/main/other branch"

    // Let's assume we compare HEAD vs baseBranch.

    const files: FileDiff[] = [];

    try {
        console.error('[GitEngine] starting walk with fs:', Object.keys(fs.promises));
        await walk({
            fs,
            dir,
            trees: [TREE({ ref: baseBranch }), TREE({ ref: targetBranch })],
            map: async (filepath, [baseEntry, targetEntry]) => {
                if (filepath === '.') return;

                const baseType = await baseEntry?.type();
                const targetType = await targetEntry?.type();

                if (baseType === 'tree' || targetType === 'tree') return; // Skip directories in output

                const baseOid = await baseEntry?.oid();
                const targetOid = await targetEntry?.oid();

                if (!baseOid && targetOid) {
                    files.push({ path: filepath, status: 'added' });
                } else if (baseOid && !targetOid) {
                    files.push({ path: filepath, status: 'deleted' });
                } else if (baseOid !== targetOid) {
                    files.push({ path: filepath, status: 'modified' });
                }
            },
        });
    } catch (e: any) {
        console.error("Error walking git tree:", e);
        if (e.message && e.message.includes("Cannot read properties of null (reading 'slice')")) {
            throw new Error("Failed to load diff. The repository might be too large for the browser to handle (isomorphic-git limitation).");
        }
        throw e;
    }

    return files;
}

export async function getFileContent(ref: string, filepath: string): Promise<string> {
    try {
        const { blob } = await git.readBlob({
            fs,
            dir,
            oid: await git.resolveRef({ fs, dir, ref }),
            filepath
        });
        return Buffer.from(blob).toString('utf8');
    } catch (e) {
        return "";
    }
}
