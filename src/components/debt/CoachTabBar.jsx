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
      <div className="dcc-coach-tabs" style={{ margin:'11px 0 17px',padding:'8px 10px 4px',background:'linear-gradient(125deg,#101d2a,#101f2a)',border:'1px solid rgba(139,184,173,.19)',borderRadius:12 }}>
        <style>{` .dcc-coach-tabs button{transition:background .15s,color .15s,border-color .15s}.dcc-coach-tabs button:focus-visible{outline:2px solid #d7ba7a;outline-offset:2px}@media(prefers-reduced-motion:reduce){.dcc-coach-tabs button{transition:none!important}} `}</style>
        {[0, 1].map((rowIndex) => (
          <div
            key={rowIndex}
            style={{ display:'flex', alignItems:'flex-end',borderBottom:rowIndex===0?'1px solid rgba(138,186,165,.15)':'none',gap:9 }}
          >
            <Droppable droppableId={String(rowIndex)} direction="horizontal">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    display:'flex',gap:3,flex:1,minHeight:rowIndex===0?'34px':'3px',padding:'3px 0',
                    overflowX:'auto',background:snapshot.isDraggingOver?'rgba(16,185,129,.07)':'transparent',
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
                            title="Click to open · drag to reorder"
                            aria-current={active===id?'page':undefined}
                            style={{
                              padding:'8px 12px',
                              background:active===id?'linear-gradient(125deg,rgba(34,124,93,.28),rgba(19,76,68,.12))':snap.isDragging?'rgba(255,255,255,.07)':'transparent',
                              border:'1px solid '+(active===id?'rgba(67,184,144,.4)':'transparent'),
                              borderBottom:'2px solid '+(active===id?'#49d6a7':'transparent'),
                              borderRadius:'7px 7px 4px 4px',
                              color:active===id?'#b9f2d9':'#99aebb',
                              cursor:'pointer',
                              fontSize:12,
                              fontWeight:active===id?800:550,
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
                <span style={{ color:'#738e96',fontSize:9,letterSpacing:'.4px',whiteSpace:'nowrap' }}>Drag to arrange</span>
                <button
                  onClick={onReset}
                  style={{background:'rgba(255,255,255,.035)',color:'#9db5ba',border:'1px solid rgba(161,187,191,.18)',borderRadius:6,padding:'5px 8px',cursor:'pointer',fontSize:10}}
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