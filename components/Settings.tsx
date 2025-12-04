import type { LLMProvider } from '@/utils/llm-service';
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

interface SettingsProps {
    onSave: (provider: LLMProvider, apiKey: string, endpoint?: string) => void;
    onCancel: () => void;
}

export default function Settings({ onSave, onCancel }: SettingsProps) {
    const [provider, setProvider] = useState<LLMProvider>('openai');
    const [apiKey, setApiKey] = useState('');
    const [customEndpoint, setCustomEndpoint] = useState('');

    const handleSave = () => {
        onSave(provider, apiKey, customEndpoint || undefined);
    };

    const getDefaultEndpoint = () => {
        if (provider === 'gemini') {
            return 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
        }
        return 'https://api.openai.com/v1/chat/completions';
    };

    return (
        <View style={styles.container}>
            <View style={styles.modal}>
                <Text style={styles.title}>LLM Configuration</Text>

                <Text style={styles.label}>Provider</Text>
                <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as LLMProvider)}
                    style={styles.select}
                >
                    <option value="openai">OpenAI (GPT-4)</option>
                    <option value="gemini">Google Gemini</option>
                </select>

                <Text style={styles.label}>API Key</Text>
                <TextInput
                    style={styles.input}
                    value={apiKey}
                    onChangeText={setApiKey}
                    placeholder={provider === 'gemini' ? 'Your Gemini API key' : 'sk-...'}
                    secureTextEntry
                />

                <Text style={styles.label}>Custom Endpoint (Optional)</Text>
                <TextInput
                    style={styles.input}
                    value={customEndpoint}
                    onChangeText={setCustomEndpoint}
                    placeholder={getDefaultEndpoint()}
                />
                <Text style={styles.hint}>Leave empty to use default endpoint</Text>

                <View style={styles.buttons}>
                    <Button title="Cancel" onPress={onCancel} color="#666" />
                    <Button title="Save" onPress={handleSave} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modal: {
        backgroundColor: 'white',
        padding: 30,
        borderRadius: 12,
        width: 500,
        maxWidth: '90%',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 15,
        marginBottom: 5,
    },
    select: {
        width: '100%',
        padding: 10,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        fontSize: 14,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        padding: 10,
        fontSize: 14,
    },
    hint: {
        fontSize: 12,
        color: '#666',
        marginTop: 5,
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 25,
    },
});
