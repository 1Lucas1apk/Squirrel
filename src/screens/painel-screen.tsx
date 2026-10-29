import { useState, useEffect, useMemo, memo } from "react";
import { Text, View, ScrollView } from "react-native";
import { 
  SlidersHorizontal, 
  ArrowUpRight, 
  ArrowDownLeft,
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
  Link,
  MessageSquare,
  MessageCircle,
  ChevronRight
} from "lucide-react-native";
import { MoneyInput } from "../components/common/money-input";
import { PainelPrincipal } from "../components/dashboard/painel-principal";
import { PixelSquirrelFooter } from "../components/dashboard/pixel-squirrel-footer";
import { TotaisTurno, LembreteFantasma, Transacao, LogAlteracao } from "../types/domain";
import { toBrl } from "../utils/currency";
import { useAppSettings } from "../hooks/use-app-settings";
import { useChatStore } from "../store/chat-store";
import { getFirebaseAuth } from "../services/firebase/client";
import { formatGoogleDriveThumbnailUrl } from "../services/google-drive-direct-service";
import { AuditModal } from "./audit-modal";
import { Pressable, TextInput, Modal, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from "react-native";

interface PainelScreenProps {
  totais: TotaisTurno;
  fantasmas: LembreteFantasma[];
  transacoes: Transacao[];
  logs?: LogAlteracao[];
  registrosPOS: import("../types/domain").RegistroPOS[];
  registrosConvenio: import("../types/domain").RegistroConvenio[];
  notaDia?: string;
  onSaveNota?: (nota: string) => Promise<void>;
  ajusteManualSobra?: number;
  onAjusteSobra?: (ajuste: number | ((prev: number) => number)) => Promise<void>;
  isFechado?: boolean;
  isDiscreto?: boolean;
  onOpenChat?: () => void;
  ultimaMensagemGlobal?: string;
  ultimoAutorMsg?: {
    text: string;
    senderId: string;
    senderName: string;
    senderUsername?: string;
    senderCargo?: string;
    senderPhotoUrl?: string | null;
  } | null;
  onVincularRegistros?: (fId: string, tId: string) => void;
  onNavigateToChecklist?: () => void;
}

function PainelScreenComponent({
  totais,
  fantasmas = [],
  transacoes = [],
  logs = [],
  registrosPOS = [],
  registrosConvenio = [],
  notaDia = "",
  onSaveNota,
  ajusteManualSobra = 0,
  onAjusteSobra,
  isFechado,
  isDiscreto,
  onOpenChat,
  ultimaMensagemGlobal,
  ultimoAutorMsg,
  onVincularRegistros,
  onNavigateToChecklist
}: PainelScreenProps) {
  const { settings } = useAppSettings();
  const myProfile = useChatStore(s => s.myProfile);
  const authUser = getFirebaseAuth()?.currentUser;
  const myUserId = authUser?.uid || "";
  const fallbackEmailName = authUser?.email ? authUser.email.split("@")[0] : "Operador";
  const isProfileMatch = Boolean(myProfile && (!myProfile.userId || myProfile.userId === myUserId));
  const operatorName = (isProfileMatch ? myProfile?.displayName : null) || authUser?.displayName || fallbackEmailName;
  const myPhotoUrl = (isProfileMatch ? myProfile?.photoUrl : null) || null;
  const myUsername = (isProfileMatch ? myProfile?.username : null) || fallbackEmailName.toLowerCase();
  const contatos = useChatStore(s => s.contatos);
  const presencas = useChatStore(s => s.presencas);
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  const lastAuthorAvatarInfo = useMemo(() => {
    if (!ultimoAutorMsg) {
      return {
        hasPhoto: Boolean(myPhotoUrl),
        photoUrl: myPhotoUrl || null,
        initials: (operatorName || "OP").substring(0, 2).toUpperCase(),
        isMe: true,
        displayName: operatorName
      };
    }

    const sId = (ultimoAutorMsg.senderId || "").toLowerCase();
    const sUser = (ultimoAutorMsg.senderUsername || "").toLowerCase().replace(/^@/, "");
    const isMe = sId === (myUserId || "").toLowerCase() || (sUser && sUser === (myUsername || "").toLowerCase());

    if (isMe) {
      return {
        hasPhoto: Boolean(myPhotoUrl),
        photoUrl: myPhotoUrl || null,
        initials: (operatorName || "OP").substring(0, 2).toUpperCase(),
        isMe: true,
        displayName: operatorName
      };
    }

    // Procura foto do remetente em presenças ou contatos
    const match = presencas.find(p => (p.id && p.id.toLowerCase() === sId) || (sUser && p.username?.toLowerCase().replace(/^@/, "") === sUser))
      || contatos.find(c => (c.id && c.id.toLowerCase() === sId) || (sUser && c.username?.toLowerCase().replace(/^@/, "") === sUser));

    const photoUrl = match?.photoUrl || ultimoAutorMsg.senderPhotoUrl || null;
    const name = match?.displayName || ultimoAutorMsg.senderName || sUser || "Operador";

    return {
      hasPhoto: Boolean(photoUrl),
      photoUrl,
      initials: (name || "OP").substring(0, 2).toUpperCase(),
      isMe: false,
      displayName: name
    };
  }, [ultimoAutorMsg, myPhotoUrl, myUserId, myUsername, operatorName, presencas, contatos]);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [myPhotoUrl, lastAuthorAvatarInfo.photoUrl]);

  const [modalNota, setModalNota] = useState(false);
  const [modalAjuste, setModalAjuste] = useState(false);
  const [tempAjuste, setTempAjuste] = useState(ajusteManualSobra);
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
      const isSangria = t.categoria === 'sangria';
      const isCancel = t.categoria === 'cancelamento';
      const isDinheiro = t.categoria === 'dinheiro';
      
      const title = isSangria ? 'Sangria' : isCancel ? 'Cancelamento' : isDinheiro ? 'Venda Dinheiro' : 'Lançamento';
      const subtitle = t.descricao ? t.descricao : isSangria ? 'Saída de Cofre' : isDinheiro ? 'Espécie' : 'Balcão';

      activities.push({
        id: `t_${t.id}`,
        dbId: t.id,
        type: 'new',
        category: t.categoria,
        raw: t,
        title,
        subtitle,
        timestamp: t.timestamp,
        valorToCompare: t.valorSistema
      });
    });

    (fantasmas || []).forEach(f => {
      const isEmprestimo = f.tipo === 'dinheiro_emprestado';
      const isDestroca = f.tipo === 'destroca_pix_por_nota';
      const title = isEmprestimo ? 'Empréstimo' : isDestroca ? 'Destroca' : 'Pix Recebido';
      const subtitle = f.pessoa ? f.pessoa : f.descricao || 'Pendência';

      activities.push({
        id: `f_${f.id}`,
        dbId: f.id,
        type: 'ghost',
        category: f.tipo,
        raw: f,
        title,
        subtitle,
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

    // Indexa candidatos de vínculo por valorToCompare para busca O(1)
    const candidatesByValue = new Map<number, any[]>();
    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      if ((item.type === 'new' || item.type === 'ghost') && !item.raw.transacaoVinculadaId) {
        const list = candidatesByValue.get(item.valorToCompare) || [];
        list.push(item);
        candidatesByValue.set(item.valorToCompare, list);
      }
    }

    // Identifica sugestões de vínculo sem varrer o array completo
    for (let i = 0; i < sorted.length; i++) {
      const act = sorted[i];
      if ((act.type === 'new' || act.type === 'ghost') && !act.raw.transacaoVinculadaId) {
        const pool = candidatesByValue.get(act.valorToCompare);
        if (pool) {
          const nearby = pool.find(other => 
            other !== act &&
            other.type !== act.type &&
            Math.abs(other.timestamp - act.timestamp) <= 15 * 60 * 1000 // 15 minutos
          );
          if (nearby) {
            act.suggestedLinkId = nearby.dbId;
            act.suggestedLinkType = nearby.type;
          }
        }
      }
    }

    return sorted;
  }, [transacoes, fantasmas, logs]);

  return (
    <View className="gap-2.5 pb-28">
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
        <View className="bg-orange-500/10 border border-orange-500/20 p-3.5 rounded-2xl flex-row gap-2.5 items-center">
          <AlertCircle size={18} color="#f97316" />
          <View className="flex-1">
            <Text className="text-[10px] font-black uppercase text-orange-400 tracking-wider">
              Alto Volume de Dinheiro
            </Text>
            <Text className="text-orange-500/80 text-[11px] font-medium leading-4">
              A gaveta possui mais de R$ 10.000,00 em espécie.
            </Text>
          </View>
        </View>
      )}

      {/* PAINEL PRINCIPAL (SISTEMA, GAVETA, PIX, DUPLA DE ATALHOS E AJUSTE INTELIGENTE) */}
      <PainelPrincipal 
        totais={totais} 
        pendenciasFantasma={pendencias.length}
        valorTerceiros={totalTerceiros}
        isDiscreto={isDiscreto}
        onOpenChat={onOpenChat}
        ultimaMensagemGlobal={ultimaMensagemGlobal}
        transacoes={transacoes}
        fantasmas={fantasmas}
        registrosPOS={registrosPOS}
        registrosConvenio={registrosConvenio}
        ajusteManualSobra={ajusteManualSobra}
        onAjusteSobra={onAjusteSobra}
        onNavigateToChecklist={onNavigateToChecklist}
        isFechado={isFechado}
      />

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

      {/* 4. MEIO DA TELA: BATE-PAPO DA EQUIPE + CARROSSEL DE ATIVIDADES RECENTES + BOTÃO AUDITORIA */}
      {!isDiscreto && (
        <View className="gap-3 mt-1">
          
          {/* BARRA DE BATE-PAPO DA EQUIPE (CALIBRADA: MIN-H 76px) */}
          <Pressable 
            onPress={() => {
              if (onOpenChat) onOpenChat();
              else setModalNota(true);
            }}
            className="bg-[#121216] border border-indigo-500/30 rounded-2xl p-3.5 shadow-lg flex-row items-center justify-between min-h-[76px] active:scale-98"
          >
            <View className="flex-row items-center gap-3 flex-1 mr-2">
              <View className="relative flex-shrink-0">
                <View className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 items-center justify-center overflow-hidden shadow-sm">
                  {lastAuthorAvatarInfo.hasPhoto && lastAuthorAvatarInfo.photoUrl && !avatarLoadError ? (
                    <Image 
                      source={{ uri: formatGoogleDriveThumbnailUrl(lastAuthorAvatarInfo.photoUrl, 96) }} 
                      className="w-full h-full"
                      resizeMode="cover"
                      onError={() => setAvatarLoadError(true)}
                    />
                  ) : lastAuthorAvatarInfo.initials ? (
                    <Text className="text-xs font-black text-indigo-300 uppercase">
                      {lastAuthorAvatarInfo.initials}
                    </Text>
                  ) : (
                    <MessageSquare size={18} color="#818cf8" />
                  )}
                </View>
                {/* Indicador LED de Conexão no topo do Avatar */}
                <View className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[#121216]" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5 mb-0.5">
                  <Text className="text-[11px] font-black uppercase text-indigo-300 tracking-wider">
                    Bate-papo da Equipe
                  </Text>
                  <View className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </View>
                <Text className="text-xs text-zinc-200 font-bold truncate" numberOfLines={1}>
                  {ultimaMensagemGlobal || "Nenhuma mensagem recente no mural"}
                </Text>
              </View>
            </View>
            <View className="px-3.5 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 items-center justify-center flex-shrink-0">
              <Text className="text-xs font-black text-indigo-300">
                Abrir ›
              </Text>
            </View>
          </Pressable>

          {/* CABEÇALHO DO FEED DE ATIVIDADES COM BOTÃO DE AUDITORIA */}
          <View className="flex-row items-center justify-between px-1 pt-1">
            <View className="flex-row items-center gap-2">
              <Activity size={14} color="#34d399" />
              <Text className="text-[11.5px] font-black uppercase tracking-[2px] text-zinc-300">
                Atividades Recentes
              </Text>
            </View>
            <Pressable 
              onPress={() => setShowFullAudit(true)}
              className="flex-row items-center gap-1.5 py-1.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-zinc-800 active:scale-95"
            >
              <History size={13} color="#818cf8" />
              <Text className="text-[11px] font-black text-indigo-300 uppercase tracking-wider">
                Auditoria ({feedActivities.length}) ›
              </Text>
            </Pressable>
          </View>

          {/* CARROSSEL HORIZONTAL DE ATIVIDADES ESPAÇOSO (MIN-H 92px) */}
          {feedActivities.length === 0 ? (
            <View className="bg-[#121216] border border-zinc-800/80 rounded-2xl p-4 items-center justify-center">
              <Text className="text-xs font-bold text-zinc-500">Nenhuma movimentação registrada ainda hoje.</Text>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: 10 }}
            >
              {feedActivities.slice(0, 6).map((act) => {
                const dateObj = new Date(act.timestamp);
                const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                
                const isSangria = act.category === 'sangria' || act.category === 'cancelamento';
                const isDinheiro = act.category === 'dinheiro';
                const isPix = act.type === 'ghost' || act.category === 'entrada_prestacao';
                
                const borderClass = isSangria 
                  ? 'border-red-500/30 bg-red-500/5' 
                  : isDinheiro 
                    ? 'border-emerald-500/30 bg-emerald-500/5' 
                    : isPix 
                      ? 'border-indigo-500/30 bg-indigo-500/5' 
                      : 'border-zinc-800/80 bg-[#121216]';

                const iconColor = isSangria ? '#f87171' : isDinheiro ? '#34d399' : '#818cf8';
                const prefixColor = isSangria ? 'text-red-400' : isDinheiro ? 'text-emerald-400' : 'text-indigo-300';
                const numColor = isSangria ? 'text-red-300' : isDinheiro ? 'text-white' : 'text-indigo-200';
                const valSign = isSangria ? '-' : '+';

                // Separa reais e centavos para renderização perfeita
                const valNum = Math.abs(act.valorToCompare || 0);
                const formattedStr = valNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const [reaisStr, centsStr] = formattedStr.split(',');

                return (
                  <Pressable 
                    key={act.id}
                    onPress={() => setShowFullAudit(true)}
                    className={`p-3.5 rounded-2xl border ${borderClass} min-w-[155px] max-w-[170px] justify-between min-h-[92px] shadow-lg active:scale-95`}
                  >
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <View className="h-5 w-5 rounded-md bg-zinc-900/80 items-center justify-center">
                        {isSangria ? (
                          <ArrowUpRight size={12} color={iconColor} />
                        ) : isDinheiro ? (
                          <ArrowDownLeft size={12} color={iconColor} />
                        ) : (
                          <Smartphone size={12} color={iconColor} />
                        )}
                      </View>
                      <Text style={{ color: iconColor }} className="text-[10.5px] font-black uppercase tracking-wider flex-1" numberOfLines={1}>
                        {act.title}
                      </Text>
                    </View>

                    <View className="mt-1">
                      {act.valorToCompare > 0 ? (
                        <Text numberOfLines={1} adjustsFontSizeToFit className="font-mono">
                          <Text className={`font-black text-xs ${prefixColor}`}>{valSign} </Text>
                          <Text className="text-zinc-400 font-bold text-xs">R$ </Text>
                          <Text className={`font-black text-[17px] ${numColor}`}>{reaisStr}</Text>
                          <Text className={`font-bold text-xs ${prefixColor}`}>,{centsStr}</Text>
                        </Text>
                      ) : (
                        <Text className="text-xs font-black text-blue-400 uppercase" numberOfLines={1}>
                          {act.subtitle}
                        </Text>
                      )}
                      <Text className="text-[10px] text-zinc-500 font-medium mt-0.5" numberOfLines={1}>
                        {timeStr} • {act.subtitle}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              {/* Card Final de Acesso Total */}
              <Pressable 
                onPress={() => setShowFullAudit(true)}
                className="p-3.5 rounded-2xl border border-dashed border-zinc-800 bg-[#0c0c0e] min-w-[130px] items-center justify-center min-h-[92px] shadow flex-shrink-0 active:scale-95"
              >
                <History size={18} color="#a1a1aa" />
                <Text className="text-[10.5px] font-black uppercase text-zinc-300 text-center mt-1.5">
                  Ver Todas ({feedActivities.length}) ›
                </Text>
              </Pressable>
            </ScrollView>
          )}

        </View>
      )}

      {/* RODAPÉ COM ANIMAÇÃO 2D PIXEL ART (ESQUILO & NOZ IDLE) */}
      <PixelSquirrelFooter operador={operatorName ? operatorName.trim().toUpperCase() : undefined} />

      {/* MODAL AUDITORIA AVANÇADA */}
      <AuditModal
        visible={showFullAudit}
        onClose={() => setShowFullAudit(false)}
        transacoes={transacoes}
        fantasmas={fantasmas}
        logs={logs}
        totais={totais}
        operadorName={operatorName || "Operador"}
      />
    </View>
  );
}

export const PainelScreen = memo(PainelScreenComponent);

