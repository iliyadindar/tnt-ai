import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  SafeAreaView,
  FlatList,
  View,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  useColorScheme,
  StatusBar as RNStatusBar,
} from 'react-native';
import { Audio } from 'expo-av';
import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';

import { recordSpeech } from '@/functions/recordSpeech';
import useWebFocus from '@/hooks/useWebFocus';
import { Message, Session } from '@/types';
import { StorageService } from '@/services/storage';
import { BackendAPI } from '@/services/api';
import { MessageBubble } from '@/components/MessageBubble';
import { HistorySidebar } from '@/components/HistorySidebar';

/* ─── Reusable Glass Island ─── */
const GlassIsland: React.FC<{
  children: React.ReactNode;
  isDark: boolean;
  style?: any;
  borderRadius?: number;
  intensity?: number;
}> = ({ children, isDark, style, borderRadius = 16, intensity = 40 }) => (
  <View
    style={[
      {
        borderRadius,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
      },
      style,
    ]}
  >
    <BlurView
      intensity={intensity}
      tint={isDark ? 'dark' : 'light'}
      style={StyleSheet.absoluteFill}
    />
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(255,255,255,0.55)',
        },
      ]}
    />
    {children}
  </View>
);

export default function HomeScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [backendOnline, setBackendOnline] = useState(false);
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const audioRecordingRef = useRef(new Audio.Recording());
  const webAudioPermissionsRef = useRef<MediaStream | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const isWebFocused = useWebFocus();

  useEffect(() => {
    loadSessions();
    checkBackendHealth();
  }, []);

  useEffect(() => {
    if (isWebFocused) {
      const getMicAccess = async () => {
        try {
          const permissions = await navigator.mediaDevices.getUserMedia({ audio: true });
          webAudioPermissionsRef.current = permissions;
        } catch (error) {
          console.error('Microphone permission denied:', error);
        }
      };
      if (!webAudioPermissionsRef.current) getMicAccess();
    } else {
      if (webAudioPermissionsRef.current) {
        webAudioPermissionsRef.current.getTracks().forEach((track) => track.stop());
        webAudioPermissionsRef.current = null;
      }
    }
  }, [isWebFocused]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  useEffect(() => {
    if (activeSession && activeSession.messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [activeSession?.messages.length]);

  const checkBackendHealth = async () => {
    const isOnline = await BackendAPI.healthCheck();
    setBackendOnline(isOnline);
  };

  const loadSessions = async () => {
    const loadedSessions = await StorageService.getSessions();
    setSessions(loadedSessions);
    const activeId = await StorageService.getActiveSessionId();
    if (activeId) {
      const session = loadedSessions.find(s => s.id === activeId);
      setActiveSession(session || null);
    }
    if (!activeId || !loadedSessions.find(s => s.id === activeId)) {
      createNewSession();
    }
  };

  const createNewSession = () => {
    const newSession = StorageService.createNewSession();
    setActiveSession(newSession);
    StorageService.setActiveSessionId(newSession.id);
    StorageService.saveSession(newSession);
    setSessions(prev => [newSession, ...prev]);
  };

  const saveCurrentSession = async (updatedSession: Session) => {
    await StorageService.saveSession(updatedSession);
    setSessions(prev => prev.map(s => (s.id === updatedSession.id ? updatedSession : s)));
  };

  const handleStartRecording = async () => {
    if (!backendOnline) {
      Alert.alert('Backend Offline', 'The transcription server is not available.');
      return;
    }
    if (isProcessing) {
      Alert.alert('Please Wait', 'Previous recording is still processing.');
      return;
    }
    try {
      setRecordingError(null);
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone Permission Required', 'Please grant microphone permission.');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.spring(buttonScaleAnim, { toValue: 0.92, tension: 100, friction: 5, useNativeDriver: true }).start();

      try {
        const status = await audioRecordingRef.current.getStatusAsync();
        if (status.isRecording) await audioRecordingRef.current.stopAndUnloadAsync();
      } catch (e) {}

      audioRecordingRef.current = new Audio.Recording();
      await recordSpeech(audioRecordingRef, setIsRecording, !!webAudioPermissionsRef.current);
    } catch (error: any) {
      setIsRecording(false);
      setRecordingError(error.message);
      Animated.spring(buttonScaleAnim, { toValue: 1, tension: 100, friction: 5, useNativeDriver: true }).start();
      Alert.alert('Recording Error', 'Failed to start recording.\n\n' + error.message);
    }
  };

  const handleStopRecording = async () => {
    if (!activeSession) return;
    setIsRecording(false);
    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(buttonScaleAnim, { toValue: 1, tension: 100, friction: 5, useNativeDriver: true }).start();

    try {
      const recordingStatus = await audioRecordingRef?.current?.getStatusAsync();
      if (!recordingStatus) throw new Error('No recording instance found');
      if (!recordingStatus.isRecording) throw new Error('No active recording found');

      await audioRecordingRef?.current?.stopAndUnloadAsync();
      const recordingUri = audioRecordingRef?.current?.getURI() || '';
      if (!recordingUri) throw new Error('Recording failed to save');

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: false });

      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        type: 'user',
        audioUri: recordingUri,
        targetLanguage,
        timestamp: Date.now(),
        isLoading: true,
      };

      const updatedSession = {
        ...activeSession,
        messages: [...activeSession.messages, userMessage],
        updatedAt: Date.now(),
      };
      setActiveSession(updatedSession);

      const response = await BackendAPI.transcribeAndTranslate(recordingUri, targetLanguage);

      const completedUserMessage: Message = {
        ...userMessage,
        transcript: response.transcript,
        translation: response.translation,
        detectedLanguage: response.source_lang || response.lang || 'unknown',
        isLoading: false,
      };

      const finalSession = {
        ...updatedSession,
        messages: updatedSession.messages.map(m => (m.id === userMessage.id ? completedUserMessage : m)),
        title: response.transcript.substring(0, 30) + '...',
        updatedAt: Date.now(),
      };
      setActiveSession(finalSession);
      await saveCurrentSession(finalSession);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      const errorMessage: Message = {
        id: `msg_${Date.now()}`,
        type: 'user',
        targetLanguage,
        timestamp: Date.now(),
        error: error.message || 'Failed to process audio',
      };
      const errorSession = {
        ...activeSession,
        messages: [...activeSession.messages.filter(m => !m.isLoading), errorMessage],
        updatedAt: Date.now(),
      };
      setActiveSession(errorSession);
      await saveCurrentSession(errorSession);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Processing Error', error.message || 'Failed to process audio');
    } finally {
      setIsProcessing(false);
      audioRecordingRef.current = new Audio.Recording();
    }
  };

  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSession(session);
      StorageService.setActiveSessionId(sessionId);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    Alert.alert('Delete Chat', 'Are you sure you want to delete this chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await StorageService.deleteSession(sessionId);
          setSessions(prev => prev.filter(s => s.id !== sessionId));
          if (activeSession?.id === sessionId) createNewSession();
        },
      },
    ]);
  };

  const languages = ['English', 'Turkish', 'Persian', 'Arabic'];

  // Glass island theme
  const t = isDarkMode
    ? {
        bg: '#0A0A0C',
        chatBg: '#0A0A0C',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        primary: '#6C6CFF',
        success: '#34C759',
        error: '#FF453A',
        islandBg: 'rgba(255,255,255,0.06)',
        islandBorder: 'rgba(255,255,255,0.12)',
        blurTint: 'dark' as const,
      }
    : {
        bg: '#EFEAE5',
        chatBg: '#EFEAE5',
        text: '#000000',
        textSecondary: '#6B6B70',
        primary: '#5B5BD6',
        success: '#34C759',
        error: '#FF3B30',
        islandBg: 'rgba(255,255,255,0.55)',
        islandBorder: 'rgba(0,0,0,0.08)',
        blurTint: 'light' as const,
      };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* ─── Header: each element is its own glass island ─── */}
      <View style={styles.header}>
        {/* Menu island */}
        <GlassIsland isDark={isDarkMode} borderRadius={14} style={styles.iconIsland}>
          <TouchableOpacity style={styles.islandBtn} onPress={() => setShowHistory(true)}>
            <FontAwesome name="bars" size={18} color={t.primary} />
          </TouchableOpacity>
        </GlassIsland>

        {/* Title + status island */}
        <GlassIsland isDark={isDarkMode} borderRadius={18} style={styles.titleIsland}>
          <View style={styles.titleIslandInner}>
            <Text style={[styles.headerTitle, { color: t.text }]}>TNT AI</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: backendOnline ? t.success : t.error }]} />
              <Text style={[styles.statusLabel, { color: t.textSecondary }]}>
                {backendOnline ? 'online' : 'offline'}
              </Text>
            </View>
          </View>
        </GlassIsland>

        {/* Right actions: theme + new chat islands */}
        <View style={styles.headerActions}>
          <GlassIsland isDark={isDarkMode} borderRadius={14} style={styles.iconIsland}>
            <TouchableOpacity style={styles.islandBtn} onPress={() => setIsDarkMode(!isDarkMode)}>
              <FontAwesome name={isDarkMode ? 'sun-o' : 'moon-o'} size={16} color={t.textSecondary} />
            </TouchableOpacity>
          </GlassIsland>
          <GlassIsland isDark={isDarkMode} borderRadius={14} style={styles.iconIsland}>
            <TouchableOpacity style={styles.islandBtn} onPress={createNewSession}>
              <FontAwesome name="pencil-square-o" size={18} color={t.primary} />
            </TouchableOpacity>
          </GlassIsland>
        </View>
      </View>

      {/* ─── Language bar: each chip is a glass island ─── */}
      <View style={styles.langBar}>
        {languages.map(lang => {
          const active = targetLanguage === lang;
          return (
            <GlassIsland
              key={lang}
              isDark={isDarkMode}
              borderRadius={14}
              intensity={active ? 60 : 30}
              style={[
                styles.langIsland,
                active && {
                  borderColor: isDarkMode ? 'rgba(108,108,255,0.5)' : 'rgba(91,91,214,0.4)',
                  backgroundColor: isDarkMode ? 'rgba(108,108,255,0.15)' : 'rgba(91,91,214,0.12)',
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setTargetLanguage(lang);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={styles.langChipInner}
              >
                <Text
                  style={[
                    styles.langChipText,
                    { color: active ? t.primary : t.text },
                    active && { fontWeight: '700' },
                  ]}
                >
                  {lang}
                </Text>
              </TouchableOpacity>
            </GlassIsland>
          );
        })}
      </View>

      {/* ─── Chat area ─── */}
      <KeyboardAvoidingView
        style={[styles.chatArea, { backgroundColor: t.chatBg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {activeSession && activeSession.messages.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={activeSession.messages}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isDarkMode={isDarkMode}
                onPlayAudio={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              />
            )}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.msgList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyWrap}>
            <GlassIsland isDark={isDarkMode} borderRadius={28} style={styles.emptyIconIsland}>
              <View style={styles.emptyIconInner}>
                <FontAwesome name="microphone" size={32} color={t.primary} />
              </View>
            </GlassIsland>
            <GlassIsland isDark={isDarkMode} borderRadius={16} style={styles.emptyTextIsland}>
              <View style={styles.emptyTextInner}>
                <Text style={[styles.emptyTitle, { color: t.text }]}>Start Speaking</Text>
                <Text style={[styles.emptyDesc, { color: t.textSecondary }]}>
                  Hold the mic button to record.{'\n'}Your speech will be transcribed & translated.
                </Text>
              </View>
            </GlassIsland>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ─── Bottom bar: glass island controls ─── */}
      <View style={styles.bottomBar}>
        {isProcessing && (
          <GlassIsland isDark={isDarkMode} borderRadius={12} style={styles.processingIsland}>
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={t.primary} />
              <Text style={[styles.processingText, { color: t.primary }]}>Processing...</Text>
            </View>
          </GlassIsland>
        )}

        {/* Mic button island */}
        <GlassIsland isDark={isDarkMode} borderRadius={36} intensity={50} style={styles.micIsland}>
          <Animated.View style={{ transform: [{ scale: Animated.multiply(pulseAnim, buttonScaleAnim) }] }}>
            <TouchableOpacity
              onPressIn={handleStartRecording}
              onPressOut={handleStopRecording}
              disabled={isProcessing || !backendOnline}
              activeOpacity={0.75}
              style={[
                styles.micButton,
                { backgroundColor: isRecording ? t.error : t.primary },
                (isProcessing || !backendOnline) && { opacity: 0.4 },
              ]}
            >
              {isRecording ? (
                <View style={styles.stopSquare} />
              ) : (
                <FontAwesome name="microphone" size={26} color="#fff" />
              )}
            </TouchableOpacity>
          </Animated.View>
        </GlassIsland>

        {/* Hint island */}
        <GlassIsland isDark={isDarkMode} borderRadius={10} style={styles.hintIsland}>
          <Text style={[styles.micHint, { color: t.textSecondary }]}>
            {isRecording ? 'Recording... release to stop' : backendOnline ? 'Hold to record' : 'Backend offline'}
          </Text>
        </GlassIsland>
      </View>

      <HistorySidebar
        visible={showHistory}
        sessions={sessions}
        activeSessionId={activeSession?.id || null}
        isDarkMode={isDarkMode}
        onClose={() => setShowHistory(false)}
        onSelectSession={handleSelectSession}
        onNewSession={createNewSession}
        onDeleteSession={handleDeleteSession}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingTop: (RNStatusBar.currentHeight || 0) + 8,
    gap: 8,
  },
  iconIsland: {
    // individual icon glass pill
  },
  islandBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleIsland: {
    flex: 1,
  },
  titleIslandInner: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  /* ── Language bar ── */
  langBar: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  langIsland: {
    flex: 1,
  },
  langChipInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  langChipText: {
    fontSize: 13,
    fontWeight: '500',
  },

  /* ── Chat ── */
  chatArea: {
    flex: 1,
  },
  msgList: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },

  /* ── Empty state ── */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIconIsland: {
    // glass circle island for mic icon
  },
  emptyIconInner: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTextIsland: {
    // glass island for text
  },
  emptyTextInner: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  /* ── Bottom bar ── */
  bottomBar: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    gap: 8,
  },
  processingIsland: {
    // glass pill for "Processing..."
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  processingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  micIsland: {
    // large glass circle behind mic button
  },
  micButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 6,
  },
  stopSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  hintIsland: {
    // glass pill for hint text
  },
  micHint: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
});
