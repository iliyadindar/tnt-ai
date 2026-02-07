import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, Message } from '@/types';

const SESSIONS_KEY = '@tnt_ai_sessions';
const ACTIVE_SESSION_KEY = '@tnt_ai_active_session';

export const StorageService = {
  async getSessions(): Promise<Session[]> {
    try {
      const data = await AsyncStorage.getItem(SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading sessions:', error);
      return [];
    }
  },

  async saveSession(session: Session): Promise<void> {
    try {
      const sessions = await this.getSessions();
      const index = sessions.findIndex(s => s.id === session.id);
      
      if (index >= 0) {
        sessions[index] = session;
      } else {
        sessions.unshift(session);
      }
      
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.getSessions();
      const filtered = sessions.filter(s => s.id !== sessionId);
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  },

  async clearAllSessions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SESSIONS_KEY);
      await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch (error) {
      console.error('Error clearing sessions:', error);
    }
  },

  async getActiveSessionId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    } catch (error) {
      console.error('Error getting active session:', error);
      return null;
    }
  },

  async setActiveSessionId(sessionId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    } catch (error) {
      console.error('Error setting active session:', error);
    }
  },

  createNewSession(): Session {
    const now = Date.now();
    return {
      id: `session_${now}`,
      title: `Chat ${new Date(now).toLocaleDateString()}`,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  },
};
