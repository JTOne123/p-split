import { Change, diffLines } from 'diff';
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

export interface DiffFile {
    path: string;
    original: string;
    modified: string;
}

interface DiffViewProps {
    files: DiffFile[];
}

const CONTEXT_LINES = 3;

interface Hunk {
    changes: Change[];
    startLineOriginal: number;
    startLineModified: number;
}

export default function DiffView({ files }: DiffViewProps) {
    const processedFiles = useMemo(() => {
        return files.map(file => {
            const changes = diffLines(file.original, file.modified);
            const hunks: Hunk[] = [];
            let currentHunk: Change[] = [];
            let lastChangeWasDiff = false;

            // Helper to split a change into lines
            const splitLines = (text: string) => {
                if (text.length === 0) return [];
                const lines = text.split('\n');
                // diffLines often ends with a newline, causing an empty string at the end of split
                if (lines[lines.length - 1] === '') lines.pop();
                return lines.map(line => line + '\n');
            };

            for (let i = 0; i < changes.length; i++) {
                const change = changes[i];
                const isDiff = change.added || change.removed;

                if (isDiff) {
                    currentHunk.push(change);
                    lastChangeWasDiff = true;
                } else {
                    // Unchanged block
                    const lines = splitLines(change.value);

                    if (lastChangeWasDiff) {
                        // We just finished a diff block.
                        // Check if the NEXT block is also a diff (or if we are close enough to it)
                        // Actually, we need to look ahead.

                        // If this is the last block, just take the first CONTEXT_LINES
                        if (i === changes.length - 1) {
                            if (lines.length > CONTEXT_LINES) {
                                currentHunk.push({ value: lines.slice(0, CONTEXT_LINES).join(''), count: CONTEXT_LINES, added: false, removed: false });
                                hunks.push({ changes: currentHunk, startLineOriginal: 0, startLineModified: 0 }); // Line numbers TODO
                                currentHunk = [];
                            } else {
                                currentHunk.push(change);
                                hunks.push({ changes: currentHunk, startLineOriginal: 0, startLineModified: 0 });
                                currentHunk = [];
                            }
                        } else {
                            // There is another change coming.
                            // If the gap is small enough, keep the whole block.
                            // Gap size = lines.length
                            if (lines.length <= CONTEXT_LINES * 2) {
                                currentHunk.push(change);
                            } else {
                                // Gap is too big. Split it.
                                // 1. Finish current hunk with context
                                currentHunk.push({ value: lines.slice(0, CONTEXT_LINES).join(''), count: CONTEXT_LINES, added: false, removed: false });
                                hunks.push({ changes: currentHunk, startLineOriginal: 0, startLineModified: 0 });
                                currentHunk = [];

                                // 2. Start new hunk with context
                                currentHunk.push({ value: lines.slice(lines.length - CONTEXT_LINES).join(''), count: CONTEXT_LINES, added: false, removed: false });
                            }
                        }
                    } else {
                        // This is the first block (start of file) and it is unchanged.
                        // If the file starts with a huge unchanged block, we only want the end of it.
                        if (lines.length > CONTEXT_LINES) {
                            currentHunk.push({ value: lines.slice(lines.length - CONTEXT_LINES).join(''), count: CONTEXT_LINES, added: false, removed: false });
                        } else {
                            currentHunk.push(change);
                        }
                    }
                    lastChangeWasDiff = false;
                }
            }

            if (currentHunk.length > 0) {
                hunks.push({ changes: currentHunk, startLineOriginal: 0, startLineModified: 0 });
            }

            return { ...file, hunks };
        });
    }, [files]);

    return (
        <ScrollView style={styles.container}>
            {processedFiles.map((file) => (
                <View key={file.path} style={styles.fileContainer}>
                    <Text style={styles.fileName}>{file.path}</Text>
                    <View style={styles.diffContent}>
                        {file.hunks.map((hunk, hunkIndex) => (
                            <View key={hunkIndex} style={styles.hunk}>
                                {hunkIndex > 0 && <View style={styles.hunkDivider}><Text style={styles.hunkDividerText}>...</Text></View>}
                                {hunk.changes.map((part: Change, index: number) => {
                                    const backgroundColor = part.added ? '#e6ffec' : part.removed ? '#ffebe9' : 'transparent';
                                    const color = part.added ? '#1f883d' : part.removed ? '#cf222e' : '#24292f';

                                    return (
                                        <Text
                                            key={index}
                                            style={[
                                                styles.text,
                                                { backgroundColor, color }
                                            ]}
                                        >
                                            {part.value}
                                        </Text>
                                    );
                                })}
                            </View>
                        ))}
                        {file.hunks.length === 0 && <Text style={styles.noChanges}>No changes (or file is empty/binary)</Text>}
                    </View>
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 10,
    },
    fileContainer: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 20,
    },
    fileName: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#555',
        backgroundColor: '#f5f5f5',
        padding: 5,
        borderRadius: 4,
    },
    diffContent: {
        // 
    },
    hunk: {
        marginBottom: 10,
    },
    hunkDivider: {
        backgroundColor: '#f0f0f0',
        paddingVertical: 2,
        alignItems: 'center',
        marginBottom: 5,
    },
    hunkDividerText: {
        color: '#999',
        fontSize: 10,
    },
    text: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : Platform.OS === 'android' ? 'monospace' : 'Consolas, "Courier New", monospace',
        fontSize: 12,
        // @ts-ignore
        whiteSpace: 'pre-wrap',
    },
    noChanges: {
        fontStyle: 'italic',
        color: '#999',
        padding: 10,
    }
});
