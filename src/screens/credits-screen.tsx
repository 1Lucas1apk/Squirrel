import React from 'react';
import { View, Text, Pressable, Linking, ScrollView, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { 
  X, 
  Code, 
  Globe, 
  Heart, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles,
  SunMedium
} from 'lucide-react-native';
import { PixelSquirrelFooter } from '../components/dashboard/pixel-squirrel-footer';

interface CreditsScreenProps {
  onClose: () => void;
}

const LinkButton = ({ 
  icon: Icon, 
  title, 
  subtitle, 
  url, 
  color 
}: { 
  icon: any; 
  title: string; 
  subtitle: string; 
  url: string; 
  color: string;
}) => {
  return (
    <Pressable 
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        void Linking.openURL(url);
      }}
      className="flex-row items-center p-4 mb-2.5 rounded-2xl border border-zinc-800 bg-[#121216] active:bg-zinc-900 shadow-sm"
    >
      <View 
        className="h-11 w-11 rounded-xl items-center justify-center mr-3.5 border flex-shrink-0" 
        style={{ backgroundColor: color + '15', borderColor: color + '30' }}
      >
        <Icon size={18} color={color} strokeWidth={2.2} />
      </View>
      <View className="flex-1 min-w-0 mr-2">
        <View className="flex-row items-center gap-1.5 mb-0.5">
          <Text className="text-zinc-100 font-black text-xs">{title}</Text>
          <View style={{ backgroundColor: color }} className="h-1.5 w-1.5 rounded-full" />
        </View>
        <Text className="text-zinc-400 font-bold text-[10px] uppercase tracking-wider" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View className="h-7 w-7 rounded-lg bg-zinc-900 border border-zinc-800 items-center justify-center">
        <ExternalLink size={12} color="#a1a1aa" />
      </View>
    </Pressable>
  );
};

export function CreditsScreen({ onClose }: CreditsScreenProps) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/80">
        <Pressable className="flex-1" onPress={onClose} />
        
        <View className="w-full bg-[#0d0d12] rounded-t-[36px] shadow-2xl border-t border-zinc-800 max-h-[92%]">
          {/* Top Bar Indicator */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 rounded-full bg-zinc-800" />
          </View>

          {/* Header */}
          <View className="px-6 pt-2 pb-3.5 border-b border-zinc-900 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <ShieldCheck size={16} color="#fbbf24" />
              <Text className="text-xs font-black text-zinc-400 uppercase tracking-[3px]">Sobre o Squirrel</Text>
            </View>
            <Pressable 
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }} 
              hitSlop={10}
              className="h-8 w-8 bg-zinc-900 rounded-full items-center justify-center border border-zinc-800 active:bg-zinc-800"
            >
              <X size={15} color="#a1a1aa" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/* Cabeçalho do App */}
            <View className="items-center mb-5 mt-1">
              <Text className="text-2xl font-black text-white tracking-tight mb-1">Squirrel Caixa</Text>
              <View className="bg-zinc-900 border border-zinc-800 px-3 py-0.5 rounded-full">
                <Text className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  Build 2026.final
                </Text>
              </View>
            </View>

            {/* Dev Info Card */}
            <View className="bg-[#121216] p-4 rounded-[24px] border border-zinc-800 mb-3.5 shadow-md">
              <View className="flex-row items-center justify-center gap-1.5 mb-2">
                <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-[2px]">Desenvolvido com</Text>
                <Heart size={12} color="#ef4444" fill="#ef4444" />
                <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-[2px]">por</Text>
              </View>
              
              <Text className="text-xl font-black text-white text-center tracking-tight mb-0.5">Lucas Morais</Text>
              
              <View className="items-center mt-1">
                <View className="bg-zinc-900 border border-amber-500/30 px-3 py-0.5 rounded-lg">
                  <Text className="text-amber-400 text-[11px] font-black tracking-widest uppercase">@1Lucas1apk</Text>
                </View>
              </View>
            </View>

            {/* CARD POÉTICO: EUDAIMONIA (S.F.) */}
            <View className="bg-[#121216] p-5 rounded-[28px] border border-amber-500/30 mb-4 shadow-md">
              {/* Título com Ícone */}
              <View className="flex-row items-center gap-2 mb-3">
                <SunMedium size={16} color="#fbbf24" />
                <Text className="text-xs font-black uppercase tracking-[2px] text-amber-400">
                  EUDAIMONIA <Text className="text-[10px] font-normal text-zinc-500 lowercase">(s.f.)</Text>
                </Text>
              </View>

              {/* Texto */}
              <View className="bg-[#09090c] p-3.5 px-4 rounded-2xl border border-zinc-800/90 gap-2.5">
                <Text className="text-zinc-200 text-xs font-medium leading-5">
                  é como se chama a sensação de ser tomado por um sentimento bom sem explicação.
                </Text>
                
                <Text className="text-zinc-200 text-xs font-medium leading-5">
                  é aquela vontade de viver que surge quando menos se espera e mais se precisa. é o universo nos dando um abraço de esperança. é sentir que somos o melhor de nós.
                </Text>
                
                <View className="pt-1.5 border-t border-zinc-800/60">
                  <Text className="text-amber-300 font-bold text-xs leading-5">
                    é aquela sensação de ano-novo de que tudo pode ser melhor. e é.
                  </Text>
                </View>
              </View>
            </View>

            {/* Links e Redes Sociais */}
            <View className="mb-4">
              <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-[2px] mb-2.5 ml-1">
                Links e Contatos
              </Text>
              
              <LinkButton 
                icon={Code} 
                title="Meu GitHub" 
                subtitle="Projetos e Código Aberto" 
                url="https://github.com/1Lucas1apk" 
                color="#e4e4e7" 
              />
              <LinkButton 
                icon={Globe} 
                title="Meu Portfólio" 
                subtitle="Conheça meu trabalho" 
                url="https://1lucas1apk.fun/" 
                color="#60a5fa" 
              />
            </View>

            {/* Esquilo Pixel Art Animado da Tela Painel */}
            <View className="items-center py-2 mb-2">
              <PixelSquirrelFooter />
            </View>

            {/* Footer */}
            <View className="items-center opacity-60">
              <Text className="text-[9px] font-black text-zinc-500 uppercase tracking-[3px]">
                Squirrel Systems • 2026
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
