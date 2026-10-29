import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Plus, Trash2, Building2, Edit3, X, Check, CreditCard, Sparkles, FileText, User } from 'lucide-react-native';
import { RegistroConvenio } from '../types/domain';
import { toBrl } from '../utils/currency';
import { MoneyInput } from '../components/common/money-input';
import * as Haptics from 'expo-haptics';

interface ConvenioScreenProps {
  registros: RegistroConvenio[];
  onAdicionar: (input: { nome: string; descricao?: string; valor: number }) => void;
  onEditar?: (id: string, input: Partial<Omit<RegistroConvenio, 'id' | 'timestamp'>>) => void;
  onExcluir: (id: string) => void;
  isFechado: boolean;
}

function ConvenioScreenComponent({
  registros,
  onAdicionar,
  onEditar,
  onExcluir,
  isFechado
}: ConvenioScreenProps) {
  const [nome, setNome] = useState('');
  const [desc, setDesc] = useState('');
  const [valorRegistro, setValorRegistro] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setNome('');
    setDesc('');
    setValorRegistro(0);
    setEditingId(null);
  };

  const handleSalvar = () => {
    if (valorRegistro <= 0 || !nome.trim()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (editingId && onEditar) {
      onEditar(editingId, {
        nome: nome.trim(),
        descricao: desc.trim() || undefined,
        valor: valorRegistro,
      });
    } else {
      onAdicionar({
        nome: nome.trim(),
        descricao: desc.trim() || undefined,
        valor: valorRegistro,
      });
    }
    resetForm();
  };

  const handleIniciarEdicao = (item: RegistroConvenio) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(item.id);
    setNome(item.nome);
    setDesc(item.descricao || '');
    setValorRegistro(item.valor);
  };

  const totalConvenio = React.useMemo(() => (registros || []).reduce((acc, r) => acc + (r.valor || 0), 0), [registros]);
  const qtdRegistros = React.useMemo(() => (registros || []).length, [registros]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-3">
          {/* 1. DOCK DE RESUMO TOTAL (ESTILO DNA SQUIRREL) */}
          <View className="bg-[#121216] border border-purple-500/30 rounded-3xl p-3.5 px-4 shadow-xl gap-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="h-6 w-6 rounded-lg bg-purple-500/15 border border-purple-500/30 items-center justify-center flex-shrink-0">
                  <Building2 size={13} color="#c084fc" />
                </View>
                <Text className="text-[11px] font-black uppercase tracking-wider text-purple-300">
                  Total em Convênios
                </Text>
              </View>
              <View className="bg-purple-500/10 border border-purple-500/25 px-2 py-0.5 rounded-lg">
                <Text className="text-[10.5px] font-black text-purple-300 font-mono">
                  {qtdRegistros} {qtdRegistros === 1 ? 'registro' : 'registros'}
                </Text>
              </View>
            </View>

            <View className="mt-0.5">
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                className="text-2xl font-black text-white font-mono tracking-tight"
              >
                {toBrl(totalConvenio)}
              </Text>
              <Text className="text-[10px] text-zinc-400 font-medium mt-0.5">
                Vendas faturadas a prazo / parceiros externos
              </Text>
            </View>
          </View>

          {/* 2. FORMULÁRIO DE LANÇAMENTO / EDIÇÃO */}
          {!isFechado && (
            <View
              className={`bg-[#121216] border ${
                editingId ? 'border-blue-500/50' : 'border-purple-500/40'
              } rounded-[32px] p-3.5 shadow-2xl gap-3 transition-all`}
            >
              {/* Topo do Formulário */}
              <View className="flex-row items-center justify-between pb-1 border-b border-zinc-800/80">
                <View className="flex-row items-center gap-2">
                  <View
                    className={`h-6 w-6 rounded-lg ${
                      editingId
                        ? 'bg-blue-500/20 border-blue-500/40'
                        : 'bg-purple-500/20 border-purple-500/40'
                    } border items-center justify-center flex-shrink-0`}
                  >
                    {editingId ? (
                      <Edit3 size={13} color="#60a5fa" />
                    ) : (
                      <Plus size={13} color="#c084fc" strokeWidth={3} />
                    )}
                  </View>
                  <Text
                    className={`text-xs font-black uppercase tracking-[1.5px] ${
                      editingId ? 'text-blue-300' : 'text-zinc-200'
                    }`}
                  >
                    {editingId ? 'Editar Convênio' : 'Novo Convênio'}
                  </Text>
                </View>

                {editingId && (
                  <Pressable
                    onPress={resetForm}
                    className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 flex-row items-center gap-1 active:scale-95"
                  >
                    <X size={11} color="#a1a1aa" />
                    <Text className="text-[10px] font-bold text-zinc-400 uppercase">Cancelar</Text>
                  </Pressable>
                )}
              </View>

              {/* Campos do Formulário */}
              <View className="gap-2.5">
                {/* Campo 1: Nome da Financeira */}
                <View className="bg-[#09090c] p-3 px-4 rounded-2xl border border-zinc-800 min-h-[58px] justify-center">
                  <Text className="text-[10.5px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                    Nome da Financeira / Convênio
                  </Text>
                  <TextInput
                    value={nome}
                    onChangeText={setNome}
                    placeholder="UME"
                    placeholderTextColor="#52525b"
                    className="w-full text-sm font-bold text-white"
                  />
                </View>

                {/* Campo 2: VALOR DA OPERAÇÃO (DESTAQUE HERO) */}
                <View className="bg-[#0d0d12] p-4 rounded-[22px] border border-purple-500/40 shadow-md min-h-[72px] flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0">
                    <View className="h-11 w-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 items-center justify-center flex-shrink-0">
                      <CreditCard size={22} color="#c084fc" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black uppercase tracking-wider text-purple-300 leading-none mb-1">
                        Valor da Venda (Convênio)
                      </Text>
                      <View className="flex-row items-center">
                        <Text className="text-zinc-500 text-sm font-bold mr-1.5">R$</Text>
                        <MoneyInput
                          value={valorRegistro}
                          onChangeValue={setValorRegistro}
                          className="flex-1 text-2xl font-black text-purple-300 font-mono"
                          placeholder="0,00"
                          placeholderTextColor="#52525b"
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Campo 3: Cliente / Nº Autorização / Detalhes */}
                <View className="bg-[#09090c] p-3 px-4 rounded-2xl border border-zinc-800 min-h-[54px] justify-center">
                  <Text className="text-[10.5px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                    Cliente / Nº Autorização (Opcional)
                  </Text>
                  <TextInput
                    value={desc}
                    onChangeText={setDesc}
                    placeholder="Cliente / Detalhes"
                    placeholderTextColor="#52525b"
                    className="w-full text-sm text-zinc-200 font-medium"
                  />
                </View>
              </View>

              {/* Botões de Ação */}
              <View className="flex-row items-center gap-2 pt-1">
                {editingId && (
                  <Pressable
                    onPress={resetForm}
                    className="px-5 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 items-center justify-center active:scale-95"
                  >
                    <View className="flex-row items-center gap-1.5">
                      <X size={14} color="#a1a1aa" />
                      <Text className="text-xs font-black uppercase text-zinc-300 tracking-wider">
                        Cancelar
                      </Text>
                    </View>
                  </Pressable>
                )}

                <Pressable
                  onPress={handleSalvar}
                  disabled={valorRegistro <= 0 || !nome.trim()}
                  className={`flex-1 h-12 rounded-2xl items-center justify-center shadow-lg active:scale-[0.98] ${
                    valorRegistro > 0 && nome.trim()
                      ? editingId
                        ? 'bg-blue-600 active:bg-blue-500'
                        : 'bg-purple-600 active:bg-purple-500'
                      : 'bg-zinc-800 opacity-50'
                  }`}
                >
                  <View className="flex-row items-center gap-2">
                    <Check size={16} color="#ffffff" strokeWidth={3} />
                    <Text className="text-white font-black text-xs uppercase tracking-wider">
                      {editingId ? 'Salvar Edição' : 'Registrar Convênio'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          )}

          {/* 3. LISTA DE HISTÓRICO DE CONVÊNIOS (CARDS HERO) */}
          <View className="gap-2 pt-1">
            <View className="flex-row items-center justify-between px-1">
              <Text className="text-xs font-black uppercase tracking-[1.5px] text-zinc-400">
                Lançamentos de Convênio
              </Text>
              <Text className="text-[11px] font-bold text-zinc-500">
                {qtdRegistros} {qtdRegistros === 1 ? 'item' : 'itens'}
              </Text>
            </View>

            {registros.length === 0 ? (
              <View className="bg-[#121216] border border-zinc-800/80 rounded-3xl p-8 items-center justify-center gap-2 my-2">
                <Building2 size={32} color="#52525b" />
                <Text className="text-zinc-500 font-bold text-xs uppercase tracking-wider text-center">
                  Nenhum convênio registrado neste caixa
                </Text>
              </View>
            ) : (
              registros.map((item) => {
                const hora = new Date(item.timestamp).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <View
                    key={item.id}
                    className="rounded-[28px] bg-[#121216] p-4 border border-zinc-800 mb-2 shadow-md"
                  >
                    <View className="flex-row items-center justify-between">
                      {/* Lado Esquerdo: Ícone 48x48 + Informações e Valor Hero */}
                      <View className="flex-1 flex-row items-center gap-3.5 min-w-0">
                        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-500/30 flex-shrink-0">
                          <Building2 size={20} color="#c084fc" strokeWidth={2.5} />
                        </View>

                        <View className="flex-1 min-w-0">
                          {/* Linha 1: Hora • Nome do Parceiro */}
                          <View className="flex-row items-center gap-1.5 flex-wrap mb-1">
                            <Text className="text-[10px] font-black uppercase tracking-widest text-purple-400">
                              {hora} • {item.nome}
                            </Text>
                          </View>

                          {/* Linha 2: VALOR GIGANTE (HERO) */}
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            className="text-xl font-black font-mono text-purple-300 tracking-tight"
                          >
                            + {toBrl(item.valor)}
                          </Text>

                          {/* Linha 3: Descrição / Cliente */}
                          {item.descricao ? (
                            <View className="flex-row items-center gap-1 mt-1">
                              <Text
                                className="text-[11.5px] font-bold text-zinc-400 flex-1 min-w-0"
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {item.descricao}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      {/* Lado Direito: Botões de Ação */}
                      {!isFechado && (
                        <View className="flex-row items-center gap-2 ml-3 flex-shrink-0">
                          <Pressable
                            onPress={() => handleIniciarEdicao(item)}
                            className="h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 active:bg-zinc-800"
                            hitSlop={8}
                          >
                            <Edit3 size={15} color="#a1a1aa" />
                          </Pressable>

                          <Pressable
                            onPress={() => {
                              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              onExcluir(item.id);
                            }}
                            className="h-10 w-10 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 active:bg-red-500/30"
                            hitSlop={8}
                          >
                            <Trash2 size={15} color="#f87171" />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const ConvenioScreen = React.memo(ConvenioScreenComponent);
