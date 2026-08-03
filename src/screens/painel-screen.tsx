import { useState, useEffect, useMemo } from "react";
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
  X,
  History,
  PlusCircle,
  Activity,
  Ghost,
  AlertTriangle,
  Trash2,
  Link
} from "lucide-react-native";
import { MoneyInput } from "../components/common/money-input";
import { PainelPrincipal } from "../components/dashboard/painel-principal";
import { TotaisTurno, LembreteFantasma, Transacao, LogAlteracao } from "../types/domain";
import { toBrl } from "../utils/currency";
import { Pressable, TextInput, Modal, FlatList, ActivityIndicator } from "react-native";

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
  onOpenChat?: () => void;
  ultimaMensagemGlobal?: string;
  onVincularRegistros?: (transacaoId: string, fantasmaId: string) => Promise<void>;
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
  isDiscreto,
  onOpenChat,
  ultimaMensagemGlobal,
  onVincularRegistros
}: PainelScreenProps) {
  const [modalNota, setModalNota] = useState(false);
  const [textoNota, setTextoNota] = useState(notaDia);
  const [tapCount, setTapCount] = useState(0);
  const [showFullAudit, setShowFullAudit] = useState(false);
  const [vinculosAtivos, setVinculosAtivos] = useState<Record<string, 'loading' | 'success'>>({});

  useEffect(() => {
    if (tapCount > 0) {
      const timer = setTimeout(() => setTapCount(0), 1000);
      return () => clearTimeout(timer);
    }
  }, [tapCount]);

  const handleAuditTap = () => {
    setTapCount(prev => {
      if (prev + 1 >= 3) {
        setShowFullAudit(true);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleSimularVinculo = async (act: any) => {
    setVinculosAtivos(prev => ({ ...prev, [act.id]: 'loading' }));
    
    try {
      if (onVincularRegistros && act.suggestedLinkId) {
        const transacaoId = act.type === 'new' ? act.dbId : act.suggestedLinkId;
        const fantasmaId = act.type === 'ghost' ? act.dbId : act.suggestedLinkId;
        await onVincularRegistros(transacaoId, fantasmaId);
      }
      setVinculosAtivos(prev => ({ ...prev, [act.id]: 'success' }));
    } catch (e) {
      // Revert loading on error
      setVinculosAtivos(prev => {
        const next = { ...prev };
        delete next[act.id];
        return next;
      });
    }
  };
  
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

  const feedActivities = useMemo(() => {
    const activities: any[] = [];
    
    (transacoes || []).forEach(t => {
      activities.push({
        id: `t_${t.id}`,
        dbId: t.id,
        type: 'new',
        raw: t,
        title: 'Novo Lançamento',
        subtitle: `${toBrl(t.valorSistema)} - ${t.categoria === 'sangria' ? 'Sangria' : t.categoria === 'cancelamento' ? 'Cancelamento' : 'Movimento'}`,
        timestamp: t.timestamp,
        valorToCompare: t.valorSistema
      });
    });

    (fantasmas || []).forEach(f => {
      activities.push({
        id: `f_${f.id}`,
        dbId: f.id,
        type: 'ghost',
        raw: f,
        title: 'Pendência Adicionada',
        subtitle: `${f.pessoa} - ${toBrl(f.valorReferencia)}`,
        timestamp: f.timestamp,
        valorToCompare: f.valorReferencia
      });
    });

    (logs || []).forEach(l => {
      if (l.campoAlterado === 'valor' || l.campoAlterado === 'valor_sistema') {
        activities.push({
          id: `l_${l.id}`,
          type: 'edit',
          raw: l,
          title: `R$ ${l.valorAntigo} → R$ ${l.valorNovo}`,
          subtitle: 'Valor Editado',
          timestamp: l.timestamp,
          valorToCompare: 0
        });
      } else if (l.campoAlterado === 'statusConferencia' || l.campoAlterado === 'status_conferencia') {
        const strVal = l.valorNovo as unknown as string;
        const isIncorreto = strVal === 'incorreto' || strVal === 'erro';
        activities.push({
          id: `l_${l.id}`,
          type: isIncorreto ? 'error' : 'check',
          raw: l,
          title: `Status: ${isIncorreto ? 'Incorreto' : 'Confirmado'}`,
          subtitle: 'Auditoria de Item',
          timestamp: l.timestamp,
          valorToCompare: 0
        });
      } else if (l.campoAlterado === 'exclusao') {
        activities.push({
          id: `l_${l.id}`,
          type: 'delete',
          raw: l,
          title: `Item Excluído`,
          subtitle: `Lançamento Removido`,
          timestamp: l.timestamp,
          valorToCompare: 0
        });
      } else {
        activities.push({
          id: `l_${l.id}`,
          type: 'edit',
          raw: l,
          title: `Edição (${l.campoAlterado})`,
          subtitle: `Informação atualizada`,
          timestamp: l.timestamp,
          valorToCompare: 0
        });
      }
    });

    // Calcula saldo corrente
    const sortedForTotal = [...activities].sort((a, b) => a.timestamp - b.timestamp);
    let runningTotal = 0;
    sortedForTotal.forEach(act => {
      act.saldoAnterior = runningTotal;
      if (act.type === 'new') {
        if (act.raw.categoria === 'sangria' || act.raw.categoria === 'cancelamento') {
          runningTotal -= act.valorToCompare;
        } else {
          runningTotal += act.valorToCompare;
        }
      } else if (act.type === 'ghost') {
        // Se for destroca ou pix, podemos adicionar logica especifica, mas simplificaremos pro extrato:
        if (act.raw.tipo === 'pix_recebido_gaveta_saiu' || act.raw.tipo === 'dinheiro_emprestado') {
          runningTotal -= act.valorToCompare;
        } else if (act.raw.tipo === 'destroca_pix_por_nota') {
          runningTotal += act.valorToCompare;
        }
      }
      act.saldoAtual = runningTotal;
    });

    // Ordena final decrescente
    const sorted = sortedForTotal.sort((a, b) => b.timestamp - a.timestamp);

    // Identifica sugestoes de vinculo
    for (let i = 0; i < sorted.length; i++) {
      const act = sorted[i];
      if ((act.type === 'new' || act.type === 'ghost') && !act.raw.transacaoVinculadaId) {
        const nearby = sorted.find(other => 
          other !== act &&
          (other.type === 'new' || other.type === 'ghost') && 
          other.type !== act.type &&
          !other.raw.transacaoVinculadaId &&
          other.valorToCompare === act.valorToCompare &&
          Math.abs(other.timestamp - act.timestamp) <= 15 * 60 * 1000 // 15 minutos
        );
        if (nearby) {
          act.suggestedLinkId = nearby.dbId;
          act.suggestedLinkType = nearby.type;
        }
      }
    }

    return sorted;
  }, [transacoes, fantasmas, logs]);

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

      {/* PAINEL PRINCIPAL (SISTEMA, GAVETA E GABARITO) */}
      <PainelPrincipal 
        totais={totais} 
        pendenciasFantasma={pendencias.length}
        valorTerceiros={totalTerceiros}
        isDiscreto={isDiscreto}
        onOpenChat={onOpenChat}
        ultimaMensagemGlobal={ultimaMensagemGlobal}
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

      {/* MODAL AUDITORIA SECRETA */}
      <Modal visible={showFullAudit} transparent animationType="slide">
        <View className="flex-1 bg-ink-950 px-4 pt-12 pb-6">
          <View className="flex-row items-center justify-between mb-8 px-2">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 items-center justify-center">
                <Activity size={18} color="#a78bfa" />
              </View>
              <View>
                <Text className="text-xl font-black text-white uppercase tracking-widest">Auditoria Geral</Text>
                <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{feedActivities.length} registros encontrados</Text>
              </View>
            </View>
            <Pressable onPress={() => setShowFullAudit(false)} className="h-12 w-12 items-center justify-center rounded-full bg-ink-900 border border-zinc-800">
              <X size={20} color="#71717a" />
            </Pressable>
          </View>

          <FlatList
            data={feedActivities}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 16, paddingBottom: 40 }}
            renderItem={({ item: act }) => {
              const dateObj = new Date(act.timestamp);
              const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
              
              let IconComp = PlusCircle;
              let iconColor = "#34d399";
              let bgClass = "bg-emerald-500/10 border-emerald-500/20";
              
              if (act.type === 'edit') {
                IconComp = Edit3; iconColor = "#60a5fa"; bgClass = "bg-blue-500/10 border-blue-500/20";
              } else if (act.type === 'ghost') {
                IconComp = Ghost; iconColor = "#facc15"; bgClass = "bg-amber-500/10 border-amber-500/20";
              } else if (act.type === 'check') {
                IconComp = CheckCircle2; iconColor = "#34d399"; bgClass = "bg-emerald-500/10 border-emerald-500/20";
              } else if (act.type === 'error') {
                IconComp = AlertTriangle; iconColor = "#f87171"; bgClass = "bg-red-500/10 border-red-500/20";
              } else if (act.type === 'delete') {
                IconComp = Trash2; iconColor = "#f87171"; bgClass = "bg-red-500/10 border-red-500/20";
              }
              
              const isTransacao = act.id.startsWith('t_');
              const isFantasma = act.id.startsWith('f_');
              const isLog = act.id.startsWith('l_');
              
              return (
                <View className="bg-ink-900 border border-zinc-800 p-1 mb-4 rounded-[32px] shadow-2xl">
                  {/* HEADER MINIMALISTA */}
                  <View className="flex-row items-center justify-between p-4 px-5">
                    <View className="flex-row items-center gap-3">
                      <View className={`h-10 w-10 rounded-2xl items-center justify-center border ${bgClass}`}>
                        <IconComp size={16} color={iconColor} />
                      </View>
                      <View>
                        <Text className="text-[9px] font-black uppercase text-zinc-500 tracking-[2px]">{timeStr} • {isTransacao ? 'Transação' : isFantasma ? 'Pendência' : 'Auditoria'}</Text>
                        <Text className="text-sm font-black uppercase text-zinc-100">{act.title}</Text>
                      </View>
                    </View>
                    {isTransacao && act.raw.metodoPagamento && (
                      <View className="bg-zinc-800/80 px-3 py-1.5 rounded-full border border-zinc-700">
                        <Text className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">{act.raw.metodoPagamento}</Text>
                      </View>
                    )}
                  </View>

                  {/* BODY COM DETALHES DE ALTA FIDELIDADE */}
                  <View className="bg-ink-950 rounded-[28px] p-5 border border-zinc-900/50">
                    
                    {/* EXTRATO (SALDO ANTERIOR E ATUAL) */}
                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-zinc-800/50">
                       <View>
                         <Text className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Anterior</Text>
                         <Text className="text-xs font-bold text-zinc-400">{toBrl(act.saldoAnterior)}</Text>
                       </View>
                       <ArrowRight size={12} color="#3f3f46" />
                       <View className="items-end">
                         <Text className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Atualizado</Text>
                         <Text className="text-xs font-black text-zinc-100">{toBrl(act.saldoAtual)}</Text>
                       </View>
                    </View>

                    {isTransacao && (
                      <View className="gap-4">
                        <View className="flex-row justify-between items-center">
                          <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Valor Lançado</Text>
                          <Text className="text-xl font-black text-emerald-400">{toBrl(act.raw.valorSistema)}</Text>
                        </View>
                        
                        {act.raw.valorRecebidoFisico !== undefined && act.raw.valorRecebidoFisico !== act.raw.valorSistema && (
                          <View className="flex-row justify-between items-center bg-red-500/10 px-4 py-3 rounded-2xl border border-red-500/20">
                            <View className="flex-row items-center gap-2">
                              <AlertTriangle size={12} color="#f87171" />
                              <Text className="text-[9px] font-black text-red-400 uppercase tracking-widest">Valor Real (Na Gaveta)</Text>
                            </View>
                            <Text className="text-sm font-black text-red-400">{toBrl(act.raw.valorRecebidoFisico)}</Text>
                          </View>
                        )}
                        
                        <View className="h-px bg-zinc-800/40 w-full" />
                        
                        <View>
                          <Text className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5">Descrição Registrada</Text>
                          <Text className="text-xs font-bold text-zinc-300 uppercase leading-5">{act.raw.descricao || 'Sem descrição'}</Text>
                        </View>
                        {act.raw.transacaoVinculadaId && (() => {
                          const refF = fantasmas?.find(f => f.id === act.raw.transacaoVinculadaId);
                          const refT = transacoes?.find(t => t.id === act.raw.transacaoVinculadaId);
                          const refName = refF ? `PIX/PENDÊNCIA (${refF.pessoa || 'S/N'})` : (refT ? `VENDA (${refT.descricao || 'S/D'})` : 'VINCULADO');
                          return (
                            <View className="mt-2 bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex-row items-center gap-2">
                              <Link size={12} color="#60a5fa" />
                              <Text className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Ref: {refName}</Text>
                            </View>
                          );
                        })()}
                      </View>
                    )}
                    
                    {isFantasma && (
                      <View className="gap-4">
                        <View className="flex-row justify-between items-center">
                          <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Responsável / Origem</Text>
                          <Text className="text-sm font-black text-amber-400 uppercase">{act.raw.pessoa || 'Não informada'}</Text>
                        </View>
                        <View className="flex-row justify-between items-center">
                          <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Valor Pendente</Text>
                          <Text className="text-lg font-black text-zinc-100">{toBrl(act.raw.valorReferencia)}</Text>
                        </View>
                        <View className="h-px bg-zinc-800/40 w-full" />
                        <View>
                          <Text className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5">Detalhes da Pendência</Text>
                          <Text className="text-xs font-bold text-zinc-300 uppercase leading-5">{act.raw.descricao || 'Nenhuma observação extra'}</Text>
                        </View>
                        {act.raw.transacaoVinculadaId && (() => {
                          const refT = transacoes?.find(t => t.id === act.raw.transacaoVinculadaId);
                          const refName = refT ? `VENDA (${refT.descricao || 'S/D'})` : 'VINCULADO';
                          return (
                            <View className="mt-2 bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex-row items-center gap-2">
                              <Link size={12} color="#60a5fa" />
                              <Text className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Ref: {refName}</Text>
                            </View>
                          );
                        })()}
                      </View>
                    )}

                    {isLog && (
                      <View className="gap-4">
                        <View className="flex-row justify-between items-center">
                          <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Campo Editado</Text>
                          <View className="bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
                            <Text className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{act.raw.campoAlterado}</Text>
                          </View>
                        </View>
                        
                        <View className="flex-row items-center gap-3 mt-1">
                          <View className="flex-1 bg-ink-900 p-4 rounded-2xl border border-zinc-800">
                            <Text className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Valor Antigo</Text>
                            <Text className="text-xs font-black text-zinc-400 uppercase" numberOfLines={2}>{String(act.raw.valorAntigo)}</Text>
                          </View>
                          <View className="bg-zinc-800/50 p-1.5 rounded-full">
                            <ArrowRight size={12} color="#a1a1aa" />
                          </View>
                          <View className="flex-1 bg-ink-900 p-4 rounded-2xl border border-zinc-800">
                            <Text className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Novo Valor</Text>
                            <Text className="text-xs font-black text-zinc-100 uppercase" numberOfLines={2}>{String(act.raw.valorNovo)}</Text>
                          </View>
                        </View>
                        
                        {act.raw.motivo && (
                          <View className="mt-2 bg-zinc-800/30 p-3 rounded-xl">
                            <Text className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Motivo / Justificativa</Text>
                            <Text className="text-[10px] font-bold text-zinc-300 uppercase italic">"{act.raw.motivo}"</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* SUGESTÃO DE VÍNCULO INTELIGENTE */}
                    {act.suggestedLinkId && !vinculosAtivos[act.id] && (
                      <View className="mt-6 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl">
                        <View className="flex-row items-center gap-2 mb-2">
                          <Link size={12} color="#818cf8" />
                          <Text className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Sugestão de Vínculo</Text>
                        </View>
                        <Text className="text-xs font-bold text-indigo-300 leading-5 mb-4">
                          O sistema detectou um {act.suggestedLinkType === 'new' ? 'lançamento' : 'fantasma/pendência'} com este MESMO valor e num horário muito próximo. Isso foi apenas uma conversão?
                        </Text>
                        <Pressable 
                          className="bg-indigo-500 py-4 rounded-[16px] items-center shadow-lg"
                          onPress={() => handleSimularVinculo(act)}
                        >
                          <Text className="text-[10px] font-black text-white uppercase tracking-widest">Confirmar e Vincular</Text>
                        </Pressable>
                      </View>
                    )}

                    {vinculosAtivos[act.id] === 'loading' && (
                      <View className="mt-6 bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-2xl items-center justify-center">
                        <ActivityIndicator color="#818cf8" size="small" />
                        <Text className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-3">Sincronizando Banco de Dados...</Text>
                      </View>
                    )}

                    {vinculosAtivos[act.id] === 'success' && (
                      <View className="mt-6 bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl flex-row items-center justify-center gap-3">
                        <CheckCircle2 size={16} color="#34d399" />
                        <Text className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Registros Vinculados com Sucesso!</Text>
                      </View>
                    )}

                  </View>
                </View>
              );
            }}
          />
        </View>
      </Modal>

      {/* FEED DE ATIVIDADES */}
      {!isDiscreto && feedActivities.length > 0 && (
        <View className="rounded-[40px] border border-zinc-800 bg-ink-900 p-6 shadow-2xl">
          <Pressable onPress={handleAuditTap} className="flex-row items-center gap-2 mb-6">
            <History size={14} color="#a78bfa" />
            <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500">
              Feed de Atividades
            </Text>
          </Pressable>
          <View className="gap-3">
            {feedActivities.slice(0, 3).map(act => {
              const dateObj = new Date(act.timestamp);
              const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
              
              let IconComp = PlusCircle;
              let iconColor = "#34d399";
              let bgClass = "bg-emerald-500/10 border-emerald-500/20";
              
              if (act.type === 'edit') {
                IconComp = Edit3; iconColor = "#60a5fa"; bgClass = "bg-blue-500/10 border-blue-500/20";
              } else if (act.type === 'ghost') {
                IconComp = Ghost; iconColor = "#facc15"; bgClass = "bg-amber-500/10 border-amber-500/20";
              } else if (act.type === 'check') {
                IconComp = CheckCircle2; iconColor = "#34d399"; bgClass = "bg-emerald-500/10 border-emerald-500/20";
              } else if (act.type === 'error') {
                IconComp = AlertTriangle; iconColor = "#f87171"; bgClass = "bg-red-500/10 border-red-500/20";
              } else if (act.type === 'delete') {
                IconComp = Trash2; iconColor = "#f87171"; bgClass = "bg-red-500/10 border-red-500/20";
              }
              
              return (
                <View key={act.id} className="flex-row items-center gap-4">
                  <View className={`h-10 w-10 rounded-2xl items-center justify-center border ${bgClass}`}>
                    <IconComp size={14} color={iconColor} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-black uppercase text-zinc-300">{act.title}</Text>
                    <Text className="text-[10px] font-bold uppercase text-zinc-500">{timeStr} • {act.subtitle}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* MURAL DE RECADOS GLOBAL (AVISO DO DIA) */}
      {!isDiscreto && (
        <View className="mt-2 mb-8">
          <Pressable 
            onPress={onOpenChat}
            className="rounded-[32px] border border-blue-500/20 bg-ink-900 p-6 flex-row items-center gap-4 shadow-xl"
            style={{ shadowColor: "#3b82f6", elevation: 15 }}
          >
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10">
              <Pin size={20} color="#3b82f6" strokeWidth={2.5} />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-blue-400 mb-1">Mural Global do Turno</Text>
              <Text className="text-xs font-bold leading-5 text-zinc-300" numberOfLines={2}>
                {ultimaMensagemGlobal || "Nenhum recado. Toque para adicionar uma mensagem para todos."}
              </Text>
            </View>
            <View className="h-8 w-8 items-center justify-center rounded-full bg-ink-800">
              <Edit3 size={14} color="#71717a" />
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}
