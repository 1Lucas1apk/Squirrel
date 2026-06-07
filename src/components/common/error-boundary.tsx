import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-ink-950 items-center justify-center p-8">
          <View className="h-24 w-24 items-center justify-center rounded-[40px] bg-red-500/10 border border-red-500/20 mb-8 shadow-2xl">
            <AlertTriangle size={40} color="#f87171" />
          </View>
          <Text className="text-2xl font-black text-white uppercase text-center mb-2 tracking-tighter">
            Pane no Sistema
          </Text>
          <Text className="text-zinc-500 font-bold text-center mb-8 uppercase text-[10px] tracking-widest leading-4">
            Não se preocupe, o caixa está seguro. 
            Ocorreu um erro visual na tela.
          </Text>
          
          <ScrollView className="w-full max-h-[150px] bg-ink-900 border border-zinc-800 p-4 rounded-2xl mb-8">
            <Text className="text-[10px] font-bold text-red-400 leading-4">
              {this.state.error?.message || "Erro desconhecido"}
            </Text>
          </ScrollView>

          <Pressable 
            onPress={this.handleReset}
            className="bg-zinc-100 px-8 py-5 rounded-[24px] flex-row items-center gap-3 active:bg-zinc-300 w-full justify-center shadow-2xl"
          >
            <RefreshCw size={18} color="#09090b" />
            <Text className="font-black uppercase tracking-widest text-zinc-950 text-xs">
              Recuperar Tela
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
