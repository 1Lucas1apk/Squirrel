import { create } from "zustand";
import { MensagemChat, ChatContact } from "../types/domain";
import { getSavedOperatorProfileSync, saveSavedOperatorProfileSync, SavedProfileData } from "../services/local-storage";

export interface UserProfile extends SavedProfileData {}

interface ChatState {
  mensagens: MensagemChat[];
  contatos: ChatContact[];
  presencas: ChatContact[];
  myProfile: UserProfile | null;
  isAdmin: boolean;
  activeChatId: string | null;
  hiddenLocalIds: Record<string, boolean>;
  setMensagens: (msgs: MensagemChat[]) => void;
  setContatos: (contatos: ChatContact[]) => void;
  setPresencas: (presencas: ChatContact[]) => void;
  setMyProfile: (profile: UserProfile | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setActiveChatId: (id: string | null) => void;
  setHiddenLocalIds: (updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  hideMessageLocally: (id: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  mensagens: [],
  contatos: [],
  presencas: [],
  myProfile: null,
  isAdmin: false,
  activeChatId: null,
  hiddenLocalIds: {},
  setMensagens: (msgs) => set({ mensagens: msgs }),
  setContatos: (contatos) => set({ contatos }),
  setPresencas: (presencas) => set({ presencas }),
  setMyProfile: (myProfile) => {
    if (myProfile) {
      saveSavedOperatorProfileSync(myProfile, myProfile.userId);
    }
    set({ myProfile, isAdmin: myProfile ? myProfile.isAdmin : false });
  },
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setActiveChatId: (activeChatId) => set({ activeChatId }),
  setHiddenLocalIds: (updater) => set((state) => ({
    hiddenLocalIds: typeof updater === "function" ? updater(state.hiddenLocalIds) : updater
  })),
  hideMessageLocally: (id) => set((state) => ({
    hiddenLocalIds: { ...state.hiddenLocalIds, [id]: true }
  })),
}));
