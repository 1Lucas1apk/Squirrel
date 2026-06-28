import { useState } from "react";
import { Text, View, ScrollView } from "react-native";
import { 
  SlidersHorizontal, 
  ArrowUpRight, 
  RefreshCcw, 
  Banknote, 
  Smartphone,
  Info,
  AlertCircle,
  ArrowRight,
  Gavel,
  CheckCircle2,
  TrendingDown,
  Pin,
  Edit3,
  X
} from "lucide-react-native";
import { MoneyInput } from "../components/common/money-input";
import { PainelPrincipal } from "../components/dashboard/painel-principal";
import { TotaisTurno, LembreteFantasma, Transacao, LogAlteracao } from "../types/domain";
import { toBrl } from "../utils/currency";
import { useMemo } from "react";
import { Pressable, TextInput, Modal } from "react-native";

interface PainelScreenProps {
  totais: TotaisTurno;
  fantasmas: LembreteFantasma[];
  transacoes: Transacao[];
  logs?: LogAlteracao[];
  notaDia?: string;
  onSaveNota?: (texto: string) => void;
  ajusteManualSobra: number;
  onAjusteSobra: (value: number) => void;
  isFechado?: boolean;
  isDiscreto?: boolean;
}

export function PainelScreen({
  totais,
  fantasmas = [],
  transacoes = [],
  logs = [],
  notaDia = "",
  onSaveNota,
  ajusteManualSobra,
  onAjusteSobra,
  isFechado,
  isDiscreto
}: PainelScreenProps) {
  const [modalNota, setModalNota] = useState(false);
  const [textoNota, setTextoNota] = useState(notaDia);
  
  // Filtramos apenas o que justifica os números atuais do painel
  const listaFantasmas = Array.isArray(fantasmas) ? fantasmas : [];
  const pendencias = listaFantasmas.filter(f => !f.resolvido);
  const pixRecebido = pendencias.filter(f => f.tipo === 'pix_recebido_gaveta_saiu');
  const destrocas = pendencias.filter(f => f.tipo === 'destroca_pix_por_nota');
  const emprestimos = pendencias.filter(f => f.tipo === 'dinheiro_emprestado');

  // Auditoria de erros e edições
  const transacoesComErro = useMemo(() => {
    return (transacoes || []).filter(t => t.statusConferencia === "incorreto");
  }, [transacoes]);

  const totalTerceiros = useMemo(() => {
    return emprestimos.reduce((acc, i) => acc + i.valorReferencia, 0);
  }, [emprestimos]);

  return (
    <View className="gap-8 pb-32">
      {/* MODAL DE EDIÇÃO DA NOTA */}
      <Modal visible={modalNota} transparent animationType="fade">
        <View className="flex-1 bg-black/90 items-center justify-center p-6">
          <View className="w-full max-w-[380px] bg-ink-900 border border-zinc-800 rounded-[40px] p-8 shadow-2xl">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-lg font-black text-white uppercase">Aviso do Dia</Text>
              <Pressable onPress={() => setModalNota(false)}><X size={20} color="#71717a" /></Pressable>
            </View>
            <TextInput
              multiline
              numberOfLines={4}
              value={textoNota}
              onChangeText={setTextoNota}
              placeholder="Ex: Fulano vem buscar o troco às 16h..."
              placeholderTextColor="#3f3f46"
              className="bg-ink-800 p-6 rounded-3xl text-zinc-100 font-bold mb-8 border border-zinc-800 text-left align-top"
            />
            <Pressable 
              onPress={() => {
                onSaveNota?.(textoNota.trim());
                setModalNota(false);
              }} 
              className="bg-zinc-100 py-5 rounded-2xl shadow-xl"
            >
              <Text className="text-center font-black uppercase text-zinc-950">Fixar no Painel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ALERTA DE EXCESSO DE ESPÉCIE */}
      {totais.gavetaFisico > 10000 && (
        <View className="bg-orange-500/10 border border-orange-500/20 p-5 rounded-3xl flex-row gap-3 items-center">
          <AlertCircle size={24} color="#f97316" />
          <View className="flex-1">
            <Text className="text-[10px] font-black uppercase text-orange-400 tracking-widest mb-1">
              Alto Volume de Dinheiro
            </Text>
            <Text className="text-orange-500/80 text-xs font-bold leading-4">
              A gaveta possui mais de R$ 10.000,00 em espécie. Fique atento ao limite de segurança.
            </Text>
          </View>
        </View>
      )}

      {/* 1. RESUMO DOS TOTAIS (MATEMÁTICA ALGORÍTMICA) */}
      <PainelPrincipal 
        totais={totais} 
        pendenciasFantasma={pendencias.length} 
        valorTerceiros={totalTerceiros}
        isDiscreto={isDiscreto} 
      />

      {/* 2. AJUSTE DE SOBRA */}
      {!isDiscreto && (
        <View className={`rounded-[40px] border p-6 shadow-2xl ${isFechado ? 'border-zinc-900 bg-zinc-900/30' : 'border-zinc-800 bg-ink-900'}`}>
          <View className="flex-row items-center gap-3 mb-4 ml-1">
            <SlidersHorizontal size={14} color="#71717a" />
            <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500">Ajuste de Quebra</Text>
          </View>
          <MoneyInput
            editable={!isFechado}
            className={`rounded-[24px] border px-6 py-5 text-3xl font-black shadow-inner ${isFechado ? 'border-zinc-800 bg-zinc-900 text-zinc-600' : 'border-zinc-700 bg-ink-800 text-zinc-100'}`}
            value={ajusteManualSobra}
            onChangeValue={onAjusteSobra}
          />
        </View>
      )}

      {/* NOVO: LISTA DE AUDITORIA (ERROS) - Só aparece se estiver fechado e não for discreto */}
      {isFechado && !isDiscreto && transacoesComErro.length > 0 && (
        <View className="rounded-[40px] border border-red-500/20 bg-red-500/5 p-8">
          <View className="flex-row items-center gap-3 mb-6">
            <AlertCircle size={18} color="#f87171" />
            <Text className="text-xl font-black text-white uppercase tracking-widest">Auditoria de Erros</Text>
          </View>
          <Text className="text-[10px] font-black text-zinc-500 uppercase mb-4 leading-4">
            Lançamentos que tiveram diferença de valor neste dia:
          </Text>
          <View className="gap-3">
             {transacoesComErro.map(t => (
               <View key={t.id} className="bg-ink-900/50 border border-red-900/20 p-4 rounded-2xl">
                 <View className="flex-row justify-between items-center mb-1">
                   <Text className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{t.descricao || 'Sem descrição'}</Text>
                   <Text className="text-[9px] font-black text-red-400">-{toBrl(Math.abs(t.valorSistema - t.valorRecebidoFisico))}</Text>
                 </View>
                 <Text className="text-xs font-black text-zinc-100 uppercase tracking-tighter">Sist: {toBrl(t.valorSistema)} → Real: {toBrl(t.valorRecebidoFisico)}</Text>
                 {t.justificativaTexto && (
                   <Text className="text-[9px] text-zinc-600 font-bold uppercase mt-2 italic">"{t.justificativaTexto}"</Text>
                 )}
               </View>
             ))}
          </View>
        </View>
      )}

      {/* 4. INFORMATIVO DE MOVIMENTAÇÃO (O "PORQUÊ" DOS NÚMEROS) */}
      {!isDiscreto && (
        <View className="rounded-[40px] border border-zinc-800 bg-ink-950 p-8">
        <View className="flex-row items-center gap-3 mb-8">
          <Info size={18} color="#a78bfa" />
          <Text className="text-xl font-black text-white uppercase tracking-widest">Resumo de Movimentação</Text>
        </View>

        <View className="gap-6">
          {/* NOVO: RESUMO DE SAÍDAS DO DIA */}
          <View className="bg-red-500/5 rounded-3xl p-5 border border-red-500/20">
            <View className="flex-row items-center gap-3 mb-3">
              <ArrowUpRight size={16} color="#f87171" />
              <Text className="text-[10px] font-black text-red-400 uppercase tracking-widest">Saídas da Gaveta</Text>
            </View>
            <Text className="text-zinc-500 text-xs leading-5">
              Hoje já foram retirados <Text className="text-red-400 font-bold">{toBrl(transacoes.filter(t => t.categoria === 'sangria' || t.categoria === 'cancelamento').reduce((acc, t) => acc + t.valorSistema, 0))}</Text> do seu caixa entre pagamentos de contas, vales ou cancelamentos. Esse valor já foi abatido do seu saldo final.
            </Text>
          </View>

          {/* JUSTIFICATIVA DO PIX NO CELULAR */}
          <View className="bg-ink-900 rounded-3xl p-5 border border-zinc-800">
            <View className="flex-row items-center gap-3 mb-3">
              <Smartphone size={16} color="#a78bfa" />
              <Text className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Saldo no seu Celular</Text>
            </View>
            <Text className="text-zinc-500 text-xs leading-5">
              Você possui <Text className="text-purple-400 font-bold">{toBrl(totais.pixNoCaixa)}</Text> guardados no seu Pix pessoal. Este valor entrou por trocas informais e <Text className="text-white font-bold underline">NÃO DEVE</Text> ser colocado no saco físico de dinheiro.
            </Text>
            
            {pixRecebido.filter(f => f.destinoPix === 'Meu Pix' || f.destinoPix === 'Operador' || !f.destinoPix).length > 0 && (
              <View className="mt-4 pt-4 border-t border-zinc-800 gap-2">
                {pixRecebido.filter(f => f.destinoPix === 'Meu Pix' || f.destinoPix === 'Operador' || !f.destinoPix).map(f => (
                  <View key={f.id} className="flex-row justify-between items-center">
                    <Text className="text-[10px] font-bold text-zinc-600 uppercase">{f.pessoa}</Text>
                    <Text className="text-[10px] font-black text-purple-400">+{toBrl(f.valorReferencia)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* JUSTIFICATIVA DO PIX DIRETO PARA A LOJA */}
          {totais.pixDiretoLoja > 0 && (
            <View className="bg-blue-500/5 rounded-3xl p-5 border border-blue-500/20">
              <View className="flex-row items-center gap-3 mb-3">
                <Banknote size={16} color="#60a5fa" />
                <Text className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Pix Direto p/ Loja</Text>
              </View>
              <Text className="text-blue-500/60 text-xs font-bold leading-5">
                Já foi enviado <Text className="text-blue-400">{toBrl(totais.pixDiretoLoja)}</Text> diretamente para a conta da Loja/Gerente. O sistema já abateu esse valor do seu malote final.
              </Text>
            </View>
          )}

          {/* JUSTIFICATIVA DO DINHEIRO FÍSICO (EMPRÉSTIMOS) */}
          <View className="bg-ink-900 rounded-3xl p-5 border border-zinc-800">
            <View className="flex-row items-center gap-3 mb-3">
              <Banknote size={16} color="#fb923c" />
              <Text className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Dinheiro de Terceiros</Text>
            </View>
            <Text className="text-zinc-500 text-xs leading-5">
              Há <Text className="text-orange-400 font-bold">{toBrl(emprestimos.reduce((acc, i) => acc + i.valorReferencia, 0))}</Text> na gaveta que pertencem a outras pessoas (Empréstimos/Trocos). Este valor será devolvido e não pertence à loja.
            </Text>
            
            {emprestimos.map(f => (
              <View key={f.id} className="mt-3 flex-row items-center gap-2">
                <ArrowRight size={10} color="#71717a" />
                <Text className="text-[10px] font-bold text-orange-400 uppercase">{f.pessoa}: {toBrl(f.valorReferencia)}</Text>
              </View>
            ))}
          </View>

          {/* ALERTAS DE DESTROCA */}
          {destrocas.length > 0 && (
            <View className="bg-emerald-500/5 rounded-3xl p-5 border border-emerald-500/20">
              <View className="flex-row items-center gap-3 mb-3">
                <RefreshCcw size={16} color="#34d399" />
                <Text className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Aviso de Destroca</Text>
              </View>
              <Text className="text-emerald-500/60 text-[10px] font-bold uppercase leading-4">
                Você repôs {toBrl(destrocas.reduce((acc, i) => acc + i.valorReferencia, 0))} em notas para "limpar" seu Pix de repasse.
              </Text>
            </View>
          )}
        </View>

        <View className="mt-8 pt-6 border-t border-zinc-900 items-center mb-6">
          <Text className="text-[9px] font-black text-zinc-700 uppercase tracking-[2px] text-center">
            Resumo detalhado gerado pelo sistema de auditoria.
          </Text>
        </View>
      </View>
      )}

      {/* MURAL DE RECADOS GLOBAL (AVISO DO DIA) */}
      {!isDiscreto && (
        <View className="mt-2 mb-8">
          <Pressable 
            onPress={() => !isFechado && setModalNota(true)}
            className={`rounded-[32px] border p-6 flex-row items-center gap-4 shadow-2xl ${notaDia ? 'bg-amber-500/10 border-amber-500/20' : 'bg-ink-900 border-zinc-800 border-dashed opacity-70'}`}
          >
            <View className={`h-12 w-12 items-center justify-center rounded-2xl ${notaDia ? 'bg-amber-500' : 'bg-zinc-800'}`}>
              <Pin size={20} color={notaDia ? "#451a03" : "#71717a"} strokeWidth={3} />
            </View>
            <View className="flex-1">
              <Text className={`text-[9px] font-black uppercase tracking-widest ${notaDia ? 'text-amber-500' : 'text-zinc-600'}`}>Mural Global do Turno</Text>
              <Text className={`text-xs font-bold leading-5 mt-1 ${notaDia ? 'text-zinc-100' : 'text-zinc-500'}`} numberOfLines={3}>
                {notaDia || "Nenhum recado. Toque para adicionar uma mensagem para todos."}
              </Text>
            </View>
            {!isFechado && <Edit3 size={16} color={notaDia ? "#fbbf24" : "#71717a"} />}
          </Pressable>
        </View>
      )}
    </View>
  );
}
