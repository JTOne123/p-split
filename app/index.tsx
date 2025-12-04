import FileGroup from '@/components/FileGroup';
import Settings from '@/components/Settings';
import fs from '@/utils/fs-adapter';
import { FileDiff, checkout, createBranch, getBranches, getChangedFiles, getCurrentBranch, getFileContent, initializeRepo } from '@/utils/git-engine';
import { callLLM, loadLLMConfig, saveLLMConfig, type LLMProvider } from '@/utils/llm-service';
import git from 'isomorphic-git';
import { useEffect, useState } from 'react';
import { Button, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Group {
    id: string;
    name: string;
    prompt: string;
    files: string[];
}

export default function App() {
    const [repoLoaded, setRepoLoaded] = useState(false);
    const [branches, setBranches] = useState<string[]>([]);
    const [currentBranch, setCurrentBranch] = useState('');
    const [baseBranch, setBaseBranch] = useState('main');
    const [files, setFiles] = useState<FileDiff[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

    const [showSettings, setShowSettings] = useState(false);
    const [llmConfig, setLlmConfig] = useState(() => loadLLMConfig());
    const [useLLM, setUseLLM] = useState(false);

    const pickRepo = async () => {
        try {
            setError('');
            // @ts-ignore
            if (!window.showDirectoryPicker) {
                setError("File System Access API not supported in this browser.");
                return;
            }
            // @ts-ignore
            const handle = await window.showDirectoryPicker();
            setLoading(true);
            await initializeRepo(handle);
            setRepoLoaded(true);

            const branchList = await getBranches();
            setBranches(branchList);

            const current = await getCurrentBranch();
            setCurrentBranch(current || '');

            const base = branchList.find((b: string) => b === 'main' || b === 'master') || branchList[0];
            setBaseBranch(base);

            if (current) {
                await loadDiff(base, current);
            }
            setLoading(false);
        } catch (e: any) {
            setError(e.message);
            setLoading(false);
        }
    };

    const loadDiff = async (base: string, target: string) => {
        if (!base || !target) return;
        setLoading(true);
        try {
            const changes = await getChangedFiles(base, target);
            setFiles(changes);
        } catch (e: any) {
            setError("Error loading diff: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (repoLoaded) {
            loadDiff(baseBranch, currentBranch);
        }
    }, [baseBranch, currentBranch]);

    const toggleFileSelection = (path: string) => {
        const newSet = new Set(selectedFiles);
        if (newSet.has(path)) {
            newSet.delete(path);
        } else {
            newSet.add(path);
        }
        setSelectedFiles(newSet);
    };

    const createGroup = () => {
        const newGroup: Group = {
            id: Date.now().toString(),
            name: `Group ${groups.length + 1}`,
            prompt: '',
            files: Array.from(selectedFiles),
        };
        setGroups([...groups, newGroup]);
        setSelectedFiles(new Set()); // Clear selection
    };

    const updateGroup = (id: string, data: { name?: string, prompt?: string }) => {
        setGroups(groups.map(g => g.id === id ? { ...g, ...data } : g));
    };

    const removeFileFromGroup = (groupId: string, file: string) => {
        setGroups(groups.map(g => g.id === groupId ? { ...g, files: g.files.filter(f => f !== file) } : g));
    };

    const deleteGroup = (id: string) => {
        setGroups(groups.filter(g => g.id !== id));
    };

    const handleCreateBranch = async (groupId: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        setLoading(true);
        try {
            // 1. Create Branch from Base
            const branchName = group.name.replace(/\s+/g, '-').toLowerCase();
            await checkout(baseBranch); // Go to base first
            await createBranch(branchName);
            await checkout(branchName);

            // 2. Apply changes
            for (const filePath of group.files) {
                // Read content from target branch
                const content = await getFileContent(currentBranch, filePath);

                let finalContent = content;

                // Use LLM if configured and enabled
                if (useLLM && llmConfig?.apiKey) {
                    try {
                        finalContent = await callLLM(group.prompt, content, llmConfig);
                    } catch (e: any) {
                        console.warn('LLM processing failed, using original content:', e.message);
                        // Fall back to original content if LLM fails
                    }
                }

                // Write to FS (which is now on the new branch)
                await fs.promises.writeFile(filePath, finalContent);

                // Stage
                await git.add({ fs, dir: '/', filepath: filePath });
            }

            // 3. Commit
            await git.commit({
                fs,
                dir: '/',
                message: `Split: ${group.name}\n\nPrompt: ${group.prompt}`,
                author: {
                    name: 'p-split',
                    email: 'p-split@local',
                    timestamp: Math.floor(Date.now() / 1000)
                }
            });

            alert(`Branch '${branchName}' created successfully!`);

            // Return to previous state
            await checkout(currentBranch);

        } catch (e: any) {
            setError("Error creating branch: " + e.message);
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = (provider: LLMProvider, apiKey: string, endpoint?: string) => {
        const config = { provider, apiKey, endpoint };
        saveLLMConfig(config);
        setLlmConfig(config);
        setShowSettings(false);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>p-split</Text>
                <View style={styles.headerButtons}>
                    <Button title="⚙️ Settings" onPress={() => setShowSettings(true)} />
                    <Button title={repoLoaded ? "Change Repo" : "Open Repo"} onPress={pickRepo} />
                </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {repoLoaded && (
                <View style={styles.content}>
                    <View style={styles.leftPanel}>
                        <View style={styles.controls}>
                            <View style={styles.controlGroup}>
                                <Text>Base: </Text>
                                <select
                                    value={baseBranch}
                                    onChange={(e) => setBaseBranch(e.target.value)}
                                    // @ts-ignore
                                    style={styles.select}
                                >
                                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </View>
                            <View style={styles.controlGroup}>
                                <Text>Target: </Text>
                                <select
                                    value={currentBranch}
                                    onChange={(e) => setCurrentBranch(e.target.value)}
                                    // @ts-ignore
                                    style={styles.select}
                                >
                                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </View>
                        </View>

                        <View style={styles.fileHeader}>
                            <Text style={styles.subtitle}>Changed Files ({files.length})</Text>
                            <View style={styles.fileHeaderRight}>
                                <label style={styles.llmToggle as any}>
                                    <input
                                        type="checkbox"
                                        checked={useLLM}
                                        onChange={(e) => setUseLLM(e.target.checked)}
                                        disabled={!llmConfig?.apiKey}
                                    />
                                    <Text style={styles.llmToggleText}>Use LLM</Text>
                                </label>
                                <Button title={`Create Group (${selectedFiles.size})`} onPress={createGroup} disabled={selectedFiles.size === 0} />
                            </View>
                        </View>

                        {loading ? <Text>Loading...</Text> : (
                            <ScrollView style={styles.fileList}>
                                {files.map((file, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[styles.fileItem, selectedFiles.has(file.path) && styles.selectedFile]}
                                        onPress={() => toggleFileSelection(file.path)}
                                    >
                                        <Text style={styles.filePath}>{file.path}</Text>
                                        <Text style={[styles.status, styles[file.status]]}>{file.status}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>

                    <View style={styles.rightPanel}>
                        <Text style={styles.subtitle}>Groups</Text>
                        <ScrollView style={styles.groupList}>
                            {groups.map(g => (
                                <FileGroup
                                    key={g.id}
                                    {...g}
                                    onUpdate={updateGroup}
                                    onRemoveFile={removeFileFromGroup}
                                    onCreateBranch={handleCreateBranch}
                                    onDeleteGroup={deleteGroup}
                                />
                            ))}
                            {groups.length === 0 && <Text style={styles.emptyText}>Select files and click "Create Group"</Text>}
                        </ScrollView>
                    </View>
                </View>
            )}

            {showSettings && (
                <Settings
                    onSave={handleSaveSettings}
                    onCancel={() => setShowSettings(false)}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
        // @ts-ignore
        height: Platform.OS === 'web' ? '100vh' : '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        height: 50,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    error: {
        color: 'red',
        marginBottom: 10,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        gap: 20,
    },
    leftPanel: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 15,
        display: 'flex',
        flexDirection: 'column',
    },
    rightPanel: {
        flex: 1,
        backgroundColor: '#eee',
        borderRadius: 8,
        padding: 15,
    },
    controls: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 15,
    },
    controlGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    select: {
        flex: 1,
        padding: 5,
        marginLeft: 5,
    },
    fileHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    fileHeaderRight: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },
    llmToggle: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    llmToggleText: {
        fontSize: 14,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 10,
    },
    fileList: {
        flex: 1,
    },
    fileItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    selectedFile: {
        backgroundColor: '#e3f2fd',
    },
    filePath: {
        flex: 1,
    },
    status: {
        fontWeight: '600',
        textTransform: 'uppercase',
        fontSize: 12,
    },
    added: {
        color: 'green',
    },
    modified: {
        color: 'orange',
    },
    deleted: {
        color: 'red',
    },
    groupList: {
        flex: 1,
    },
    emptyText: {
        color: '#999',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 20,
    },
});
