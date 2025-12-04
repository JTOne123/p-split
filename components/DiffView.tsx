import { Change, diffLines } from 'diff';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

export interface DiffFile {
    path: string;
    original: string;
    modified: string;
}

interface DiffViewProps {
    files: DiffFile[];
}

export default function DiffView({ files }: DiffViewProps) {
    return (
        <ScrollView style={styles.container}>
            {files.map((file, fileIndex) => {
                const changes = diffLines(file.original, file.modified);
                return (
                    <View key={file.path} style={styles.fileContainer}>
                        <Text style={styles.fileName}>{file.path}</Text>
                        <View style={styles.diffContent}>
                            {changes.map((part: Change, index: number) => {
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
                    </View>
                );
            })}
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
    text: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : Platform.OS === 'android' ? 'monospace' : 'Consolas, "Courier New", monospace',
        fontSize: 12,
        // @ts-ignore
        whiteSpace: 'pre-wrap',
    }
});
