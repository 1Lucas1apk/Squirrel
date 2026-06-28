import { create } from "zustand";
import { MensagemChat } from "../types/domain";

interface ChatState {
  mensagens: MensagemChat[];
  setMensagens: (msgs: MensagemChat[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  mensagens: [],
  setMensagens: (msgs) => set({ mensagens: msgs }),
}));
