import { create } from 'zustand';

export interface ClipboardData {
  imageData: ImageData;
  width: number;
  height: number;
}

export interface DocumentState {
  id: string;
  title: string;
  isDirty: boolean;
  filePath?: string; // If opened from disk
  
  // Canvas/Image Data
  imageSrc: string; // Object URL or Base64 string
  width: number; // base image width
  height: number; // base image height
  
  // Undo/Redo Storage
  history: ImageData[];
  historyIndex: number;

  // Viewer State
  zoom: number;
  offsetX: number;
  offsetY: number;
  backgroundColor: string;
  
  // Grid Settings
  gridWidth: number;
  gridHeight: number;
  showGrid: boolean;
  gridColor: string;

  // Render trigger - we bump this when canvas content is externally modified via copy/cut/paste
  renderVersion: number;
}

interface AppStore {
  documents: Record<string, DocumentState>;
  activeId: string | null;
  clipboard: ClipboardData | null;
  
  // Actions
  addDocument: (doc: DocumentState) => void;
  updateDocument: (id: string, updates: Partial<DocumentState>) => void;
  removeDocument: (id: string) => void;
  setActiveDocument: (id: string | null) => void;
  setClipboard: (data: ClipboardData | null) => void;
  markDirty: (id: string) => void;
  triggerRender: (id: string) => void;
  pushHistory: (id: string, imageData: ImageData) => void;
  undo: (id: string) => ImageData | null;
  redo: (id: string) => ImageData | null;
}

export const useStore = create<AppStore>((set, get) => ({
  documents: {},
  activeId: null,
  clipboard: null,

  addDocument: (doc) => 
    set((state) => ({
      documents: { ...state.documents, [doc.id]: doc },
    })),

  updateDocument: (id, updates) =>
    set((state) => {
      const doc = state.documents[id];
      if (!doc) return state;
      return {
        documents: {
          ...state.documents,
          [id]: { ...doc, ...updates },
        },
      };
    }),

  removeDocument: (id) =>
    set((state) => {
      const newDocs = { ...state.documents };
      delete newDocs[id];
      return { documents: newDocs };
    }),

  setActiveDocument: (id) => set({ activeId: id }),

  setClipboard: (data) => set({ clipboard: data }),

  markDirty: (id) => 
    set((state) => {
      const doc = state.documents[id];
      if (!doc) return state;
      return {
        documents: {
          ...state.documents,
          [id]: { ...doc, isDirty: true },
        },
      };
    }),

  triggerRender: (id) =>
    set((state) => {
      const doc = state.documents[id];
      if (!doc) return state;
      return {
        documents: {
          ...state.documents,
          [id]: { ...doc, renderVersion: doc.renderVersion + 1 },
        },
      };
    }),

  pushHistory: (id, imageData) =>
    set((state) => {
      const doc = state.documents[id];
      if (!doc) return state;
      
      const newHistory = doc.history.slice(0, doc.historyIndex + 1);
      newHistory.push(imageData);

      // Limit history size to 30 to save memory
      if (newHistory.length > 30) {
        newHistory.shift();
      }

      return {
        documents: {
          ...state.documents,
          [id]: { 
            ...doc, 
            history: newHistory, 
            historyIndex: newHistory.length - 1 
          },
        },
      };
    }),

  undo: (id) => {
    const doc = get().documents[id];
    if (!doc || doc.historyIndex <= 0) return null; // Can't undo beyond original state
    
    const newIdx = doc.historyIndex - 1;
    set((state) => ({ 
      documents: { 
        ...state.documents, 
        [id]: { ...doc, historyIndex: newIdx, isDirty: true } 
      } 
    }));
    return doc.history[newIdx];
  },

  redo: (id) => {
    const doc = get().documents[id];
    if (!doc || doc.historyIndex >= doc.history.length - 1) return null;
    
    const newIdx = doc.historyIndex + 1;
    set((state) => ({ 
      documents: { 
        ...state.documents, 
        [id]: { ...doc, historyIndex: newIdx, isDirty: true } 
      } 
    }));
    return doc.history[newIdx];
  },
}));
