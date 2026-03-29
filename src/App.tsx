import { useState, useEffect, useRef } from 'react';
import { Layout, Model, TabNode, Actions, DockLocation } from 'flexlayout-react';
import type { IJsonModel } from 'flexlayout-react';
import 'flexlayout-react/style/dark.css';
import { useStore } from './store/documentStore';
import CanvasEditor from './components/CanvasEditor';
import { getCanvasDataUrl } from './utils/canvasRegistry';
import './i18n/i18n';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './components/LanguageSelector';
import './App.css';

const DEFAULT_LAYOUT: IJsonModel = {
  global: {
    tabEnableClose: true,
    tabEnableRename: false,
    tabSetEnableMaximize: true,
  },
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 100,
        id: 'main_tabset',
        enableDeleteWhenEmpty: false,
        children: []
      }
    ]
  }
};

const COLOR_PRESETS = [
  '#222222', '#000000', '#ffffff', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff',
  '#ffa500', '#800080', '#008080', '#808000', '#800000', '#000080', '#008000', '#808080'
];

const GRID_COLOR_PRESETS = [
  'rgba(255, 0, 0, 0.4)', 'rgba(0, 255, 0, 0.4)', 'rgba(0, 0, 255, 0.4)',
  'rgba(255, 255, 255, 0.4)', 'rgba(0, 0, 0, 0.4)', 'rgba(128, 128, 128, 0.4)'
];

// ── Save helpers (module-level so no stale closures) ────────────────────────

