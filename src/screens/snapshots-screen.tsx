import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ScrollView, Modal, Share, ActivityIndicator } from "react-native";
import { X, RotateCcw, Trash2, Download, Clock, Database, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react-native";
import { 
  getSnapshotIndex, 
  loadSnapshot, 
  deleteSnapshot, 
  saveSnapshot,
  SnapshotIndexEntry, 
  DataSnapshot 
} from "../services/local-storage";
import { 
  adicionarTransacao, 
  adicionarFantasma,
  removerTurnoTotal,
  criarNovoTurno,
  listarTurnosRecentes,
  restaurarSnapshotNuvem,
} from "../services/repositories/caixa-repository";
import { useCaixaStore } from "../store/caixa-store";
import { toBrl } from "../utils/currency";

interface SnapshotsScreenProps {
  onClose: () => void;
  onAlert: (title: string, message: string, onConfirm: () => void, destructive?: boolean) => void;
}

export function SnapshotsScreen({ onClose, onAlert }: SnapshotsScreenProps) {
  const { turno } = useCaixaStore();
  const [snapshots, setSnapshots] = useState<SnapshotIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<DataSnapshot | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const index = await getSnapshotIndex();
      // Filtra apenas os backups do turno atual, para não misturar dias com a mesma data
      const filtered = turno ? index.filter(s => s.turnoId === turno.id) : index;
      setSnapshots(filtered);
    } catch (e) {
      console.error("Erro ao carregar snapshots", e);
    } finally {
      setLoading(false);
    }
  }, [turno]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const handleViewDetails = async (entry: SnapshotIndexEntry) => {
    setDetailLoading(true);
    try {
      const snap = await loadSnapshot(entry.id);
      if (snap) {
        setSelectedSnapshot(snap);
      }
    } catch (e) {
      console.error("Erro ao carregar detalhes do snapshot", e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = (entry: SnapshotIndexEntry) => {
    onAlert(
      "APAGAR SNAPSHOT",
      `Deseja remover o backup de ${formatDate(entry.timestamp)}?\n\nIsso não afeta os dados atuais do caixa.`,
      async () => {
        await deleteSnapshot(entry.id);
        if (selectedSnapshot?.id === entry.id) {
          setSelectedSnapshot(null);
        }
        await loadSnapshots();
      },
      true
    );
  };

  const handleExport = async (snap: DataSnapshot) => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        snapshotId: snap.id,
        reason: snap.reason,
        turno: snap.turno,
        transacoes: snap.transacoes,
        fantasmas: snap.fantasmas,
        logs: snap.logs,
        registrosPOS: snap.registrosPOS,
        registrosConvenio: snap.registrosConvenio,
      };
      await Share.share({ message: JSON.stringify(payload, null, 2) });
    } catch (e) {
      console.error("Erro ao exportar snapshot", e);
    }
  };

  const handleRestore = (snap: DataSnapshot) => {
    onAlert(
      "RESTAURAR DADOS",
      `Isso vai restaurar o estado do turno ${snap.turnoDataRef} para como estava em ${formatDate(snap.timestamp)}.\n\n` +
      `• ${snap.transacoes.length} transações\n` +
      `• ${snap.fantasmas.length} notas informais\n\n` +
      `Um snapshot do estado ATUAL será salvo antes da restauração como segurança.`,
      async () => {
        setRestoring(true);
        try {
          // 1. Salva snapshot do estado atual primeiro (segurança)
          const currentState = useCaixaStore.getState();
          if (currentState.turno) {
            await saveSnapshot(
              "antes_restaurar_snapshot",
              currentState.turno,
              currentState.transacoes,
              currentState.fantasmas,
              currentState.logs || [],
              currentState.registrosPOS || [],
              currentState.registrosConvenio || []
            );
          }

          // 2. Restaura na NUVEM (Firestore) via batch! Isso garante que todos os outros celulares sincronizem.
          await restaurarSnapshotNuvem(
            {
              turnoId: currentState.turno?.id || snap.turno?.id || "",
              transacoes: currentState.transacoes,
              fantasmas: currentState.fantasmas,
              registrosPOS: currentState.registrosPOS || [],
              registrosConvenio: currentState.registrosConvenio || []
            },
            snap
          );

          // 3. Restaura no estado local (MMKV/Zustand) imediatamente
          useCaixaStore.setState({
            turno: snap.turno,
            transacoes: snap.transacoes,
            fantasmas: snap.fantasmas,
            logs: snap.logs || [],
            registrosPOS: snap.registrosPOS || [],
            registrosConvenio: snap.registrosConvenio || [],
            isTransacoesLoaded: true,
            isFantasmasLoaded: true,
            isRegistrosPOSLoaded: true,
            isRegistrosConvenioLoaded: true,
          });

          setSelectedSnapshot(null);
          onClose();
        } catch (e) {
          console.error("Erro ao restaurar snapshot", e);
          onAlert("ERRO", "Falha ao restaurar o snapshot. Os dados atuais não foram alterados.", () => {});
        } finally {
          setRestoring(false);
        }
      }
    );
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const reasonLabels: Record<string, string> = {
    "antes_fechar_turno": "Fechamento",
    "antes_excluir_turno": "Exclusão",
    "antes_restaurar_snapshot": "Restauração",
    "manual": "Manual",
    "Antes de criar transação": "Criação (Transação)",
    "Antes de excluir transação": "Exclusão (Transação)",
    "Antes de editar transação": "Edição (Transação)",
    "Antes de adicionar nota": "Criação (Nota)",
    "Antes de editar nota": "Edição (Nota)",
    "Antes de excluir nota": "Exclusão (Nota)",
    "Antes de adicionar POS": "Criação (POS)",
    "Antes de editar POS": "Edição (POS)",
    "Antes de excluir POS": "Exclusão (POS)",
    "Antes de adicionar Convênio": "Criação (Convênio)",
    "Antes de editar Convênio": "Edição (Convênio)",
    "Antes de excluir Convênio": "Exclusão (Convênio)",
  };

  // Tela de detalhes do snapshot
  if (selectedSnapshot) {
    const snap = selectedSnapshot;
    const totalSistema = snap.transacoes.reduce((acc, t) => {
      if (t.categoria !== "sangria" && t.categoria !== "cancelamento") {
        return acc + t.valorSistema;
      }
      return acc;
    }, 0);
    const totalSangrias = snap.transacoes.reduce((acc, t) => {
      if (t.categoria === "sangria" || t.categoria === "cancelamento") {
        return acc + t.valorSistema;
      }
      return acc;
    }, 0);

    return (
      <Modal visible transparent animationType="fade">
        <View className="flex-1 bg-black/95 items-center justify-center p-4">
          <View className="w-full max-w-[420px] max-h-[92%] bg-ink-900 border border-zinc-800 rounded-[40px] shadow-2xl overflow-hidden">
            {/* Header */}
            <View className="p-6 pb-4 border-b border-zinc-800">
              <View className="flex-row items-center justify-between mb-4">
                <Pressable onPress={() => setSelectedSnapshot(null)} hitSlop={12}>
                  <RotateCcw size={18} color="#71717a" />
                </Pressable>
                <Text className="text-lg font-black text-white uppercase tracking-widest">Detalhes</Text>
                <View className="flex-row gap-2">
                  <Pressable onPress={() => handleExport(snap)} hitSlop={8}>
                    <Download size={18} color="#60a5fa" />
                  </Pressable>
                </View>
              </View>

              <View className="bg-ink-800 rounded-2xl p-4 border border-zinc-800">
                <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                  {reasonLabels[snap.reason] || snap.reason}
                </Text>
                <Text className="text-xs font-black text-zinc-300 uppercase">
                  {formatDate(snap.timestamp)} • Dia {snap.turnoDataRef}
                </Text>
              </View>
            </View>

            {/* Stats */}
            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
              <View className="py-4 gap-3">
                {/* Resumo numérico */}
                <View className="flex-row gap-3">
                  <View className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 items-center">
                    <Text className="text-[10px] font-black text-emerald-500 uppercase mb-1">Entradas</Text>
                    <Text className="text-sm font-black text-emerald-400">{toBrl(totalSistema)}</Text>
                  </View>
                  <View className="flex-1 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 items-center">
                    <Text className="text-[10px] font-black text-red-500 uppercase mb-1">Saídas</Text>
                    <Text className="text-sm font-black text-red-400">{toBrl(totalSangrias)}</Text>
                  </View>
                </View>

                {/* Contagens */}
                <View className="bg-ink-800 rounded-2xl p-4 border border-zinc-800 gap-3">
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black text-zinc-500 uppercase">Transações</Text>
                    <Text className="text-xs font-black text-zinc-300">{snap.transacoes.length}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black text-zinc-500 uppercase">Notas Informais</Text>
                    <Text className="text-xs font-black text-zinc-300">{snap.fantasmas.length}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black text-zinc-500 uppercase">Registros POS</Text>
                    <Text className="text-xs font-black text-zinc-300">{(snap.registrosPOS || []).length}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black text-zinc-500 uppercase">Registros Convênio</Text>
                    <Text className="text-xs font-black text-zinc-300">{(snap.registrosConvenio || []).length}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black text-zinc-500 uppercase">Logs de Auditoria</Text>
                    <Text className="text-xs font-black text-zinc-300">{(snap.logs || []).length}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black text-zinc-500 uppercase">Status do Turno</Text>
                    <Text className={`text-xs font-black uppercase ${snap.turno.statusTurno === "aberto" ? "text-emerald-400" : "text-amber-400"}`}>
                      {snap.turno.statusTurno}
                    </Text>
                  </View>
                </View>

                {/* Lista de transações (preview) */}
                {snap.transacoes.length > 0 && (
                  <View className="gap-2">
                    <Text className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">
                      Transações ({snap.transacoes.length})
                    </Text>
                    {snap.transacoes.slice(0, 8).map((t, i) => (
                      <View key={t.id || i} className="flex-row items-center justify-between bg-ink-800 rounded-xl p-3 border border-zinc-800/50">
                        <View className="flex-1 mr-3">
                          <Text className="text-[10px] font-black text-zinc-400 uppercase" numberOfLines={1}>
                            {t.descricao || t.categoria || "Sem descrição"}
                          </Text>
                        </View>
                        <Text className={`text-xs font-black ${t.categoria === "sangria" || t.categoria === "cancelamento" ? "text-red-400" : "text-emerald-400"}`}>
                          {toBrl(t.valorSistema)}
                        </Text>
                      </View>
                    ))}
                    {snap.transacoes.length > 8 && (
                      <Text className="text-[10px] font-bold text-zinc-600 text-center">
                        +{snap.transacoes.length - 8} transações restantes
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Actions */}
            <View className="p-6 pt-4 border-t border-zinc-800 gap-3">
              <Pressable 
                onPress={() => handleRestore(snap)} 
                disabled={restoring}
                className="bg-amber-500 py-5 rounded-[24px] flex-row items-center justify-center gap-3"
              >
                {restoring ? (
                  <ActivityIndicator color="#451a03" />
                ) : (
                  <>
                    <RotateCcw size={16} color="#451a03" />
                    <Text className="font-black uppercase text-[11px] text-amber-950 tracking-widest">
                      Restaurar este Backup
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable 
                onPress={() => setSelectedSnapshot(null)} 
                className="bg-zinc-800 py-4 rounded-[24px]"
              >
                <Text className="text-center font-black uppercase text-[10px] text-zinc-400">Voltar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Tela principal: lista de snapshots
  return (
    <Modal visible transparent animationType="slide">
      <View className="flex-1 bg-black/95">
        <View className="flex-1 max-w-[460px] mx-auto w-full">
          {/* Header */}
          <View className="px-6 pt-12 pb-4">
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-2xl font-black text-white uppercase tracking-tighter">Backups</Text>
                <Text className="text-[10px] font-black text-zinc-600 uppercase tracking-[3px]">
                  Restaurar dados anteriores
                </Text>
              </View>
              <Pressable 
                onPress={onClose} 
                className="h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-ink-900"
              >
                <X size={18} color="#71717a" />
              </Pressable>
            </View>

            {/* Info box */}
            <View className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex-row items-start gap-3">
              <AlertCircle size={16} color="#f59e0b" style={{ marginTop: 2 }} />
              <Text className="text-[10px] font-bold text-amber-400/80 uppercase leading-4 flex-1">
                Snapshots são criados automaticamente antes de fechar ou excluir um dia. Máximo de 10 salvos.
              </Text>
            </View>
          </View>

          {/* Lista */}
          <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
            {loading ? (
              <View className="items-center justify-center py-16">
                <ActivityIndicator color="#71717a" />
              </View>
            ) : snapshots.length === 0 ? (
              <View className="items-center justify-center py-16 gap-4">
                <Database size={40} color="#27272a" />
                <Text className="text-zinc-700 font-black uppercase text-xs text-center tracking-widest">
                  Nenhum backup encontrado
                </Text>
                <Text className="text-zinc-800 font-bold text-[10px] text-center uppercase leading-4">
                  Snapshots são criados automaticamente{"\n"}antes de operações importantes.
                </Text>
              </View>
            ) : (
              <View className="gap-3 pb-8">
                {snapshots.map((entry) => (
                  <Pressable 
                    key={entry.id} 
                    onPress={() => handleViewDetails(entry)}
                    className="bg-ink-900 border border-zinc-800 rounded-[24px] p-5 active:bg-ink-800"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 mr-3">
                        <View className="flex-row items-center gap-2 mb-2">
                          <Clock size={12} color="#71717a" />
                          <Text className="text-xs font-black text-zinc-300 uppercase">
                            {formatDate(entry.timestamp)}
                          </Text>
                        </View>
                        <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                          {reasonLabels[entry.reason] || entry.reason}
                        </Text>
                        <Text className="text-[10px] font-bold text-zinc-600 mt-1">
                          Dia: {entry.turnoDataRef}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Pressable 
                          onPress={(e) => { e.stopPropagation(); handleDelete(entry); }} 
                          hitSlop={8}
                          className="h-8 w-8 items-center justify-center rounded-xl bg-red-500/10"
                        >
                          <Trash2 size={14} color="#f87171" />
                        </Pressable>
                        <ChevronRight size={16} color="#3f3f46" />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
