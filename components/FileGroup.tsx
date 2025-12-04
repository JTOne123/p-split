import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface FileGroupProps {
    id: string;
    initialName?: string;
    initialPrompt?: string;
    initialUseLLM?: boolean;
    files: string[];
    onUpdate: (id: string, data: { name?: string, prompt?: string, useLLM?: boolean }) => void;
    onRemoveFile: (id: string, file: string) => void;
    onCreateBranch: (id: string) => void;
    onDeleteGroup: (id: string) => void;
}

export default function FileGroup({ id, initialName, initialPrompt, initialUseLLM = true, files, onUpdate, onRemoveFile, onCreateBranch, onDeleteGroup }: FileGroupProps) {
    const [name, setName] = useState(initialName || 'New Group');
    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [useLLM, setUseLLM] = useState(initialUseLLM);

    const handleNameChange = (t: string) => {
        setName(t);
        onUpdate(id, { name: t });
    };

    const handlePromptChange = (t: string) => {
        setPrompt(t);
        onUpdate(id, { prompt: t });
    };

    const handleUseLLMChange = (val: boolean) => {
        setUseLLM(val);
        onUpdate(id, { useLLM: val });
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

            <View style={styles.optionsRow}>
                <TouchableOpacity
                    style={styles.checkboxContainer}
                    onPress={() => handleUseLLMChange(!useLLM)}
                >
                    <View style={[styles.checkbox, useLLM && styles.checkboxChecked]}>
                        {useLLM && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>Use LLM</Text>
                </TouchableOpacity>
            </View>

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
    optionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        marginRight: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    checkboxChecked: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    checkmark: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    checkboxLabel: {
        fontSize: 14,
    },
});
