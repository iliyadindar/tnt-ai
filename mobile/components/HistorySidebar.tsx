import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  SafeAreaView,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Session } from '@/types';
import { FontAwesome } from '@expo/vector-icons';

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

interface HistorySidebarProps {
  visible: boolean;
  sessions: Session[];
  activeSessionId: string | null;
  isDarkMode?: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  visible,
  sessions,
  activeSessionId,
  isDarkMode = false,
  onClose,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}) => {
  const t = isDarkMode
    ? {
        bg: '#0A0A0C',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        primary: '#6C6CFF',
        error: '#FF453A',
        activeBorder: 'rgba(108,108,255,0.5)',
      }
    : {
        bg: '#EFEAE5',
        text: '#000000',
        textSecondary: '#6B6B70',
        primary: '#5B5BD6',
        error: '#FF3B30',
        activeBorder: 'rgba(91,91,214,0.4)',
      };

  const renderSession = ({ item }: { item: Session }) => {
    const isActive = item.id === activeSessionId;
    const count = item.messages.length;

    return (
      <GlassIsland
        isDark={isDarkMode}
        borderRadius={14}
        intensity={isActive ? 50 : 30}
        style={[
          styles.card,
          isActive && { borderColor: t.activeBorder },
        ]}
      >
        <TouchableOpacity
          style={styles.cardTouchable}
          activeOpacity={0.6}
          onPress={() => {
            onSelectSession(item.id);
            onClose();
          }}
        >
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: isActive ? t.primary : t.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.cardMeta, { color: t.textSecondary }]}>
              {count} message{count !== 1 ? 's' : ''} · {new Date(item.updatedAt).toLocaleDateString()}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: isDarkMode ? 'rgba(255,69,58,0.2)' : 'rgba(255,59,48,0.15)', borderWidth: 1, borderRadius: 10, backgroundColor: isDarkMode ? 'rgba(255,69,58,0.08)' : 'rgba(255,59,48,0.06)' }]}
            onPress={() => onDeleteSession(item.id)}
          >
            <FontAwesome name="trash-o" size={14} color={t.error} />
          </TouchableOpacity>
        </TouchableOpacity>
      </GlassIsland>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
        <View style={styles.header}>
          <GlassIsland isDark={isDarkMode} borderRadius={14} style={styles.headerTitleIsland}>
            <Text style={[styles.headerTitle, { color: t.text }]}>Chats</Text>
          </GlassIsland>

          <GlassIsland isDark={isDarkMode} borderRadius={12} style={styles.closeIsland}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome name="times" size={18} color={t.textSecondary} />
            </TouchableOpacity>
          </GlassIsland>
        </View>

        <GlassIsland
          isDark={isDarkMode}
          borderRadius={14}
          style={[styles.newBtn, { borderColor: isDarkMode ? 'rgba(108,108,255,0.35)' : 'rgba(91,91,214,0.3)' }]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.newBtnInner}
            onPress={() => {
              onNewSession();
              onClose();
            }}
          >
            <View style={[styles.newBtnIcon, { backgroundColor: t.primary }]}>
              <FontAwesome name="plus" size={14} color="#fff" />
            </View>
            <Text style={[styles.newBtnText, { color: t.primary }]}>New Chat</Text>
          </TouchableOpacity>
        </GlassIsland>

        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <GlassIsland isDark={isDarkMode} borderRadius={20} style={styles.emptyIsland}>
                <View style={styles.emptyInner}>
                  <FontAwesome name="comments-o" size={40} color={t.textSecondary} style={{ opacity: 0.5 }} />
                  <Text style={[styles.emptyText, { color: t.textSecondary }]}>No chats yet</Text>
                </View>
              </GlassIsland>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) + 10 : 10,
    gap: 10,
  },
  headerTitleIsland: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeIsland: {},
  closeBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtn: {
    marginHorizontal: 14,
    marginBottom: 10,
  },
  newBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  newBtnIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 6,
  },
  card: {
  },
  cardTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: 12,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 40,
  },
  emptyIsland: {
    width: '100%',
  },
  emptyInner: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
