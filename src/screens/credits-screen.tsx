import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Platform, ScrollView, Animated } from 'react-native';
import { X, Globe, Code, Zap, Flame, Terminal, Star } from 'lucide-react-native';

interface CreditsScreenProps {
  onClose: () => void;
}

const LinkRow = ({ icon: Icon, label, url, color }: { icon: any, label: string, url: string, color: string }) => {
  const IconComponent = Icon || Globe;
  
  return (
    <Pressable 
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [
        styles.linkRow,
        { borderColor: color + '30', backgroundColor: pressed ? color + '10' : '#0f0f0f' }
      ]}
    >
      <IconComponent size={20} color={color} />
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.linkArrow}>→</Text>
    </Pressable>
  );
};

export function CreditsScreen({ onClose }: CreditsScreenProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.modal, { opacity, transform: [{ scale }] }]}>
        
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={20}>
          <X color="#52525b" size={24} />
        </Pressable>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={styles.emojiMain}>🐿️</Text>
            <Text style={styles.appName}>Squirrel</Text>
            <Text style={styles.version}>build_2026.final</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.devCard}>
              <View style={styles.devHeader}>
                <Flame size={16} color="#f59e0b" fill="#f59e0b" />
                <Text style={styles.devTitle}>DESENVOLVEDOR</Text>
              </View>
              <Text style={styles.devName}>Lucas Morais Rodrigues</Text>
              <Text style={styles.devHandle}>@1Lucas1apk</Text>
            </View>

            <View style={styles.quoteBox}>
              <Terminal size={14} color="#34d399" />
              <Text style={styles.quoteText}>
                "Transformando café e insônia em código que funciona."
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ONDE ME ACHAR</Text>
              <LinkRow 
                icon={Globe} 
                label="GitHub" 
                url="https://github.com/1Lucas1apk" 
                color="#ffffff" 
              />
              <LinkRow 
                icon={Globe} 
                label="Meu Site" 
                url="https://1lucas1apk.fun/" 
                color="#fb923c" 
              />
            </View>

            <View style={styles.techRow}>
              <View style={styles.techBadge}><Code size={12} color="#60a5fa" /><Text style={styles.techText}>React Native</Text></View>
              <View style={styles.techBadge}><Zap size={12} color="#facc15" /><Text style={styles.techText}>Fast AF</Text></View>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.brandRow}>
              <Star size={14} color="#a78bfa" fill="#a78bfa" />
              <Text style={styles.brandText}>Ecliptia</Text>
            </View>
            <Text style={styles.legal}>Sem mimimi, apenas código de verdade.</Text>
          </View>
        </ScrollView>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    flex: 1,
    maxHeight: Platform.OS === 'web' ? '90%' : '80%',
    backgroundColor: '#050505',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    overflow: 'hidden',
  },
  scroll: {
    padding: 32,
    paddingTop: 60,
  },
  closeBtn: {
    position: 'absolute',
    top: 24,
    right: 24,
    zIndex: 10,
    padding: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  emojiMain: {
    fontSize: 48,
    marginBottom: 12,
  },
  appName: {
    fontSize: 38,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
  },
  version: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#3f3f46',
    marginTop: 4,
  },
  content: {
    width: '100%',
  },
  devCard: {
    backgroundColor: '#0a0a0a',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    marginBottom: 16,
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  devTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1,
  },
  devName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#f4f4f5',
  },
  devHandle: {
    fontSize: 14,
    color: '#fb923c',
    fontWeight: '600',
    marginTop: 2,
  },
  quoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    marginBottom: 40,
  },
  quoteText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#71717a',
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#3f3f46',
    marginBottom: 12,
    marginLeft: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  linkLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#f4f4f5',
    marginLeft: 12,
  },
  linkArrow: {
    color: '#3f3f46',
    fontSize: 18,
  },
  techRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  techBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f0f0f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  techText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a1a1aa',
  },
  footer: {
    marginTop: 60,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
    paddingTop: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  brandText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  legal: {
    fontSize: 9,
    color: '#27272a',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
