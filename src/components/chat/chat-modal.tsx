import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, Modal, Alert } from "react-native";
import { X, Send, Users, User, Check, CheckCheck, Trash2, Edit2, Info } from "lucide-react-native";
import { useChat } from "../../hooks/use-chat";
import { useAppSettings } from "../../hooks/use-app-settings";
import { toBrl } from "../../utils/currency";

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ChatModal({ visible, onClose }: ChatModalProps) {
  const { 
    mensagens, 
    mensagensMural, 
    caixasAtivos, 
    meuCaixaId, 
    operatorName,
    enviarMensagem, 
    apagarMensagem,
    editarMensagem,
    removerFantasma,
    marcarComoLida,
    naoLidas,
    hasPairingCode
  } = useChat();

  const { settings } = useAppSettings();
  const pairingCode = settings.chatPairingCode?.trim() || "";

  const [abaAtiva, setAbaAtiva] = useState<"mural" | string>("mural"); 
  const [texto, setTexto] = useState("");
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<{id: string, texto: string} | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  const [secretMode, setSecretMode] = useState(false);
  const [avatarTaps, setAvatarTaps] = useState(0);

  const flatListRef = useRef<FlatList>(null);

  // Filtrar as mensagens da aba ativa
  const mensagensExibidas = abaAtiva === "mural" 
    ? mensagensMural
    : mensagens.filter(m => 
        (m.remetenteId === meuCaixaId && m.destinatarioId === abaAtiva) ||
        (m.remetenteId === abaAtiva && m.destinatarioId === meuCaixaId)
      );

  useEffect(() => {
    if (visible && hasPairingCode) {
      const naoLidasNaAba = mensagensExibidas.filter(m => m.remetenteId !== meuCaixaId && !m.lidasPor.includes(meuCaixaId!));
      naoLidasNaAba.forEach(m => marcarComoLida(m.id));
    }
  }, [visible, abaAtiva, mensagensExibidas, meuCaixaId, hasPairingCode]);

  const handleEnviar = async () => {
    const txt = texto.trim();
    if (!txt || !hasPairingCode) return;
    
    // Clear EARLY to avoid spam
    setTexto("");

    if (editingMsgId) {
      const id = editingMsgId;
      setEditingMsgId(null);
      await editarMensagem(id, txt);
    } else {
      const dest = abaAtiva === "mural" ? undefined : abaAtiva;
      await enviarMensagem(txt, dest);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const getUnreadCount = (chatId: string) => {
    return naoLidas.filter(m => 
      (chatId === "mural" ? !m.destinatarioId : m.remetenteId === chatId)
    ).length;
  };

  const handleAvatarTap = () => {
    setAvatarTaps(prev => {
      const novo = prev + 1;
      if (novo >= 4) {
        setSecretMode(!secretMode);
        Alert.alert("Modo Secreto", !secretMode ? "Você agora pode ver mensagens apagadas." : "Modo secreto desativado.");
        return 0;
      }
      return novo;
    });
  };

  const handleGhostRemove = (id: string, nome: string) => {
    if (id === "mural") return;
    Alert.alert("Remover Contato", `Deseja remover ${nome} da lista?`, [
      { text: "Remover", onPress: () => removerFantasma(id), style: "destructive" },
      { text: "Cancelar", style: "cancel" }
    ]);
  };

  if (!visible) return null;

  if (!hasPairingCode) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View className="flex-1 bg-ink-950 pt-4 px-6 items-center justify-center">
          <View className="bg-ink-900 border border-amber-500/30 p-8 rounded-[40px] shadow-2xl items-center w-full max-w-[400px]">
            <View className="h-16 w-16 bg-amber-500/10 rounded-full items-center justify-center mb-6">
              <Users size={32} color="#f59e0b" />
            </View>
            <Text className="text-xl font-black text-white uppercase tracking-widest text-center mb-2">Chat Desativado</Text>
            <Text className="text-sm font-bold text-zinc-400 text-center leading-6 mb-8">
              Para usar a Comunicação Interna, você precisa definir um <Text className="text-amber-400">Código de Pareamento</Text> e um <Text className="text-amber-400">Nome</Text> na tela de Ajustes do Painel.
            </Text>
            <Pressable onPress={onClose} className="w-full bg-zinc-100 py-5 rounded-[24px] shadow-xl">
              <Text className="text-center font-black uppercase tracking-[2px] text-zinc-950">Entendi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  const avatarInitials = operatorName !== "Desconhecido" ? operatorName.substring(0, 2).toUpperCase() : "CX";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View className="flex-1 bg-ink-950">
          
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-8 pb-5 border-b border-white/5">
            <View className="flex-row items-center gap-4">
              <Pressable 
                onPress={handleAvatarTap}
                className="h-12 w-12 bg-blue-600 rounded-full items-center justify-center shadow-lg shadow-blue-600/30 relative"
              >
                <Text className="text-white font-black text-lg">{avatarInitials}</Text>
                <View className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-ink-950" />
              </Pressable>
              <View>
                <Text className="text-lg font-black text-white tracking-tight">Comunicações</Text>
                <Text className="text-[11px] text-zinc-400 font-medium">Você é o(a) {operatorName} • Sala: {pairingCode}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} className="h-10 w-10 bg-zinc-800/80 rounded-full items-center justify-center">
              <X size={20} color="#a1a1aa" />
            </Pressable>
          </View>

          {/* Abas de Chats */}
          <View className="border-b border-white/5 py-4">
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[{ id: "mural", nome: "Mural Global" }, ...caixasAtivos]}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}
              renderItem={({ item }) => {
                const unread = getUnreadCount(item.id);
                const isActive = abaAtiva === item.id;
                return (
                  <Pressable
                    onPress={() => setAbaAtiva(item.id)}
                    onLongPress={() => handleGhostRemove(item.id, item.nome)}
                    className="items-center gap-2"
                  >
                    <View className={`h-16 w-16 rounded-full items-center justify-center border-2 relative ${
                      isActive ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800 bg-zinc-900'
                    }`}>
                      {item.id === "mural" 
                        ? <Users size={24} color={isActive ? "#3b82f6" : "#71717a"} strokeWidth={isActive ? 2.5 : 2} /> 
                        : <User size={24} color={isActive ? "#3b82f6" : "#71717a"} strokeWidth={isActive ? 2.5 : 2} />}
                      
                      {item.id !== "mural" && (
                        <View className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-ink-950" />
                      )}

                      {unread > 0 && (
                        <View className="absolute -top-1 -right-1 bg-red-500 rounded-full h-6 min-w-[24px] items-center justify-center border-2 border-ink-950 px-1 z-10">
                          <Text className="text-[10px] font-black text-white">{unread}</Text>
                        </View>
                      )}
                    </View>
                    <Text className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-blue-400' : 'text-zinc-500'}`}>
                      {item.id === "mural" ? "Global" : item.nome}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          {/* Mensagens */}
          <FlatList
            ref={flatListRef}
            data={mensagensExibidas}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 20, gap: 16 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-20 opacity-50">
                <Text className="text-zinc-500 font-bold uppercase tracking-widest text-xs text-center leading-relaxed">
                  Sem mensagens ainda.{"\n"}Seja o primeiro a enviar!
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMe = item.remetenteId === meuCaixaId;
              const isLida = item.destinatarioId ? item.lidasPor.includes(item.destinatarioId) : item.lidasPor.length > 1;
              const isApagada = !!item.apagadaEm;
              
              if (isApagada && !secretMode) {
                return (
                  <View className={`w-full flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <View className="max-w-[75%] rounded-[20px] px-4 py-3 bg-zinc-900 border border-zinc-800 flex-row items-center gap-2">
                      <Info size={14} color="#71717a" />
                      <Text className="text-[12px] font-medium text-zinc-500 italic">Mensagem apagada</Text>
                    </View>
                  </View>
                );
              }

              return (
                <View className={`w-full flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <Pressable 
                    onLongPress={() => {
                      if (isMe && !isApagada) {
                        setSelectedMessage({ id: item.id, texto: item.texto });
                      }
                    }}
                    delayLongPress={200}
                    className={`max-w-[75%] rounded-[20px] px-4 py-3 ${
                      isMe 
                        ? 'bg-blue-600 rounded-tr-sm' 
                        : 'bg-zinc-800/80 rounded-tl-sm border border-zinc-700/30'
                    } ${isApagada ? 'opacity-50 border border-red-500/50' : ''}`}
                  >
                    {!isMe && abaAtiva === "mural" && (
                      <Text className="text-[11px] font-bold text-blue-400 mb-1">{item.remetenteNome}</Text>
                    )}
                    <Text className={`text-[15px] leading-[22px] ${isMe ? 'text-white' : 'text-zinc-100'}`}>
                      {item.texto}
                    </Text>
                    <View className="flex-row items-center justify-end gap-1.5 mt-1">
                      {item.editadaEm && !isApagada && (
                        <Text className={`text-[9px] font-bold ${isMe ? 'text-blue-300' : 'text-zinc-600'}`}>Editado</Text>
                      )}
                      <Text className={`text-[10px] font-medium ${isMe ? 'text-blue-200' : 'text-zinc-500'}`}>
                        {new Date(item.timestamp).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      {isMe && !isApagada && (
                        isLida ? <CheckCheck size={14} color="#93c5fd" /> : <Check size={14} color="#93c5fd" style={{ opacity: 0.6 }} />
                      )}
                    </View>
                  </Pressable>
                </View>
              );
            }}
          />

          {/* Input e Loading State para Edição */}
          {editingMsgId && (
            <View className="px-6 py-2 bg-blue-900/30 flex-row justify-between items-center border-t border-blue-500/20">
              <Text className="text-xs text-blue-400 font-bold">Editando mensagem...</Text>
              <Pressable onPress={() => { setEditingMsgId(null); setTexto(""); }}>
                <Text className="text-xs text-zinc-400">Cancelar</Text>
              </Pressable>
            </View>
          )}

          {/* Input Area */}
          <View className="px-5 py-4 pb-8 border-t border-white/5">
            {editingMsgId && (
              <Text className="text-[10px] text-zinc-500 mb-1 ml-2 font-bold uppercase">Editando Mensagem</Text>
            )}
            <View className="flex-row items-center gap-3">
              <View className="flex-1 bg-zinc-900 rounded-full border border-zinc-800 px-5 py-3.5">
                <TextInput
                  value={texto}
                  onChangeText={setTexto}
                  placeholder="Mensagem..."
                  placeholderTextColor="#71717a"
                  className="text-white text-[15px] p-0"
                  onSubmitEditing={handleEnviar}
                  returnKeyType="send"
                />
              </View>
              <Pressable 
                onPress={handleEnviar}
                className={`h-12 w-12 rounded-full items-center justify-center ${
                  texto.trim().length > 0 ? 'bg-blue-600' : 'bg-zinc-800'
                }`}
              >
                <Send size={18} color={texto.trim().length > 0 ? "#ffffff" : "#52525b"} style={{ marginLeft: 2 }} />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modal de Opções de Mensagem (Customizado) */}
      <Modal 
        visible={!!selectedMessage} 
        transparent 
        animationType="fade" 
        onRequestClose={() => {
          setSelectedMessage(null);
          setConfirmDelete(false);
        }}
      >
        <Pressable 
          className="flex-1 bg-black/60 justify-center items-center p-6"
          onPress={() => {
            setSelectedMessage(null);
            setConfirmDelete(false);
          }}
        >
          <Pressable 
            className="w-full max-w-[320px] bg-ink-900 rounded-[24px] border border-zinc-800/80 overflow-hidden shadow-2xl"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="p-5 border-b border-white/5 bg-ink-950/50">
              <Text className="text-white font-black text-center text-lg mb-1">
                {confirmDelete ? "Apagar Mensagem?" : "Opções da Mensagem"}
              </Text>
              <Text className="text-zinc-500 font-medium text-center text-xs" numberOfLines={1}>
                "{selectedMessage?.texto}"
              </Text>
            </View>

            {!confirmDelete ? (
              <>
                <Pressable 
                  onPress={() => {
                    if (selectedMessage) {
                      setTexto(selectedMessage.texto);
                      setEditingMsgId(selectedMessage.id);
                      setSelectedMessage(null);
                      setConfirmDelete(false);
                    }
                  }}
                  className="flex-row items-center p-5 border-b border-white/5 active:bg-zinc-800/50"
                >
                  <View className="h-10 w-10 rounded-full bg-blue-500/10 items-center justify-center mr-4">
                    <Edit2 size={20} color="#60a5fa" />
                  </View>
                  {/* @ts-ignore */}
                  <Text className="text-blue-400 font-bold text-base flex-1" style={{ userSelect: 'none' }}>Editar Mensagem</Text>
                </Pressable>

                <Pressable 
                  onPress={() => setConfirmDelete(true)}
                  className="flex-row items-center p-5 active:bg-zinc-800/50"
                >
                  <View className="h-10 w-10 rounded-full bg-red-500/10 items-center justify-center mr-4">
                    <Trash2 size={20} color="#f87171" />
                  </View>
                  {/* @ts-ignore */}
                  <Text className="text-red-400 font-bold text-base flex-1" style={{ userSelect: 'none' }}>Apagar para Todos</Text>
                </Pressable>
              </>
            ) : (
              <View className="p-5 flex-row items-center justify-center gap-4">
                <Pressable 
                  onPress={() => setConfirmDelete(false)}
                  className="flex-1 bg-zinc-800 py-3 rounded-xl items-center"
                >
                  {/* @ts-ignore */}
                  <Text className="text-zinc-300 font-bold" style={{ userSelect: 'none' }}>Cancelar</Text>
                </Pressable>
                <Pressable 
                  onPress={() => {
                    if (selectedMessage) {
                      apagarMensagem(selectedMessage.id);
                      setSelectedMessage(null);
                      setConfirmDelete(false);
                    }
                  }}
                  className="flex-1 bg-red-500/20 py-3 rounded-xl items-center border border-red-500/30"
                >
                  {/* @ts-ignore */}
                  <Text className="text-red-400 font-bold" style={{ userSelect: 'none' }}>Sim, Apagar</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}
