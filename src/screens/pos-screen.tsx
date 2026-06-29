import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { Plus, Trash2, CreditCard, Flame } from 'lucide-react-native';
import { Turno, RegistroPOS, TipoPOS } from '../types/domain';
import { toBrl } from '../utils/currency';
import { MoneyInput } from '../components/common/money-input';
import * as Haptics from 'expo-haptics';
import { FechamentoPOS } from '../services/repositories/loja-repository';

interface POSScreenProps {
  turno: Turno;
  fechamentosLoja?: FechamentoPOS[];
  somaOutrosTurnos: number;
  registros: RegistroPOS[];
  onAdicionar: (input: any) => void;
  onExcluir: (id: string) => void;
  onSalvarRelatorio: (v: number) => void;
  isFechado: boolean;
  gasDoPovoValorPadrao: number;
}

export function POSScreen({
  turno,
  fechamentosLoja = [],
  somaOutrosTurnos,
  registros,
  onAdicionar,
  onExcluir,
  onSalvarRelatorio,
  isFechado,
  gasDoPovoValorPadrao
}: POSScreenProps) {
  const [valorFinal, setValorFinal] = useState(turno.posRelatorioTotal || 0);
  const [showInput, setShowInput] = useState(false);

  // O desconto já foi feito em calculos.ts via posSomaOutrosTurnos.
  // Aqui só mostramos o resultado: posRelatorioTotal - somaOutrosTurnos
  const meuRelatorioCalculado = Math.max(0, (turno.posRelatorioTotal || 0) - somaOutrosTurnos);

  const [desc, setDesc] = useState('');
  const [valorRegistro, setValorRegistro] = useState(0);

  const handleSalvarTotal = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSalvarRelatorio(valorFinal);
    setShowInput(false);
  };

  const addGasDoPovo = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdicionar({
      tipo: 'gas_do_povo',
      descricao: 'Gás do Povo',
      valor: gasDoPovoValorPadrao
    });
  };

  const addRegistro = (tipo: TipoPOS) => {
    if (valorRegistro <= 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    let defaultDesc = 'Cartão';
    if (tipo === 'gas_do_povo') defaultDesc = 'Gás do Povo';
    if (tipo === 'pix_loja') defaultDesc = 'Pix na POS';

    onAdicionar({
      tipo,
      descricao: desc.trim() || defaultDesc,
      valor: valorRegistro
    });
    setDesc("");
    setValorRegistro(0);
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {/* CARD DO RELATÓRIO POS */}
      <View className="rounded-[32px] border border-zinc-800 bg-ink-900 p-6 mb-6">
        <View className="flex-row items-center gap-3 mb-4">
          <CreditCard size={24} color="#60a5fa" />
          <Text className="text-zinc-100 font-black uppercase tracking-widest">Maquininha POS</Text>
        </View>

        {!showInput ? (
          <View>
            <Text className="text-zinc-500 font-bold uppercase text-[10px] mb-1">Meu Fechamento</Text>
            <Text className="text-3xl font-black text-white mb-4">{toBrl(meuRelatorioCalculado)}</Text>
            
            {fechamentosLoja.length > 0 && (
              <View className="bg-zinc-800/30 p-5 rounded-[24px] mb-4 border border-zinc-800/80">
                <Text className="text-zinc-400 font-black text-[11px] uppercase mb-4 text-center tracking-widest">Outros Caixas Hoje</Text>
                
                <View className="pl-3 border-l-2 border-amber-500/50 my-2 gap-3 mb-4">
                  {fechamentosLoja.map(f => {
                    const time = new Date(f.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <Text key={f.id} className="text-zinc-300 font-bold text-xs leading-5">
                        <Text className="text-amber-400 font-black">{f.operador}</Text> fechou o caixa às {time} com POS de <Text className="text-white font-black">{toBrl(f.valorTotal)}</Text>
                      </Text>
                    );
                  })}
                </View>
                
                <Text className="text-zinc-400 font-bold text-xs leading-5 mb-2">
                  Total da maquininha: <Text className="text-white font-black">{toBrl(turno.posRelatorioTotal || 0)}</Text>
                </Text>
                <Text className="text-zinc-400 font-bold text-xs leading-5 mb-3">
                  Descontando {fechamentosLoja.length === 1 ? `o caixa de ${fechamentosLoja[0].operador}` : 'os outros caixas'}: <Text className="text-red-400 font-black">-{toBrl(somaOutrosTurnos)}</Text>
                </Text>
                
                <View className="bg-emerald-500/10 p-4 rounded-[20px] border border-emerald-500/20">
                  <Text className="text-emerald-400 font-bold text-[13px] leading-5 text-center">
                    Seu valor real de POS:{"\n"}
                    <Text className="text-emerald-300 font-black text-lg">{toBrl(meuRelatorioCalculado)}</Text>
                  </Text>
                </View>
              </View>
            )}
            
            {!isFechado && (
              <Pressable 
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowInput(true);
                }}
                className="bg-zinc-800/80 py-4 rounded-[24px] items-center mt-2 border border-zinc-700/50"
              >
                <Text className="text-zinc-300 font-black uppercase text-xs tracking-widest">Alterar Relatório Final</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View>
            <Text className="text-zinc-500 font-bold uppercase text-[10px] mb-2">Digite o valor final da maquininha</Text>
            <MoneyInput 
              value={valorFinal} 
              onChangeValue={setValorFinal}
              className="bg-ink-800 border border-zinc-800 rounded-[24px] p-4 text-white font-black text-2xl text-center mb-4" 
            />
            <View className="flex-row gap-2">
              <Pressable onPress={() => setShowInput(false)} className="bg-zinc-800 p-4 rounded-[24px] items-center flex-1">
                <Text className="text-zinc-300 font-black uppercase tracking-widest text-[11px]">Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleSalvarTotal} className="bg-blue-600 p-4 rounded-[24px] items-center flex-1">
                <Text className="text-white font-black uppercase tracking-widest text-[11px]">Salvar Total</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* ADICIONAR REGISTROS MANUAIS */}
      {!isFechado && (
        <View className="bg-ink-900 border border-zinc-800 rounded-[32px] p-6 mb-6">
          <Text className="text-zinc-100 font-black uppercase tracking-widest mb-4">Lançamentos Isolados</Text>
          
          <Pressable onPress={addGasDoPovo} className="flex-row items-center justify-between bg-orange-500/10 border border-orange-500/30 p-4 rounded-[24px] mb-6">
            <View className="flex-row items-center gap-3">
              <View className="bg-orange-500/20 p-2 rounded-xl">
                <Flame size={20} color="#f97316" />
              </View>
              <View>
                <Text className="text-orange-400 font-black uppercase text-xs">Gás do Povo</Text>
                <Text className="text-orange-500/70 font-bold text-[10px] uppercase">Lançamento Rápido</Text>
              </View>
            </View>
            <Text className="text-orange-400 font-black">{toBrl(gasDoPovoValorPadrao)}</Text>
          </Pressable>

          <View className="flex-row gap-2 mb-4">
            <TextInput 
              value={desc} 
              onChangeText={setDesc} 
              placeholder="Descrição (Opcional)" 
              placeholderTextColor="#52525b"
              className="flex-[1.5] bg-ink-800 border border-zinc-800 rounded-[24px] p-4 text-white font-bold"
            />
            <View className="flex-[1.2]">
              <MoneyInput 
                value={valorRegistro} 
                onChangeValue={setValorRegistro}
                className="bg-ink-800 border border-zinc-800 rounded-[24px] p-4 text-white font-black text-center"
              />
            </View>
          </View>
          
          <View className="flex-row gap-2">
            <Pressable onPress={() => addRegistro('cartao')} className="bg-zinc-800/80 p-4 rounded-[24px] items-center flex-1 border border-zinc-700/50">
              <Text className="text-blue-400 font-black text-[11px] uppercase tracking-widest">Cartão</Text>
            </Pressable>
            <Pressable onPress={addGasDoPovo} className="bg-orange-900/20 p-4 rounded-[24px] items-center flex-1 border border-orange-500/20">
              <Text className="text-orange-400 font-black text-[11px] uppercase tracking-widest">Gás</Text>
            </Pressable>
            <Pressable onPress={() => addRegistro('pix_loja')} className="bg-emerald-900/20 p-4 rounded-[24px] items-center flex-1 border border-emerald-500/20">
              <Text className="text-emerald-400 font-black text-[11px] uppercase tracking-widest">Pix</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* LISTA DE REGISTROS */}
      <View className="mb-24 gap-3">
        {registros.length === 0 ? (
          <Text className="text-zinc-600 font-bold text-center text-[10px] tracking-[2px] uppercase my-6">Nenhum lançamento avulso</Text>
        ) : (
          registros.map(r => (
            <View key={r.id} className="flex-row items-center justify-between bg-ink-900 border border-zinc-800 p-4 rounded-2xl">
              <View className="flex-row items-center gap-3">
                <View className={`h-10 w-10 items-center justify-center rounded-xl ${r.tipo === 'gas_do_povo' ? 'bg-orange-500/10' : 'bg-blue-500/10'}`}>
                  {r.tipo === 'gas_do_povo' ? <Flame size={18} color="#f97316" /> : <CreditCard size={18} color="#60a5fa" />}
                </View>
                <View>
                  <Text className="text-zinc-100 font-black uppercase text-xs">{r.descricao}</Text>
                  <Text className="text-zinc-500 font-bold text-[10px] uppercase">{r.tipo === 'gas_do_povo' ? 'Gás do Povo' : 'Cartão'}</Text>
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
