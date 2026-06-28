import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { Plus, Trash2, Building2 } from 'lucide-react-native';
import { RegistroConvenio } from '../types/domain';
import { toBrl } from '../utils/currency';
import { MoneyInput } from '../components/common/money-input';
import * as Haptics from 'expo-haptics';

interface ConvenioScreenProps {
  registros: RegistroConvenio[];
  onAdicionar: (input: any) => void;
  onExcluir: (id: string) => void;
  isFechado: boolean;
}

export function ConvenioScreen({
  registros,
  onAdicionar,
  onExcluir,
  isFechado
}: ConvenioScreenProps) {
  const [nome, setNome] = useState('');
  const [desc, setDesc] = useState('');
  const [valorRegistro, setValorRegistro] = useState(0);

  const addRegistro = () => {
    if (valorRegistro <= 0 || !nome.trim()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdicionar({
      nome: nome.trim(),
      descricao: desc.trim() || undefined,
      valor: valorRegistro
    });
    setNome('');
    setDesc('');
    setValorRegistro(0);
  };

  const totalConvenio = registros.reduce((acc, r) => acc + r.valor, 0);

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {/* HEADER DE TOTAL */}
      <View className="bg-ink-900 border border-zinc-800 rounded-3xl p-6 mb-6 items-center">
        <View className="flex-row items-center gap-3 mb-2">
          <Building2 size={20} color="#c084fc" />
          <Text className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Total em Convênios</Text>
        </View>
        <Text className="text-4xl font-black text-white">{toBrl(totalConvenio)}</Text>
      </View>

      {/* ADICIONAR REGISTROS */}
      {!isFechado && (
        <View className="bg-ink-900 border border-zinc-800 rounded-3xl p-6 mb-6">
          <Text className="text-zinc-100 font-black uppercase tracking-widest mb-4">Lançar Convênio</Text>
          
          <View className="gap-3 mb-4">
            <TextInput 
              value={nome} 
              onChangeText={setNome} 
              placeholder="Nome da Financeira (ex: UME)" 
              placeholderTextColor="#52525b"
              className="w-full bg-ink-800 border border-zinc-800 rounded-xl p-4 text-white font-bold"
            />
            <View className="flex-row gap-3">
              <TextInput 
                value={desc} 
                onChangeText={setDesc} 
                placeholder="Detalhes (opcional)" 
                placeholderTextColor="#52525b"
                className="flex-[1.5] bg-ink-800 border border-zinc-800 rounded-xl p-4 text-white font-bold text-xs"
              />
              <View className="flex-[1.2]">
                <MoneyInput 
                  value={valorRegistro} 
                  onChangeValue={setValorRegistro}
                  className="w-full bg-ink-800 border border-zinc-800 rounded-xl p-4 text-white font-black text-center"
                />
              </View>
            </View>
          </View>

          <Pressable onPress={addRegistro} disabled={valorRegistro <= 0 || !nome.trim()} className={`py-4 rounded-xl items-center ${valorRegistro > 0 && nome.trim() ? 'bg-zinc-100' : 'bg-zinc-800 opacity-50'}`}>
            <Text className="text-zinc-950 font-black uppercase text-xs">Registrar Venda</Text>
          </Pressable>
        </View>
      )}

      {/* LISTA DE REGISTROS */}
      <View className="mb-24 gap-3">
        {registros.length === 0 ? (
          <Text className="text-zinc-600 font-bold text-center text-[10px] tracking-[2px] uppercase my-6">Nenhum convênio registrado</Text>
        ) : (
          registros.map(r => (
            <View key={r.id} className="flex-row items-center justify-between bg-ink-900 border border-zinc-800 p-4 rounded-2xl">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                  <Building2 size={18} color="#c084fc" />
                </View>
                <View>
                  <Text className="text-zinc-100 font-black uppercase text-xs">{r.nome}</Text>
                  {r.descricao && <Text className="text-zinc-500 font-bold text-[10px] uppercase">{r.descricao}</Text>}
                </View>
              </View>
              <View className="flex-row items-center gap-4">
                <Text className="text-white font-black">{toBrl(r.valor)}</Text>
                {!isFechado && (
                  <Pressable onPress={() => onExcluir(r.id)} hitSlop={10} className="h-8 w-8 items-center justify-center bg-red-500/10 rounded-lg">
                    <Trash2 size={14} color="#f87171" />
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
