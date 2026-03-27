import React from 'react';
import { useDrop } from 'react-dnd';

interface GridCellProps {
  day: number;
  period: number;
  onDrop: (item: any, day: number, period: number) => void;
  children?: React.ReactNode;
  isConflict?: boolean;
  isHighlighted?: boolean;
}

export const GridCell: React.FC<GridCellProps> = ({ 
  day, 
  period, 
  onDrop, 
  children,
  isConflict,
  isHighlighted
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'COURSE',
    drop: (item, monitor) => {
        if (monitor.didDrop()) return; // Avoid double drops in nested targets if any
        onDrop(item, day, period);
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }), [day, period, onDrop]);

  return (
    <div
      ref={drop}
      className={`
        relative border-r border-b border-slate-200 p-1 min-h-[100px] flex flex-col transition-all duration-300
        ${day === 4 ? 'border-r-0' : ''}
        ${isOver && canDrop ? 'bg-indigo-50/80 ring-2 ring-inset ring-indigo-300' : ''}
        ${!isOver && canDrop ? 'bg-slate-50' : 'bg-white'}
        ${isConflict ? 'bg-red-50/30' : ''}
        ${isHighlighted ? 'ring-4 ring-inset ring-yellow-400 bg-yellow-50 z-10 shadow-lg scale-[1.02]' : ''}
      `}
    >
      {/* Highlight Pulse Animation Effect */}
      {isHighlighted && (
        <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
        </span>
      )}
      
      {children}
    </div>
  );
};
