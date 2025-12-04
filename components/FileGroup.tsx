import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface FileGroupProps {
    id: string;
    initialName?: string;
    initialPrompt?: string;
    files: string[];
    onUpdate: (id: string, data: { name?: string, prompt?: string }) => void;
    onRemoveFile: (id: string, file: string) => void;
    onCreateBranch: (id: string) => void;
    onDeleteGroup: (id: string) => void;
}

export default function FileGroup({ id, initialName, initialPrompt, files, onUpdate, onRemoveFile, onCreateBranch, onDeleteGroup }: FileGroupProps) {
    const [name, setName] = useState(initialName || 'New Group');
    const [prompt, setPrompt] = useState(initialPrompt || '');

    const handleNameChange = (t: string) => {
        setName(t);
        onUpdate(id, { name: t });
    };

    const handlePromptChange = (t: string) => {
        setPrompt(t);
        onUpdate(id, { prompt: t });
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TextInput
                    style={styles.nameInput}
                    value={name}
                    onChangeText={handleNameChange}
                    placeholder="Group Name"
                />
                <Button title="Delete" color="red" onPress={() => onDeleteGroup(id)} />
            </View>

            <TextInput
                style={[styles.input, styles.textArea]}
                value={prompt}
                onChangeText={handlePromptChange}
                placeholder="Prompt for LLM (e.g. 'Extract UI changes for login')"
                multiline
                numberOfLines={3}
            />

            <Text style={styles.subtitle}>Files ({files.length})</Text>
            <View style={styles.fileList}>
                {files.map(f => (
                    <View key={f} style={styles.fileRow}>
                        <Text style={styles.fileName} numberOfLines={1}>{f}</Text>
                        <TouchableOpacity onPress={() => onRemoveFile(id, f)}>
                            <Text style={styles.remove}>Remove</Text>
                        </TouchableOpacity>
                    </View>
                ))}
                {files.length === 0 && <Text style={styles.empty}>No files added yet.</Text>}
            </View>

            <Button title="Create Branch" onPress={() => onCreateBranch(id)} disabled={files.length === 0} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 8,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    nameInput: {
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 8,
        marginBottom: 10,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    subtitle: {
        fontWeight: '600',
        marginBottom: 5,
    },
    fileList: {
        marginBottom: 15,
    },
    fileRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    fileName: {
        flex: 1,
        marginRight: 10,
        fontSize: 12,
    },
    remove: {
        color: 'red',
        fontSize: 12,
    },
    empty: {
        color: '#999',
        fontStyle: 'italic',
    },
});
