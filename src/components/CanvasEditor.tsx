import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../store/documentStore';
import { copyRegion, clearRegion, pasteRegion, isRegionTransparent, getTrimmedBounds } from '../utils/imageUtils';
import { registerCanvasGetter, unregisterCanvasGetter } from '../utils/canvasRegistry';
import { useTranslation } from 'react-i18next';

interface Props {
  docId: string;
}

const CanvasEditor: React.FC<Props> = ({ docId }) => {
  const { t } = useTranslation();
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const doc = useStore((state) => state.documents[docId]);
  const updateDocument = useStore((state) => state.updateDocument);
  const markDirty = useStore((state) => state.markDirty);
  const { clipboard, setClipboard, pushHistory, undo, redo } = useStore();

  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  // Selection state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selStart, setSelStart] = useState<{ x: number, y: number } | null>(null);
  const [selEnd, setSelEnd] = useState<{ x: number, y: number } | null>(null);

  // Floating Paste Block state
  const [floatingBlock, setFloatingBlock] = useState<{ data: any, x: number, y: number } | null>(null);
  const [isDraggingBlock, setIsDraggingBlock] = useState(false);
  const dragStartPos = useRef({x: 0, y: 0});
  const hasDraggedBlock = useRef(false);
  const docRef = useRef(doc);

  // Keep docRef in sync with latest doc
  useEffect(() => { docRef.current = doc; }, [doc]);

  const commitHistory = (w: number, h: number) => {
    if (imageCanvasRef.current) {
        const ctx = imageCanvasRef.current.getContext('2d');
        if (ctx) pushHistory(docId, ctx.getImageData(0, 0, w, h));
    }
  };

  // Register this canvas in the global registry so App.tsx can get PNG data directly
  useEffect(() => {
    registerCanvasGetter(docId, () => imageCanvasRef.current?.toDataURL('image/png') ?? null);
    return () => unregisterCanvasGetter(docId);
  }, [docId]);

  // Load Image onto Canvas ONLY once when imageSrc changes
  useEffect(() => {
    if (!doc?.imageSrc || !imageCanvasRef.current) return;
    const ctx = imageCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = doc.imageSrc;
    img.onload = () => {
      ctx.clearRect(0, 0, doc.width, doc.height);
      ctx.drawImage(img, 0, 0);
      if (doc.history.length === 0) {
        commitHistory(doc.width, doc.height);
      }
    };
  }, [doc?.imageSrc]);

  // Derived Grid Background Style
  const gridStyle = useMemo(() => {
    if (!doc?.showGrid || doc.gridWidth <= 0 || doc.gridHeight <= 0) return {};
    const color = doc.gridColor || 'rgba(255, 0, 0, 0.4)';
    return {
      backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
      backgroundSize: `${doc.gridWidth}px ${doc.gridHeight}px`,
      borderRight: `1px solid ${color}`,
      borderBottom: `1px solid ${color}`
    };
  }, [doc?.showGrid, doc?.gridWidth, doc?.gridHeight, doc?.gridColor]);

  const screenToCanvas = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    // Container coordinates
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    // Map to canvas
    const x = (cx - doc.offsetX) / doc.zoom;
    const y = (cy - doc.offsetY) / doc.zoom;

    // Snap to grid
    return {
      x: Math.floor(x / doc.gridWidth) * doc.gridWidth,
      y: Math.floor(y / doc.gridHeight) * doc.gridHeight,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Focus immediately on pointer down
    useStore.getState().setActiveDocument(docId);
    
    if (e.button === 1 || e.shiftKey || e.altKey) {
      // Pan
      setIsPanning(true);
      setLastPanPos({ x: e.clientX, y: e.clientY });
      containerRef.current?.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      
      // Check if clicking inside floating block
      if (floatingBlock) {
        const fw = floatingBlock.data.width;
        const fh = floatingBlock.data.height;
        if (pos.x >= floatingBlock.x && pos.x < floatingBlock.x + fw &&
            pos.y >= floatingBlock.y && pos.y < floatingBlock.y + fh) {
          setIsDraggingBlock(true);
          dragStartPos.current = pos;
          hasDraggedBlock.current = false;
          containerRef.current?.setPointerCapture(e.pointerId);
          return;
        }
        // If clicked outside, just allow standard selection to occur below!
      }

      // Check if clicking inside an existing selection to drag (cut & paste)
      if (selStart && selEnd) {
        const x = Math.min(selStart.x, selEnd.x);
        const y = Math.min(selStart.y, selEnd.y);
        const w = Math.abs(selEnd.x - selStart.x);
        const h = Math.abs(selEnd.y - selStart.y);
        if (pos.x >= x && pos.x < x + w && pos.y >= y && pos.y < y + h) {
          // Inside selection: transform selection to floating block
          if (imageCanvasRef.current) {
            const data = copyRegion(imageCanvasRef.current, x, y, w, h);
            setClipboard(data);
            clearRegion(imageCanvasRef.current, x, y, w, h);
            commitHistory(doc.width, doc.height);
            markDirty(docId);
            
            setFloatingBlock({ data, x, y });
            
            // clear selection
            setSelStart(null);
            setSelEnd(null);

            // Initiate drag for the newly created floating block
            setIsDraggingBlock(true);
            dragStartPos.current = pos;
            hasDraggedBlock.current = false;
            containerRef.current?.setPointerCapture(e.pointerId);
            return;
          }
        }
      }

      // Setup Selection
      setIsSelecting(true);
      setSelStart(pos);
      // Immediately set end to same grid block so 1 tile is selected
      setSelEnd({ x: pos.x + doc.gridWidth, y: pos.y + doc.gridHeight });
      containerRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPos.x;
      const dy = e.clientY - lastPanPos.y;
      updateDocument(docId, {
        offsetX: doc.offsetX + dx,
        offsetY: doc.offsetY + dy
      });
      setLastPanPos({ x: e.clientX, y: e.clientY });
    } else if (isDraggingBlock && floatingBlock) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      if (pos.x !== dragStartPos.current.x || pos.y !== dragStartPos.current.y) {
        hasDraggedBlock.current = true;
        // Move block according to the delta in grid units
        const gridDx = pos.x - dragStartPos.current.x;
        const gridDy = pos.y - dragStartPos.current.y;
        setFloatingBlock({ ...floatingBlock, x: floatingBlock.x + gridDx, y: floatingBlock.y + gridDy });
        dragStartPos.current = pos;
      }
    } else if (isSelecting && selStart) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      // Set end strictly wrapping the targeted grid block 
      setSelEnd({
        x: pos.x >= selStart.x ? pos.x + doc.gridWidth : pos.x,
        y: pos.y >= selStart.y ? pos.y + doc.gridHeight : pos.y
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      containerRef.current?.releasePointerCapture(e.pointerId);
    }
    if (isDraggingBlock) {
      setIsDraggingBlock(false);
      containerRef.current?.releasePointerCapture(e.pointerId);
      if (!hasDraggedBlock.current && floatingBlock && imageCanvasRef.current) {
        // Did not drag -> commit placement
        const success = pasteRegion(imageCanvasRef.current, floatingBlock.data, floatingBlock.x, floatingBlock.y);
        if (success) {
          commitHistory(doc.width, doc.height);
          markDirty(docId);
          setFloatingBlock(null);
          console.log(t('editor.pasted'));
        } else {
          alert(t('editor.pasteError'));
        }
      }
    }
    if (isSelecting) {
      setIsSelecting(false);
      containerRef.current?.releasePointerCapture(e.pointerId);
      
      // Auto-copy on selection complete
      if (selStart && selEnd && imageCanvasRef.current) {
        const x = Math.min(selStart.x, selEnd.x);
        const y = Math.min(selStart.y, selEnd.y);
        const w = Math.abs(selEnd.x - selStart.x);
        const h = Math.abs(selEnd.y - selStart.y);
        if (w > 0 && h > 0) {
           const trimmed = getTrimmedBounds(imageCanvasRef.current, x, y, w, h);
           if (trimmed) {
             const data = copyRegion(imageCanvasRef.current, trimmed.x, trimmed.y, trimmed.width, trimmed.height);
             setClipboard(data);
             // shrink selection cleanly to fit the trimmed bounds
             setSelStart({ x: trimmed.x, y: trimmed.y });
             setSelEnd({ x: trimmed.x + trimmed.width, y: trimmed.y + trimmed.height });
           } else {
             // Completely transparent, do not copy and cancel selection
             setSelStart(null);
             setSelEnd(null);
           }
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    useStore.getState().setActiveDocument(docId);

    const scaleAdjust = e.deltaY > 0 ? 0.9 : 1.1;
    let newZoom = doc.zoom * scaleAdjust;
    newZoom = Math.min(Math.max(0.1, newZoom), 20);

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const newOffsetX = mouseX - (mouseX - doc.offsetX) * scaleAdjust;
      const newOffsetY = mouseY - (mouseY - doc.offsetY) * scaleAdjust;

      updateDocument(docId, { zoom: newZoom, offsetX: newOffsetX, offsetY: newOffsetY });
    }
  };

  // Keyboard Shortcuts for Copy/Cut/Paste/Undo/Zoom
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const { activeId } = useStore.getState();
      if (activeId !== docId) return;

      if (e.key === 'Tab') {
         e.preventDefault();
         updateDocument(docId, { showGrid: !doc.showGrid });
         return;
      }

      const validSelection = selStart && selEnd;
      let x = 0, y = 0, w = 0, h = 0;
      if (validSelection) {
         x = Math.min(selStart.x, selEnd.x);
         y = Math.min(selStart.y, selEnd.y);
         w = Math.abs(selEnd.x - selStart.x);
         h = Math.abs(selEnd.y - selStart.y);
      }

      // Dismiss Floating Block on Escape, Backspace, or Delete
      if ((e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Delete') && floatingBlock) {
        e.preventDefault();
        setFloatingBlock(null);
        return; 
      }
      
      // Cancel Selection on Escape
      if (e.key === 'Escape' && validSelection) {
        e.preventDefault();
        setSelStart(null);
        setSelEnd(null);
        return;
      }

      // Handle Delete/Backspace outside of Ctrl modifier
      if ((e.key === 'Delete' || e.key === 'Backspace') && validSelection) {
        if (imageCanvasRef.current) {
           clearRegion(imageCanvasRef.current, x, y, w, h);
           commitHistory(doc.width, doc.height);
           markDirty(docId);
        }
        return;
      }

      // Handle Space/Enter for Floating Block Placement
      if ((e.key === 'Enter' || e.key === ' ') && floatingBlock) {
        e.preventDefault();
        if (imageCanvasRef.current) {
          const success = pasteRegion(imageCanvasRef.current, floatingBlock.data, floatingBlock.x, floatingBlock.y);
          if (success) {
            commitHistory(doc.width, doc.height);
            markDirty(docId);
            setFloatingBlock(null);
          } else {
            alert(t('editor.pasteError'));
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === 'z') {
           e.preventDefault();
           if (e.shiftKey) {
             const restored = redo(docId);
             if (restored && imageCanvasRef.current) imageCanvasRef.current.getContext('2d')?.putImageData(restored, 0, 0);
           } else {
             const restored = undo(docId);
             if (restored && imageCanvasRef.current) imageCanvasRef.current.getContext('2d')?.putImageData(restored, 0, 0);
           }
           return;
        } else if (e.key.toLowerCase() === 'y') {
           e.preventDefault();
           const restored = redo(docId);
           if (restored && imageCanvasRef.current) imageCanvasRef.current.getContext('2d')?.putImageData(restored, 0, 0);
           return;
        }

        // Ctrl+S / Cmd+S → Save
        if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
           e.preventDefault();
           window.dispatchEvent(new CustomEvent('request-save', { detail: { id: docId, saveAs: e.shiftKey } }));
           return;
        }

        if (e.key.toLowerCase() === 'c' && validSelection) {
          e.preventDefault();
          if (imageCanvasRef.current) {
             const data = copyRegion(imageCanvasRef.current, x, y, w, h);
             setClipboard(data);
             console.log(t('editor.copied'));
          }
        } 
        // Handle Cut
        else if (e.key.toLowerCase() === 'x' && validSelection) {
          e.preventDefault();
          if (imageCanvasRef.current) {
             const data = copyRegion(imageCanvasRef.current, x, y, w, h);
             setClipboard(data);
             clearRegion(imageCanvasRef.current, x, y, w, h);
             commitHistory(doc.width, doc.height);
             markDirty(docId);
          }
        }
        // Handle Paste
        else if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          if (clipboard) {
             // Create floating block at current selection or 0,0
             setFloatingBlock({ data: clipboard, x: validSelection ? x : 0, y: validSelection ? y : 0 });
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [docId, selStart, selEnd, clipboard, doc.isDirty, doc.filePath, doc.title, doc.zoom, floatingBlock, doc.showGrid]);

  // Removed IPC trigger save effects
  useEffect(() => {
    const onResize = (e: CustomEvent<{w: number, h: number, id: string}>) => {
      if (e.detail.id !== docId || !imageCanvasRef.current) return;
      
      const { w, h } = e.detail;
      const canvas = imageCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const oldData = ctx.getImageData(0, 0, doc.width, doc.height);
      
      updateDocument(docId, { width: w, height: h, isDirty: true });
      markDirty(docId);

      requestAnimationFrame(() => {
        if (imageCanvasRef.current) {
          const newCtx = imageCanvasRef.current.getContext('2d');
          if (newCtx) {
            newCtx.putImageData(oldData, 0, 0);
            commitHistory(w, h);
          }
        }
      });
    };
    window.addEventListener('resize-canvas', onResize as EventListener);
    return () => window.removeEventListener('resize-canvas', onResize as EventListener);
  }, [docId, doc.width, doc.height]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!imageCanvasRef.current || !doc) return;

    const pos = screenToCanvas(e.clientX, e.clientY);

    // If right-clicked ON the floating block, auto-pack it (and clear it)
    if (floatingBlock) {
      const fw = floatingBlock.data.width;
      const fh = floatingBlock.data.height;
      if (pos.x >= floatingBlock.x && pos.x < floatingBlock.x + fw &&
          pos.y >= floatingBlock.y && pos.y < floatingBlock.y + fh) {
        
        const ctx = imageCanvasRef.current.getContext('2d');
        if (!ctx) return;
        
        const fullImageData = ctx.getImageData(0, 0, doc.width, doc.height);
        const cw = floatingBlock.data.width;
        const ch = floatingBlock.data.height;
        
        for (let y = 0; y <= doc.height - ch; y += doc.gridHeight) {
          for (let x = 0; x <= doc.width - cw; x += doc.gridWidth) {
             if (isRegionTransparent(fullImageData, x, y, cw, ch)) {
                 pasteRegion(imageCanvasRef.current, floatingBlock.data, x, y);
                 commitHistory(doc.width, doc.height);
                 markDirty(docId);
                 
                 setSelStart({x, y});
                 setSelEnd({x: x + cw, y: y + ch});
                 setFloatingBlock(null);
                 console.log(t('editor.autoPacked', { x, y }));
                 return; // Stop after first fit
             }
          }
        }
        alert(t('editor.noSpace'));
        return;
      }
    }

    // Otherwise, spawn floating block at right-click location (like Ctrl+V)
    if (clipboard) {
      setFloatingBlock({ data: clipboard, x: pos.x, y: pos.y });
    }
  };

  if (!doc) return <div>{t('editor.docNotFound', { id: docId })}</div>;

  let selBox = null;
  if (selStart && selEnd) {
    const rx = Math.min(selStart.x, selEnd.x);
    const ry = Math.min(selStart.y, selEnd.y);
    const rw = Math.abs(selEnd.x - selStart.x);
    const rh = Math.abs(selEnd.y - selStart.y);
    if (rw > 0 && rh > 0) {
       selBox = { x: rx, y: ry, w: rw, h: rh };
    }
  }

  // Solid Background for image view
  const bgStyle = {
    backgroundColor: doc.backgroundColor || '#222',
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%', 
        height: '100%', 
        overflow: 'hidden', 
        ...bgStyle 
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
    >
      <div style={{
          transform: `translate(${doc.offsetX}px, ${doc.offsetY}px) scale(${doc.zoom})`,
          transformOrigin: '0 0',
          position: 'absolute',
          width: doc.width,
          height: doc.height,
          backgroundColor: doc.backgroundColor || '#222',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
      }}>
        {/* Pixel Canvas */}
        <canvas
          ref={imageCanvasRef}
          width={doc.width}
          height={doc.height}
          style={{ position: 'absolute', top: 0, left: 0, imageRendering: 'pixelated' }}
        />

        {/* Grid Layer overlay */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', ...gridStyle }} />

        {/* Selection Box */}
        {selBox && (
          <div style={{
            position: 'absolute',
            top: selBox.y,
            left: selBox.x,
            width: selBox.w,
            height: selBox.h,
            border: '2px dashed #00bfff',
            backgroundColor: 'rgba(0, 191, 255, 0.2)',
            pointerEvents: 'none',
            boxSizing: 'border-box'
          }} />
        )}

        {/* Floating Paste Block Overlay */}
        {floatingBlock && (
          <canvas
            ref={(canvas) => {
              if (canvas && floatingBlock.data) {
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.putImageData(floatingBlock.data.imageData, 0, 0);
              }
            }}
            width={floatingBlock.data.width}
            height={floatingBlock.data.height}
            style={{ 
              position: 'absolute', 
              top: floatingBlock.y, 
              left: floatingBlock.x, 
              pointerEvents: 'none',
              imageRendering: 'pixelated',
              boxShadow: isDraggingBlock ? '0 0 10px rgba(0,255,0,0.8)' : '0 0 5px rgba(255,255,255,0.8)',
              border: '2px dotted #fff',
              opacity: 0.9,
              zIndex: 10
            }}
          />
        )}
      </div>
    </div>
  );
};

export default CanvasEditor;
