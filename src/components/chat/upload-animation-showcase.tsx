import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  Animated,
  Easing,
  Modal,
  Dimensions
} from "react-native";
import {
  X,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  Gamepad2,
  Check,
  CheckCheck,
  Rocket,
  Shield,
  Layers,
  ArrowRight
} from "lucide-react-native";

interface UploadAnimationShowcaseProps {
  visible: boolean;
  onClose: () => void;
  onSelectStyle?: (styleId: "pixel" | "cyber" | "glass" | "squirrel") => void;
  selectedStyle?: "pixel" | "cyber" | "glass" | "squirrel";
}

const SAMPLE_IMAGE = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80";

export function UploadAnimationShowcase({
  visible,
  onClose,
  onSelectStyle,
  selectedStyle = "pixel",
}: UploadAnimationShowcaseProps) {
  const [activeTab, setActiveTab] = useState<"pixel" | "cyber" | "glass" | "squirrel">(selectedStyle);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Valores Animados do React Native
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scanlineAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const pixelFadeAnim = useRef(new Animated.Value(0)).current;
  const jetpackY = useRef(new Animated.Value(0)).current;

  // Loops contínuos de animação
  useEffect(() => {
    // 1. Scanline laser loop
    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanlineAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanlineAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Rotação do anel cyberpunk
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // 3. Pulso neon
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // 4. Mascote esquilo jetpack flutuando
    const jetpackLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(jetpackY, {
          toValue: -8,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(jetpackY, {
          toValue: 4,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    scanLoop.start();
    rotateLoop.start();
    pulseLoop.start();
    jetpackLoop.start();

    return () => {
      scanLoop.stop();
      rotateLoop.stop();
      pulseLoop.stop();
      jetpackLoop.stop();
    };
  }, []);

  // Simulação de envio com progresso
  const handleStartUpload = () => {
    setIsUploading(true);
    setIsCompleted(false);
    setProgress(0);
    progressAnim.setValue(0);

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3200,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsUploading(false);
        setIsCompleted(true);
        setProgress(100);
        
        // Efeito de conclusão
        Animated.sequence([
          Animated.spring(bounceAnim, { toValue: 1.25, friction: 3, useNativeDriver: true }),
          Animated.spring(bounceAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
        ]).start();
      }
    });

    // Atualizador numérico visual de progresso (0% a 100%)
    let currentPct = 0;
    const interval = setInterval(() => {
      currentPct += Math.floor(Math.random() * 8) + 4;
      if (currentPct >= 100) {
        currentPct = 100;
        clearInterval(interval);
      }
      setProgress(currentPct);
    }, 180);
  };

  const handleReset = () => {
    progressAnim.setValue(0);
    setProgress(0);
    setIsUploading(false);
    setIsCompleted(false);
  };

  const spinInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const scanlineY = scanlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180],
  });

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View className="flex-1 bg-[#09090c] p-4 pt-10">
        
        {/* Header */}
        <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/40 items-center justify-center">
              <Sparkles size={18} color="#fbbf24" />
            </View>
            <View>
              <Text className="text-sm font-black uppercase tracking-wider text-white">
                Laboratório de Animações
              </Text>
              <Text className="text-xs text-zinc-400 font-medium">
                Escolha o estilo visual de envio de imagens
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center">
            <X size={15} color="#a1a1aa" />
          </Pressable>
        </View>

        {/* Seletor de Estilos */}
        <View className="flex-row gap-1.5 my-4 p-1 bg-[#121216] border border-zinc-800 rounded-2xl">
          <Pressable
            onPress={() => { setActiveTab("pixel"); handleReset(); }}
            className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${
              activeTab === "pixel" ? "bg-emerald-500/20 border border-emerald-500/40" : ""
            }`}
          >
            <Gamepad2 size={13} color={activeTab === "pixel" ? "#34d399" : "#71717a"} />
            <Text className={`text-[11px] font-black uppercase ${activeTab === "pixel" ? "text-emerald-400" : "text-zinc-500"}`}>
              Pixel Art
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { setActiveTab("cyber"); handleReset(); }}
            className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${
              activeTab === "cyber" ? "bg-cyan-500/20 border border-cyan-500/40" : ""
            }`}
          >
            <Zap size={13} color={activeTab === "cyber" ? "#38bdf8" : "#71717a"} />
            <Text className={`text-[11px] font-black uppercase ${activeTab === "cyber" ? "text-cyan-400" : "text-zinc-500"}`}>
              Cyber Matrix
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { setActiveTab("glass"); handleReset(); }}
            className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${
              activeTab === "glass" ? "bg-indigo-500/20 border border-indigo-500/40" : ""
            }`}
          >
            <Layers size={13} color={activeTab === "glass" ? "#818cf8" : "#71717a"} />
            <Text className={`text-[11px] font-black uppercase ${activeTab === "glass" ? "text-indigo-400" : "text-zinc-500"}`}>
              Glass Fluid
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { setActiveTab("squirrel"); handleReset(); }}
            className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${
              activeTab === "squirrel" ? "bg-amber-500/20 border border-amber-500/40" : ""
            }`}
          >
            <Rocket size={13} color={activeTab === "squirrel" ? "#fbbf24" : "#71717a"} />
            <Text className={`text-[11px] font-black uppercase ${activeTab === "squirrel" ? "text-amber-400" : "text-zinc-500"}`}>
              Squirrel Jet
            </Text>
          </Pressable>
        </View>

        {/* ========================================================================= */}
        {/* PALCO DE VISUALIZAÇÃO INTERATIVA DA ANIMAÇÃO */}
        {/* ========================================================================= */}
        <View className="flex-1 bg-[#0f0f14] border border-zinc-800 rounded-3xl p-5 items-center justify-center relative overflow-hidden shadow-2xl">
          
          {/* 1. MODELO PIXEL ART 8-BIT */}
          {activeTab === "pixel" && (
            <View className="w-full max-w-[310px] items-center">
              
              {/* Moldura Retrô de Pixel Art com bordas duplas escalonadas */}
              <View className="w-full bg-[#1b1c24] border-4 border-[#34d399] p-3 rounded-none shadow-[0_0_20px_rgba(52,211,153,0.3)] relative">
                
                {/* Cantos pixelados decorativos */}
                <View className="absolute -top-2 -left-2 w-3 h-3 bg-[#34d399]" />
                <View className="absolute -top-2 -right-2 w-3 h-3 bg-[#34d399]" />
                <View className="absolute -bottom-2 -left-2 w-3 h-3 bg-[#34d399]" />
                <View className="absolute -bottom-2 -right-2 w-3 h-3 bg-[#34d399]" />

                {/* Header Retrô */}
                <View className="flex-row items-center justify-between pb-2 mb-2 border-b-2 border-dashed border-emerald-500/40">
                  <Text className="text-[10.5px] font-mono font-black text-emerald-400 uppercase tracking-widest">
                    [SQ_PIXEL_DRIVE.EXE]
                  </Text>
                  <Text className="text-[9.5px] font-mono text-emerald-300">
                    {isCompleted ? "★ DONE!" : isUploading ? "UPLOADING..." : "IDLE"}
                  </Text>
                </View>

                {/* Imagem com Overlay de Scanline CRT */}
                <View className="w-full h-44 bg-black relative overflow-hidden border-2 border-emerald-500/30">
                  <Image source={{ uri: SAMPLE_IMAGE }} className="w-full h-full opacity-85" resizeMode="cover" />

                  {/* Scanline CRT Animado */}
                  <Animated.View
                    style={{
                      transform: [{ translateY: scanlineY }],
                    }}
                    className="absolute left-0 right-0 h-1.5 bg-emerald-400/60 shadow-[0_0_10px_#34d399]"
                  />

                  {/* Esquilinho Pixel Art Mascote */}
                  <View className="absolute bottom-2 left-2 bg-black/80 border border-emerald-400 px-2 py-1 flex-row items-center gap-1.5">
                    <Text className="text-xs">🐿️</Text>
                    <Text className="text-[9px] font-mono font-bold text-emerald-300">
                      {isCompleted ? "100% SYNC" : `${progress}%`}
                    </Text>
                  </View>

                  {/* Overlay Concluído Pixel */}
                  {isCompleted && (
                    <View className="absolute inset-0 bg-black/75 items-center justify-center">
                      <View className="border-2 border-emerald-400 bg-[#09090c] px-3 py-2 items-center">
                        <Text className="text-sm font-mono font-black text-emerald-400">★ STAGE CLEAR ★</Text>
                        <Text className="text-[10px] font-mono text-white mt-0.5">FILE SAVED IN DRIVE</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Barra de Progresso de Blocos de Pixel */}
                <View className="mt-3">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-[10px] font-mono text-emerald-400 font-bold">
                      DATA CHUNKS: {Math.floor((progress / 100) * 2048)}KB / 2048KB
                    </Text>
                    <Text className="text-[11px] font-mono text-emerald-400 font-black">
                      {progress}%
                    </Text>
                  </View>

                  {/* Barra com efeito de blocos [██████░░░░] */}
                  <View className="w-full h-5 bg-black border border-emerald-500/50 p-0.5 flex-row gap-0.5">
                    {Array.from({ length: 20 }).map((_, idx) => {
                      const isFilled = (idx / 20) * 100 <= progress;
                      return (
                        <View
                          key={idx}
                          className={`flex-1 h-full ${
                            isFilled ? "bg-emerald-400" : "bg-emerald-950/40"
                          }`}
                        />
                      );
                    })}
                  </View>
                </View>

              </View>
            </View>
          )}

          {/* 2. MODELO CYBER MATRIX (HOLOGRÁFICO NEON) */}
          {activeTab === "cyber" && (
            <View className="w-full max-w-[310px] items-center">
              <View className="w-full bg-[#0d1117] border-2 border-cyan-500/50 rounded-3xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.25)] relative overflow-hidden">
                
                {/* Grade de fundo HUD */}
                <View className="flex-row items-center justify-between pb-2 border-b border-cyan-500/20">
                  <View className="flex-row items-center gap-1.5">
                    <Zap size={13} color="#22d3ee" />
                    <Text className="text-[11px] font-mono font-black text-cyan-300 uppercase tracking-widest">
                      QUANTUM BEAM v4.2
                    </Text>
                  </View>
                  <Text className="text-[10px] font-mono text-cyan-400 font-bold">
                    {isCompleted ? "ONLINE" : isUploading ? "SYNCING..." : "STANDBY"}
                  </Text>
                </View>

                {/* Imagem com Raio Laser Holográfico */}
                <View className="w-full h-44 rounded-2xl bg-black my-3 relative overflow-hidden border border-cyan-500/40">
                  <Image source={{ uri: SAMPLE_IMAGE }} className="w-full h-full opacity-80" resizeMode="cover" />

                  {/* Anel Giratório Holográfico no Centro */}
                  {isUploading && (
                    <View className="absolute inset-0 items-center justify-center bg-black/40">
                      <Animated.View
                        style={{ transform: [{ rotate: spinInterpolate }] }}
                        className="w-16 h-16 rounded-full border-2 border-dashed border-cyan-400 items-center justify-center shadow-[0_0_15px_#22d3ee]"
                      >
                        <Animated.View
                          style={{ transform: [{ scale: pulseAnim }] }}
                          className="w-10 h-10 rounded-full border-2 border-cyan-300 items-center justify-center bg-cyan-500/20"
                        >
                          <Text className="text-[10px] font-mono font-black text-white">{progress}%</Text>
                        </Animated.View>
                      </Animated.View>
                    </View>
                  )}

                  {/* Laser Scanline Horizontal Ciano */}
                  <Animated.View
                    style={{ transform: [{ translateY: scanlineY }] }}
                    className="absolute left-0 right-0 h-1 bg-cyan-300 shadow-[0_0_12px_#22d3ee]"
                  />

                  {/* Selo Criptográfico ao Concluir */}
                  {isCompleted && (
                    <View className="absolute inset-0 bg-black/70 items-center justify-center">
                      <View className="px-4 py-2 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex-row items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                        <Shield size={16} color="#22d3ee" />
                        <View>
                          <Text className="text-xs font-mono font-black text-cyan-300">ENCRYPTED & SYNCED</Text>
                          <Text className="text-[9px] font-mono text-zinc-300">SHA-256 VERIFIED</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>

                {/* Medidor Linear Neon */}
                <View className="w-full">
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="text-[10px] font-mono text-cyan-400/80">OAUTH2 BUFFER</Text>
                    <Text className="text-xs font-mono font-black text-cyan-300">{progress}%</Text>
                  </View>
                  <View className="w-full h-2 rounded-full bg-zinc-900 border border-cyan-500/30 overflow-hidden">
                    <View
                      style={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r bg-cyan-400 shadow-[0_0_10px_#22d3ee]"
                    />
                  </View>
                </View>

              </View>
            </View>
          )}

          {/* 3. MODELO GLASS FLUID (TELEGRAM / WHATSAPP PRO) */}
          {activeTab === "glass" && (
            <View className="w-full max-w-[310px] items-center">
              <View className="w-full bg-[#181820]/90 border border-zinc-700/60 rounded-[32px] p-4 shadow-2xl">
                
                <View className="flex-row items-center justify-between pb-2 mb-2 border-b border-zinc-800">
                  <Text className="text-xs font-bold text-zinc-300">Comprovante de Envio</Text>
                  <Text className="text-[11px] font-mono text-indigo-400 font-bold">{progress}%</Text>
                </View>

                {/* Card de Imagem com Blur e Círculo Líquido */}
                <View className="w-full h-44 rounded-2xl bg-black relative overflow-hidden border border-zinc-700 shadow-inner">
                  <Image source={{ uri: SAMPLE_IMAGE }} className="w-full h-full opacity-70" resizeMode="cover" />

                  {/* Círculo de Progresso Líquido Translúcido */}
                  <View className="absolute inset-0 items-center justify-center bg-black/40">
                    <View className="w-16 h-16 rounded-full bg-black/60 border border-white/20 items-center justify-center backdrop-blur-md shadow-2xl">
                      {isCompleted ? (
                        <View className="h-10 w-10 rounded-full bg-emerald-500 items-center justify-center shadow-lg">
                          <CheckCheck size={20} color="#ffffff" strokeWidth={3} />
                        </View>
                      ) : (
                        <View className="items-center justify-center">
                          <Text className="text-xs font-black text-white">{progress}%</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Barra de Progresso Suave */}
                <View className="mt-3 w-full">
                  <View className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <View
                      style={{ width: `${progress}%` }}
                      className="h-full bg-indigo-500 rounded-full shadow-lg"
                    />
                  </View>
                  <View className="flex-row items-center justify-between mt-1.5">
                    <Text className="text-[10px] text-zinc-400">Google Drive 5TB</Text>
                    <Text className="text-[10px] font-mono text-indigo-300 font-bold">
                      {isCompleted ? "Pronto para envio" : "Enviando imagem..."}
                    </Text>
                  </View>
                </View>

              </View>
            </View>
          )}

          {/* 4. MODELO SQUIRREL JETPACK (MASCOTE PLAYFUL) */}
          {activeTab === "squirrel" && (
            <View className="w-full max-w-[310px] items-center">
              <View className="w-full bg-[#18140e] border-2 border-amber-500/50 rounded-[32px] p-4 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                
                <View className="flex-row items-center justify-between pb-2 border-b border-amber-500/20">
                  <View className="flex-row items-center gap-1.5">
                    <Rocket size={14} color="#fbbf24" />
                    <Text className="text-xs font-black uppercase text-amber-300 tracking-wider">
                      Squirrel Express 🚀
                    </Text>
                  </View>
                  <Text className="text-[11px] font-mono text-amber-400 font-bold">{progress}%</Text>
                </View>

                {/* Imagem com Mascote Subindo em Jetpack */}
                <View className="w-full h-44 rounded-2xl bg-black my-3 relative overflow-hidden border border-amber-500/30">
                  <Image source={{ uri: SAMPLE_IMAGE }} className="w-full h-full opacity-75" resizeMode="cover" />

                  {/* Mascote Animado com Foguete */}
                  <Animated.View
                    style={{
                      transform: [
                        { translateY: jetpackY },
                        { scale: pulseAnim }
                      ],
                    }}
                    className="absolute inset-0 items-center justify-center"
                  >
                    <View className="items-center">
                      <View className="h-16 w-16 rounded-full bg-amber-500/30 border-2 border-amber-400 items-center justify-center shadow-[0_0_20px_#f59e0b]">
                        <Text className="text-3xl">{isCompleted ? "🏆" : "🐿️"}</Text>
                      </View>
                      {!isCompleted && (
                        <Text className="text-xs font-black text-amber-300 mt-1 shadow">
                          💨 {progress}%
                        </Text>
                      )}
                    </View>
                  </Animated.View>

                  {/* Selo Dourado Final */}
                  {isCompleted && (
                    <View className="absolute inset-0 bg-black/60 items-center justify-center">
                      <View className="px-4 py-2 rounded-2xl bg-amber-500 border border-amber-300 items-center shadow-2xl">
                        <Text className="text-xs font-black uppercase text-black">ENTREGA CONCLUÍDA!</Text>
                        <Text className="text-[10px] font-bold text-amber-950">Foto salva com sucesso</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Barra de Progresso Dourada */}
                <View className="w-full">
                  <View className="w-full h-3 rounded-full bg-zinc-900 border border-amber-500/40 p-0.5 overflow-hidden">
                    <View
                      style={{ width: `${progress}%` }}
                      className="h-full bg-amber-400 rounded-full shadow-[0_0_10px_#f59e0b]"
                    />
                  </View>
                </View>

              </View>
            </View>
          )}

        </View>

        {/* Controles Interativos de Teste */}
        <View className="mt-4 gap-2.5">
          <View className="flex-row gap-2.5">
            <Pressable
              onPress={handleStartUpload}
              disabled={isUploading}
              className={`flex-1 h-13 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg active:scale-95 ${
                isUploading ? "bg-zinc-800 opacity-60" : "bg-indigo-600"
              }`}
            >
              <Play size={16} color="#ffffff" />
              <Text className="text-white text-xs font-black uppercase tracking-wider">
                {isUploading ? "Enviando..." : "Testar Envio"}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleReset}
              className="h-13 px-4 rounded-2xl bg-zinc-900 border border-zinc-800 items-center justify-center active:scale-95"
            >
              <RotateCcw size={16} color="#d4d4d8" />
            </Pressable>
          </View>

          {/* Botão para Escolher e Salvar Estilo Ativo */}
          {onSelectStyle && (
            <Pressable
              onPress={() => {
                onSelectStyle(activeTab);
                onClose();
              }}
              className="w-full h-12 rounded-2xl bg-amber-500 items-center justify-center flex-row gap-2 shadow-lg active:scale-95"
            >
              <Check size={16} color="#09090c" strokeWidth={3} />
              <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">
                Adotar este Modelo no App
              </Text>
            </Pressable>
          )}
        </View>

      </View>
    </Modal>
  );
}
