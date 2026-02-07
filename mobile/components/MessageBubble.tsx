import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Message } from '@/types';
import { FontAwesome } from '@expo/vector-icons';

const SkeletonLine: React.FC<{ width: string; isDarkMode: boolean; delay?: number }> = ({
  width,
  isDarkMode,
  delay = 0,
}) => {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: false }),
        ])
      ).start();
    }, delay);
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
        },
      ]}
    />
  );
};

interface MessageBubbleProps {
  message: Message;
  isDarkMode?: boolean;
  onPlayAudio?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isDarkMode = false,
  onPlayAudio,
}) => {
  const isUser = message.type === 'user';
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(12)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const c = isDarkMode
    ? {
        userBorder: 'rgba(108,108,255,0.35)',
        otherBorder: 'rgba(255,255,255,0.12)',
        userBg: 'rgba(108,108,255,0.12)',
        otherBg: 'rgba(255,255,255,0.06)',
        userText: '#FFFFFF',
        otherText: '#FFFFFF',
        meta: 'rgba(255,255,255,0.45)',
        userMeta: 'rgba(255,255,255,0.6)',
        divider: 'rgba(255,255,255,0.1)',
        errorBg: 'rgba(255,69,58,0.15)',
        errorText: '#FF453A',
        labelBg: 'rgba(255,255,255,0.06)',
      }
    : {
        userBorder: 'rgba(91,91,214,0.3)',
        otherBorder: 'rgba(0,0,0,0.08)',
        userBg: 'rgba(91,91,214,0.08)',
        otherBg: 'rgba(255,255,255,0.6)',
        userText: '#1A1A2E',
        otherText: '#000000',
        meta: 'rgba(0,0,0,0.35)',
        userMeta: 'rgba(91,91,214,0.6)',
        divider: 'rgba(0,0,0,0.06)',
        errorBg: 'rgba(255,59,48,0.1)',
        errorText: '#FF3B30',
        labelBg: 'rgba(0,0,0,0.04)',
      };

  const borderColor = isUser ? c.userBorder : c.otherBorder;
  const textColor = isUser ? c.userText : c.otherText;
  const metaColor = isUser ? c.userMeta : c.meta;

  return (
    <Animated.View
      style={[
        styles.row,
        isUser ? styles.rowRight : styles.rowLeft,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleOther,
          { borderColor, borderWidth: 1 },
        ]}
      >
        <BlurView
          intensity={isDarkMode ? 30 : 50}
          tint={isDarkMode ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isUser ? c.userBg : c.otherBg },
          ]}
        />

        {message.audioUri && (
          <TouchableOpacity
            style={[styles.audioBtn, { borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}
            onPress={onPlayAudio}
            activeOpacity={0.6}
          >
            <FontAwesome name="volume-up" size={12} color={metaColor} />
          </TouchableOpacity>
        )}

        {message.transcript && (
          <View style={[styles.section, styles.innerIsland, { backgroundColor: c.labelBg, borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
            <Text style={[styles.label, { color: metaColor }]}>
              {isUser ? 'You said' : 'Transcript'}
            </Text>
            <Text style={[styles.msgText, { color: textColor }]}>{message.transcript}</Text>
          </View>
        )}

        {message.isLoading && !message.transcript && (
          <View style={[styles.section, styles.innerIsland, { backgroundColor: c.labelBg, borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
            <Text style={[styles.label, { color: metaColor }]}>Processing...</Text>
            <SkeletonLine width="88%" isDarkMode={isDarkMode} />
            <SkeletonLine width="72%" isDarkMode={isDarkMode} delay={80} />
            <SkeletonLine width="80%" isDarkMode={isDarkMode} delay={160} />
          </View>
        )}

        {message.translation && (
          <View style={[styles.section, styles.innerIsland, { backgroundColor: c.labelBg, borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', marginTop: 6 }]}>
            <Text style={[styles.label, { color: metaColor }]}>
              {message.targetLanguage}
            </Text>
            <Text style={[styles.msgText, { color: textColor, fontStyle: 'italic' }]}>
              {message.translation}
            </Text>
          </View>
        )}

        {message.detectedLanguage && (
          <View style={[styles.detectedPill, { backgroundColor: c.labelBg, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
            <Text style={[styles.detectedLang, { color: metaColor }]}>
              Detected: {message.detectedLanguage}
            </Text>
          </View>
        )}

        {message.error && (
          <View style={[styles.errorBox, { backgroundColor: c.errorBg, borderColor: isDarkMode ? 'rgba(255,69,58,0.3)' : 'rgba(255,59,48,0.2)' }]}>
            <Text style={[styles.errorText, { color: c.errorText }]}>{message.error}</Text>
          </View>
        )}

        <Text style={[styles.time, { color: metaColor }]}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowLeft: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  bubbleUser: {
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    borderBottomLeftRadius: 6,
  },

  audioBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 5,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 1,
  },

  section: {
    marginBottom: 4,
  },
  innerIsland: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 21,
  },

  detectedPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  detectedLang: {
    fontSize: 10,
    fontWeight: '500',
  },

  errorBox: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
  },

  time: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'right',
  },

  skeleton: {
    height: 11,
    borderRadius: 5,
    marginVertical: 3,
  },
});