async function doSave(docId: string, _saveAs: boolean): Promise<boolean> {
  const doc = useStore.getState().documents[docId];
  if (!doc) return false;

  const dataUrl = getCanvasDataUrl(docId);
  if (!dataUrl) {
    alert('다운로드 실패: 캔버스 데이터를 가져올 수 없습니다.');
    return false;
  }

  try {
    const defaultName = doc.title || 'untitled.png';
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultName,
          types: [{
            description: 'PNG Image',
            accept: { 'image/png': ['.png'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        useStore.getState().updateDocument(docId, {
          isDirty: false,
          title: handle.name,
        });
        return true;
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error(err);
        return false;
      }
    } else {
      // Fallback
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      useStore.getState().updateDocument(docId, { isDirty: false });
      return true;
    }
  } catch (err) {
    console.error('Download failed:', err);
    return false;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

function App() {
  const { t } = useTranslation();
  const [model] = useState<Model>(Model.fromJson(DEFAULT_LAYOUT));
  const { documents, activeId, addDocument, updateDocument } = useStore();
  const pendingDeletions = useRef<Set<string>>(new Set());
  const [activeToolbarTab, setActiveToolbarTab] = useState<'File' | 'View' | 'Image'>('File');
  const [showHelp, setShowHelp] = useState(false);
  
  // Always-current ref to activeId (avoids stale closure in IPC handlers)
  const activeIdRef = useRef<string | null>(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // ── Browser Events ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const state = useStore.getState();
      const hasDirty = Object.values(state.documents).some(d => d.isDirty);
      if (hasDirty) {
        e.preventDefault();
        e.returnValue = t('prompts.exitWarning');
        return e.returnValue;
      }
    };

    const handleRequestSave = (e: CustomEvent<{ id: string, saveAs: boolean }>) => {
      doSave(e.detail.id, e.detail.saveAs);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('request-save', handleRequestSave as EventListener);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('request-save', handleRequestSave as EventListener);
    };
  }, []);

  // (Removed global background sync to prevent toolbar area from changing color)

  // ── Tab helpers ──────────────────────────────────────────────────────────
  const addTab = (id: string, name: string) => {
    let targetId = 'main_tabset';
    let location = DockLocation.CENTER;

    if (!model.getNodeById(targetId)) {
      const active = model.getActiveTabset();
      if (active) {
        targetId = active.getId();
      } else {
        targetId = model.getRoot().getId();
        location = DockLocation.RIGHT;
      }
    }
    
    try {
      model.doAction(Actions.addNode({
        type: 'tab',
        id: id, // Explicitly set the node ID to match docId
        component: 'editor',
        name: name,
        config: { id }
      }, targetId, location, -1));
    } catch (err) {
      console.error('Layout addNode failed:', err);
    }
  };

  const handleTestCreate = () => {
    const newId = 'doc_' + Date.now();
    addDocument({
      id: newId,
      title: t('toolbar.newImage'),
      isDirty: true,
      imageSrc: '',
      width: 1024,
      height: 1024,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      backgroundColor: '#222222',
      history: [],
      historyIndex: -1,
      gridWidth: 16,
      gridHeight: 16,
      showGrid: true,
      gridColor: 'rgba(255, 0, 0, 0.4)',
      renderVersion: 0
    });
    addTab(newId, 'New Canvas');
  };

  const openImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => {
      const newId = 'doc_' + Date.now() + '_' + file.name;
      console.log('[openImageFile] Opening:', file.name);
      addDocument({
        id: newId,
        title: file.name,
        isDirty: false,
        imageSrc: url,
        width: img.width,
        height: img.height,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        backgroundColor: '#222222',
        history: [],
        historyIndex: -1,
        gridWidth: 16,
        gridHeight: 16,
        showGrid: true,
        gridColor: 'rgba(255, 0, 0, 0.4)',
        renderVersion: 0
      });
      addTab(newId, file.name);
    };
    img.onerror = (e) => {
      console.error('Failed to load image from dropped file', e);
    };
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleOpenFileClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      for (let i = 0; i < e.target.files.length; i++) {
        openImageFile(e.target.files[i]);
      }
    }
    e.target.value = ''; // Reset
  };

  // ── Drag & Drop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.files) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          openImageFile(e.dataTransfer.files[i]);
        }
      }
    };
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };

    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragenter', handleDragOver);
    window.addEventListener('dragleave', handleDragOver);
    return () => {
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragenter', handleDragOver);
      window.removeEventListener('dragleave', handleDragOver);
    };
  }, []);

  // ── Layout callbacks ─────────────────────────────────────────────────────
  const onRenderTab = (node: TabNode, renderState: any) => {
    const docId = node.getConfig()?.id;
    const doc = useStore.getState().documents[docId];
    if (doc) {
      renderState.content = <span style={{ color: doc.isDirty ? '#ffb0b0' : 'inherit' }}>
        {doc.title}{doc.isDirty ? ' *' : ''}
      </span>;
    }
  };

  const onAction = (action: any) => {
    const arg_node = action.data?.node;

    if (action.type === 'FlexLayout_DeleteTab') {
      const tabNode = model.getNodeById(arg_node);
      if (!tabNode) return action;

      const docId = (tabNode as TabNode).getConfig()?.id;
      const doc = useStore.getState().documents[docId];

      if (doc && doc.isDirty && !pendingDeletions.current.has(arg_node)) {
        const runDeletionPrompt = async () => {
          const wantSave = window.confirm(t('prompts.unsavedChanges', { title: doc.title }));
          
          if (wantSave) {
            await doSave(docId, false);
          }
          
          pendingDeletions.current.add(arg_node);
          model.doAction(Actions.deleteTab(arg_node));
          useStore.getState().removeDocument(docId);
          pendingDeletions.current.delete(arg_node);
        };

        runDeletionPrompt();
        return undefined; // Stop immediate deletion
      } else {
        if (docId) useStore.getState().removeDocument(docId);
        return action;
      }
    } else if (action.type === 'FlexLayout_SelectTab') {
      const tabNode = model.getNodeById(action.tabNode);
      if (tabNode) {
        useStore.getState().setActiveDocument((tabNode as TabNode).getConfig()?.id);
      }
    }
    return action;
  };

  const factory = (node: TabNode) => {
    const component = node.getComponent();
    if (component === 'editor') {
      const docId = node.getConfig().id;
      return <CanvasEditor docId={docId} />;
    }
    return <div>Component Not Found</div>;
  };

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div className="toolbar-container" style={{ background: '#333', borderBottom: '1px solid #111', flexShrink: 0 }}>
        {/* Tab Header Row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 15px', height: '36px', background: '#222', userSelect: 'none' }}>
          <h3 style={{ margin: 0, color: '#fff', marginRight: '20px', fontSize: '15px' }}>TilesetMaster</h3>
          <div style={{ display: 'flex', gap: '5px' }}>
            {(['File', 'View', 'Image'] as const).map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveToolbarTab(tab)}
                style={{ 
                  background: activeToolbarTab === tab ? '#444' : 'transparent', 
                  border: 'none', color: activeToolbarTab === tab ? '#fff' : '#aaa', 
                  padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' 
                }}>
                {t(`toolbar.${tab.toLowerCase()}`)}
              </button>
            ))}
          </div>
          <span style={{ color: '#aaa', fontSize: 12, marginLeft: 'auto' }}>{t('toolbar.dragDropHint')}</span>
          <LanguageSelector />
          <button className="help-btn" onClick={() => setShowHelp(true)} title="Show Guide">?</button>
        </div>

        {/* Tab Content Row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 15px', userSelect: 'none', flexWrap: 'wrap', gap: '15px' }}>
          {activeToolbarTab === 'File' && (
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <button onClick={handleTestCreate} style={{ padding: '6px 14px', background: '#4CAF50', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{t('toolbar.newImage')}</button>
              <button onClick={handleOpenFileClick} style={{ padding: '6px 14px', background: '#2196F3', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{t('toolbar.openFile')}</button>
              <input type="file" accept="image/*" multiple onChange={handleFileInputChange} ref={fileInputRef} style={{ display: 'none' }} />
              
              {activeId && documents[activeId] && (
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', paddingLeft: '10px', borderLeft: '1px solid #555' }}>
                  <button
                    onClick={() => { doSave(activeId, false); }}
                    style={{ padding: '6px 14px', background: '#3b82f6', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{t('toolbar.download')}</button>
                </div>
              )}
            </div>
          )}

          {activeToolbarTab === 'View' && activeId && documents[activeId] && (
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <span style={{color: '#ccc', fontSize: 12}}>{t('toolbar.zoom')}</span>
                  <input type="number" value={Math.round(documents[activeId].zoom * 100)} 
                    onChange={(e) => updateDocument(activeId, { zoom: Math.max(10, Number(e.target.value)) / 100 })} 
                    style={{width: 50, background: '#222', color: '#fff', border: '1px solid #555', padding: '4px'}} />
                  <span style={{color: '#ccc', fontSize: 12}}>%</span>
                </div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[100, 200, 300, 400, 500].map(z => (
                    <button key={z} onClick={() => updateDocument(activeId, { zoom: z / 100 })}
                      style={{ padding: '2px 6px', background: '#444', border: '1px solid #555', color: '#fff', fontSize: 10, cursor: 'pointer', borderRadius: '3px' }}>
                      {z}%
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <span style={{color: '#ccc', fontSize: 12}}>{t('toolbar.gridSize')}</span>
                  <input type="number" value={documents[activeId].gridWidth} onChange={(e) => updateDocument(activeId, { gridWidth: Number(e.target.value) })} style={{width: 40, background: '#222', color: '#fff', border: '1px solid #555', padding: '4px'}} />
                  <span style={{color: '#ccc', fontSize: 12}}>x</span>
                  <input type="number" value={documents[activeId].gridHeight} onChange={(e) => updateDocument(activeId, { gridHeight: Number(e.target.value) })} style={{width: 40, background: '#222', color: '#fff', border: '1px solid #555', padding: '4px'}} />
                </div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[8, 16, 24, 32, 48, 64].map(g => (
                    <button key={g} onClick={() => updateDocument(activeId, { gridWidth: g, gridHeight: g })}
                      style={{ padding: '2px 6px', background: '#444', border: '1px solid #555', color: '#fff', fontSize: 10, cursor: 'pointer', borderRadius: '3px' }}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '10px', borderLeft: '1px solid #555' }}>
                {/* Background Color Row */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: '#ccc', fontSize: 12, minWidth: '80px' }}>{t('toolbar.background')}</span>
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    {COLOR_PRESETS.map(color => (
                      <div key={color} 
                          onClick={() => updateDocument(activeId, { backgroundColor: color })}
                          style={{ width: 14, height: 14, backgroundColor: color, cursor: 'pointer', border: documents[activeId].backgroundColor === color ? '2px solid white' : '1px solid #000' }} 
                      />
                    ))}
                  </div>
                </div>

                {/* Grid Color Row */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: '#ccc', fontSize: 12, minWidth: '80px' }}>{t('toolbar.gridColor')}</span>
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    {GRID_COLOR_PRESETS.map(color => (
                      <div key={color} 
                          onClick={() => updateDocument(activeId, { gridColor: color })}
                          style={{ width: 14, height: 14, backgroundColor: color, cursor: 'pointer', border: documents[activeId].gridColor === color ? '2px solid white' : '1px solid #555' }} 
                      />
                    ))}
                  </div>
                  
                  {/* Grid Toggle - Spaced and aligned */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '40px' }}>
                    <input 
                      type="checkbox" 
                      id="showGridCheck"
                      checked={documents[activeId].showGrid}
                      onChange={(e) => updateDocument(activeId, { showGrid: e.target.checked })}
                      style={{ cursor: 'pointer', width: '13px', height: '13px' }}
                    />
                    <label htmlFor="showGridCheck" style={{ color: '#ccc', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {t('toolbar.showGrid')}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeToolbarTab === 'Image' && activeId && documents[activeId] && (
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <span style={{color: '#ccc', fontSize: 12}}>{documents[activeId].title}:</span>
              <input id="resizeW" type="number" defaultValue={documents[activeId].width} key={`w-${activeId}-${documents[activeId].width}`} style={{width: 60, background: '#222', color: '#fff', border: '1px solid #555', padding: '4px'}} />
              <span style={{color: '#ccc', fontSize: 12}}>x</span>
              <input id="resizeH" type="number" defaultValue={documents[activeId].height} key={`h-${activeId}-${documents[activeId].height}`} style={{width: 60, background: '#222', color: '#fff', border: '1px solid #555', padding: '4px'}} />
              <button 
                onClick={() => {
                  const wRaw = (document.getElementById('resizeW') as HTMLInputElement)?.value;
                  const hRaw = (document.getElementById('resizeH') as HTMLInputElement)?.value;
                  if (!wRaw || !hRaw) return;
                  const w = parseInt(wRaw.trim());
                  const h = parseInt(hRaw.trim());
                  if (w > 0 && h > 0) {
                    window.dispatchEvent(new CustomEvent('resize-canvas', { detail: { w, h, id: activeId } }));
                  }
                }}
                style={{ marginLeft: '10px', padding: '6px 14px', background: '#555', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                {t('toolbar.applyResize')}
              </button>
            </div>
          )}
          {(!activeId || !documents[activeId]) && activeToolbarTab !== 'File' && (
             <span style={{ color: '#888', fontSize: '13px', fontStyle: 'italic' }}>{t('toolbar.noActiveDoc')}</span>
          )}
        </div>
      </div>
      <div className="layout-container" style={{ flex: 1, position: 'relative' }}>
         <Layout 
            model={model} 
            factory={factory} 
            onAction={onAction}
            onRenderTab={onRenderTab}
         />
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowHelp(false)}>&times;</button>
            <h2>{t('help.title')}</h2>
            
            <section>
              <h3>{t('help.mouseTitle')}</h3>
              <ul>
                <li><strong>{t('help.mouse.drag').split(':')[0]}:</strong>{t('help.mouse.drag').split(':')[1]}</li>
                <li><strong>{t('help.mouse.click').split(':')[0]}:</strong>{t('help.mouse.click').split(':')[1]}</li>
                <li><strong>{t('help.mouse.rightClickEmpty').split(':')[0]}:</strong>{t('help.mouse.rightClickEmpty').split(':')[1]}</li>
                <li><strong>{t('help.mouse.rightClickObject').split(':')[0]}:</strong>{t('help.mouse.rightClickObject').split(':')[1]}</li>
                <li><strong>{t('help.mouse.pan').split(':')[0]}:</strong>{t('help.mouse.pan').split(':')[1]}</li>
                <li><strong>{t('help.mouse.zoom').split(':')[0]}:</strong>{t('help.mouse.zoom').split(':')[1]}</li>
              </ul>
            </section>

            <section>
              <h3>{t('help.shortcutTitle')}</h3>
              <ul>
                <li><strong>{t('help.shortcuts.copy').split(':')[0]}:</strong>{t('help.shortcuts.copy').split(':')[1]}</li>
                <li><strong>{t('help.shortcuts.undo').split(':')[0]}:</strong>{t('help.shortcuts.undo').split(':')[1]}</li>
                <li><strong>{t('help.shortcuts.grid').split(':')[0]}:</strong>{t('help.shortcuts.grid').split(':')[1]}</li>
                <li><strong>{t('help.shortcuts.cancel').split(':')[0]}:</strong>{t('help.shortcuts.cancel').split(':')[1]}</li>
                <li><strong>{t('help.shortcuts.confirm').split(':')[0]}:</strong>{t('help.shortcuts.confirm').split(':')[1]}</li>
              </ul>
            </section>

            <section>
              <h3>{t('help.tipTitle')}</h3>
              <ul>
                <li>{t('help.tips.trim')}</li>
                <li>{t('help.tips.move')}</li>
                <li>{t('help.tips.bg')}</li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
