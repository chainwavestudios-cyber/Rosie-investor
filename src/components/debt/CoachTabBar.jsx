import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const GOLD = '#10b981';
const MUTED = '#8a9ab8';

// Two-row tab bar for the Debt Call Coach page. Row 0 renders above row 1 and
// every tab can be dragged to any position in either row.
export default function CoachTabBar({ rows, tabMap, active, onSelect, onMove, onReset }) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    onMove(
      { row: Number(result.source.droppableId), index: result.source.index },
      { row: Number(result.destination.droppableId), index: result.destination.index },
    );
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div style={{ marginBottom: '20px' }}>
        {[0, 1].map((rowIndex) => (
          <div
            key={rowIndex}
            style={{ display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Droppable droppableId={String(rowIndex)} direction="horizontal">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    display: 'flex', gap: '2px', flex: 1, minHeight: rowIndex === 0 ? '34px' : '4px',
                    overflowX: 'auto', background: snapshot.isDraggingOver ? 'rgba(16,185,129,0.05)' : 'transparent',
                  }}
                >
                  {rows[rowIndex].map((id, index) => {
                    const tabDef = tabMap[id];
                    if (!tabDef) return null;
                    return (
                      <Draggable key={id} draggableId={id} index={index}>
                        {(drag, snap) => (
                          <button
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            onClick={() => onSelect(id)}
                            title="Click to open — drag to reorder"
                            style={{
                              padding: '10px 18px',
                              background: active === id ? `${GOLD}12` : snap.isDragging ? 'rgba(255,255,255,0.07)' : 'transparent',
                              border: 'none',
                              borderBottom: `2px solid ${active === id ? GOLD : 'transparent'}`,
                              color: active === id ? GOLD : MUTED,
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: active === id ? 'bold' : 'normal',
                              whiteSpace: 'nowrap',
                              opacity: snap.isDragging ? 0.75 : 1,
                            }}
                          >
                            {tabDef.label}
                          </button>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            {rowIndex === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 0 8px 12px', flexShrink: 0 }}>
                <span style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Drag tabs to reorder</span>
                <button
                  onClick={onReset}
                  style={{ background: 'rgba(255,255,255,0.05)', color: MUTED, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px' }}
                >
                  ↺ Reset order
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}