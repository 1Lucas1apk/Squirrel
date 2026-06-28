import React from 'react';
import { View, Text, Pressable, Linking, ScrollView, Modal } from 'react-native';
import { X, Code, Globe, Heart, Coffee, ExternalLink } from 'lucide-react-native';

interface CreditsScreenProps {
  onClose: () => void;
}

const LinkButton = ({ icon: Icon, title, subtitle, url, color }: { icon: any, title: string, subtitle: string, url: string, color: string }) => {
  return (
    <Pressable 
      onPress={() => Linking.openURL(url)}
      className="flex-row items-center p-5 mb-3 rounded-3xl border border-zinc-800 bg-ink-800 active:bg-ink-700"
    >
      <View className="h-12 w-12 rounded-[20px] items-center justify-center mr-4 border border-zinc-700/50" style={{ backgroundColor: color + '15' }}>
        <Icon size={20} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-zinc-100 font-bold text-sm mb-1">{title}</Text>
        <Text className="text-zinc-500 font-medium text-[10px] uppercase tracking-widest">{subtitle}</Text>
      </View>
      <ExternalLink size={16} color="#52525b" />
    </Pressable>
  );
};

export function CreditsScreen({ onClose }: CreditsScreenProps) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/80">
        <Pressable className="flex-1" onPress={onClose} />
        
        <View className="w-full bg-ink-950 rounded-t-[40px] shadow-2xl border-t border-zinc-800 max-h-[90%]">
          {/* Header */}
          <View className="px-6 pt-6 pb-4 border-b border-zinc-900 flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-black text-zinc-500 uppercase tracking-[4px]">Sobre o App</Text>
            </View>
            <Pressable onPress={onClose} className="h-10 w-10 bg-zinc-900 rounded-full items-center justify-center border border-zinc-800">
              <X size={18} color="#a1a1aa" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
            {/* Logo */}
            <View className="items-center mb-10 mt-4">
              <View className="h-24 w-24 bg-amber-500/10 rounded-[32px] items-center justify-center mb-6 border border-amber-500/20 shadow-lg">
                <Text className="text-5xl">🐿️</Text>
              </View>
              <Text className="text-4xl font-black text-white tracking-tighter mb-2">Squirrel</Text>
              <View className="bg-zinc-800 px-3 py-1 rounded-full">
                <Text className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Build 2026.final</Text>
              </View>
            </View>

            {/* Dev Info */}
            <View className="bg-ink-900 p-6 rounded-[32px] border border-zinc-800 mb-8">
              <View className="flex-row items-center justify-center gap-2 mb-4">
                <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-[3px]">Criado com</Text>
                <Heart size={14} color="#ef4444" fill="#ef4444" />
                <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-[3px]">por</Text>
              </View>
              
              <Text className="text-2xl font-black text-white text-center tracking-tighter mb-1">Lucas Morais</Text>
              <Text className="text-amber-500 text-xs font-bold text-center tracking-widest uppercase mb-6">@1Lucas1apk</Text>
              
              <View className="bg-zinc-900/80 p-5 rounded-3xl border border-zinc-800/50 flex-row items-start gap-4">
                <Coffee size={18} color="#fb923c" className="mt-1" />
                <Text className="text-zinc-400 text-xs font-bold flex-1 leading-5">
                  "Desenvolvido para simplificar a vida do caixa, dar paz de espírito ao dono e provar que tecnologia boa é aquela que a gente nem sente."
                </Text>
              </View>
            </View>

            {/* Links */}
            <View className="mb-10">
              <Text className="text-[10px] font-black text-zinc-600 uppercase tracking-[3px] mb-4 ml-2">Links e Contatos</Text>
              
              <LinkButton 
                icon={Code} 
                title="Meu GitHub" 
                subtitle="Projetos e Código Fonte" 
                url="https://github.com/1Lucas1apk" 
                color="#f4f4f5" 
              />
              <LinkButton 
                icon={Globe} 
                title="Meu Portfólio" 
                subtitle="Conheça meu trabalho" 
                url="https://1lucas1apk.fun/" 
                color="#3b82f6" 
              />
            </View>

            <View className="items-center opacity-50 mt-4">
              <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-[4px]">Ecliptia © 2026</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
