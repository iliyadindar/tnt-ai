import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { TranscriptionResponse } from '@/types';

const getApiBaseUrl = (): string => {
    return 'https://iliyadindar.site';
};

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // ms
const REQUEST_TIMEOUT = 180000; // 60 seconds

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry wrapper with exponential backoff
async function withRetry<T>(
    fn: () => Promise<T>,
    retries = MAX_RETRIES,
    delay = INITIAL_RETRY_DELAY
): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries === 0) {
            throw error;
        }
        
        console.log(`⏳ Retrying in ${delay}ms... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
        await sleep(delay);
        return withRetry(fn, retries - 1, delay * 2);
    }
}

// Create fetch with timeout
const fetchWithTimeout = (url: string, options: RequestInit, timeout = REQUEST_TIMEOUT): Promise<Response> => {
    return Promise.race([
        fetch(url, options),
        new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error(`Request timeout after ${timeout/1000}s - backend processing may be slow`)), timeout)
        ),
    ]);
};

export const BackendAPI = {
    baseUrl: getApiBaseUrl(),

    async transcribeAndTranslate(
        audioUri: string,
        targetLanguage: string = 'English'
    ): Promise<TranscriptionResponse> {
        const url = `${this.baseUrl}/v1/transcribe_translate`;
        console.log(`📡 Calling API: ${url}`);
        console.log(`� Audio URI: ${audioUri}`);
        console.log(`🌍 Target language: ${targetLanguage}`);
        
        const formData = new FormData();
        
        // React Native FormData requires URI-based file object
        // @ts-ignore - React Native FormData has different typing
        formData.append('file', {
            uri: audioUri,
            type: 'audio/wav',
            name: 'recording.wav',
        });
        formData.append('target_lang', targetLanguage);

        console.log('📤 FormData prepared, sending request...');
        console.log('⏱️ Timeout: 180 seconds (Whisper processing can take time)');

        return withRetry(async () => {
            try {
                const startTime = Date.now();
                const response = await fetchWithTimeout(url, {
                    method: 'POST',
                    body: formData,
                    // Don't set Content-Type manually - let FormData set it with boundary
                });
                
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`⏱️ Request completed in ${elapsed}s`);

                if (!response.ok) {
                    const errorText = await response.text();
                    const errorMsg = `Server error ${response.status}: ${errorText}`;
                    console.error(`❌ ${errorMsg}`);
                    throw new Error(errorMsg);
                }

                const result = await response.json();
                console.log('✅ API Response:', result);
                return result;
            } catch (error: any) {
                // Provide helpful error messages
                if (error.message?.includes('Network request failed')) {
                    const helpfulError = new Error(
                        `Cannot reach backend at ${this.baseUrl}. ` +
                        `Please ensure:\n` +
                        `1. Backend is running (check terminal)\n` +
                        `2. Your phone and computer are on the same WiFi\n` +
                        `3. IP address in api.ts is correct (currently: ${this.baseUrl})`
                    );
                    console.error('❌ Network Error:', helpfulError.message);
                    throw helpfulError;
                } else if (error.message?.includes('timeout')) {
                    console.error('❌ Timeout Error:', error.message);
                    throw new Error('Backend is taking too long to respond. It may be processing a large file.');
                }
                console.error('❌ API Error:', error);
                throw error;
            }
        });
    },

    async healthCheck(): Promise<boolean> {
        try {
            console.log(`🏥 Health check: ${this.baseUrl}/docs`);
            
            const response = await fetchWithTimeout(`${this.baseUrl}/docs`, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html',
                },
            }, 5000); // 5 second timeout for health check
            
            const isOnline = response.ok;
            console.log(`🏥 Backend status: ${isOnline ? 'Online ✅' : 'Offline ❌'}`);
            
            if (isOnline) {
                console.log(`📍 Connected to: ${this.baseUrl}`);
            }
            
            return isOnline;
        } catch (error: any) {
            if (error.message?.includes('Network request failed')) {
                console.error(`❌ Cannot reach backend at ${this.baseUrl}`);
                console.error('   💡 Check: Backend running? Same WiFi? Correct IP?');
            } else if (error.message?.includes('timeout')) {
                console.error('❌ Backend health check timed out');
            } else {
                console.error('❌ Backend health check failed:', error.message);
            }
            return false;
        }
    },
};
