import React from 'react';
import { useDrag } from 'react-dnd';
import { Course, ConflictData } from '../../lib/types';
import { GripVertical, AlertCircle, ArrowRightCircle, X } from 'lucide-react';

interface DraggableCourseProps {
  course: Course;
  isSidebar?: boolean;
  slotId?: string;
  placedCount?: number;
  conflict?: ConflictData;
  onJumpToClass?: (classId: string) => void;
  onRemove?: (slotId: string) => void;
}

export const DraggableCourse: React.FC<DraggableCourseProps> = ({ 
  course, 
  isSidebar, 
  slotId, 
  placedCount = 0,
  conflict,
  onJumpToClass,
  onRemove
}) => {
  const isExceeded = isSidebar && (placedCount > course.quota);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'COURSE',
    item: { ...course, source: isSidebar ? 'sidebar' : 'grid', slotId },
    canDrag: true, // 彻底放开，支持无尽拖拽无限上场
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [isExceeded, course, slotId]);

  return (
    <div
      ref={drag}
      className={`
        relative group flex flex-col justify-between p-2 rounded-md border text-sm font-medium transition-all select-none overflow-hidden h-full min-h-[42px]
        ${course.color}
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
        ${isSidebar ? 'w-full mb-2 h-auto block' : 'w-full absolute inset-0 rounded-none border-0'}
        ${isExceeded && isSidebar ? 'opacity-90 ring-1 ring-red-300' : ''} hover:shadow-md cursor-move
        ${conflict ? 'ring-2 ring-inset ring-red-500 bg-red-50 z-20' : ''}
      `}
      >
        <div className="flex items-center w-full justify-between gap-1">
          <span className="truncate">{course.subject}</span>
          <span className="text-xs opacity-70 truncate max-w-[50px]">{course.teacherName}</span>
        </div>
        
        {isSidebar && (
          <div className="flex items-center justify-end mt-1">
            <span 
              className={`text-xs font-mono px-1.5 py-0.5 rounded-full shadow-sm transition-colors ${
                isExceeded 
                  ? 'bg-red-500 text-white font-bold ring-2 ring-red-200 animate-pulse' 
                  : 'bg-white/50 text-slate-700'
              }`}
              title={isExceeded ? "已超出周定额" : ""}
            >
              {placedCount}/{course.quota}
            </span>
            <GripVertical size={14} className="text-slate-400 ml-1 shrink-0" />
          </div>
        )}

        {/* Actionable Conflict Display */}
      {conflict && !isSidebar && (
        <div 
          className="mt-1 flex items-start text-[10px] leading-tight text-red-600 font-bold bg-white/60 p-1.5 rounded backdrop-blur-sm border border-red-200 cursor-default"
          onMouseDown={(e) => e.stopPropagation()} // Prevent drag start on the entire alert box
        >
          <AlertCircle size={12} className="mr-1.5 shrink-0 mt-0.5" />
          <div className="flex flex-col flex-1">
            <span className="break-all line-clamp-2">{conflict.message}</span>
            {conflict.conflictingClassId && onJumpToClass && (
              <button 
                onClick={(e) => {
                  e.stopPropagation(); 
                  onJumpToClass(conflict.conflictingClassId!);
                }}
                className="flex items-center mt-1.5 text-white bg-red-500 hover:bg-red-600 rounded px-2 py-0.5 w-fit transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                切换至该班级 <ArrowRightCircle size={10} className="ml-1" />
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Hover actions for grid items (only if no conflict to reduce clutter) */}
      {!isSidebar && !isDragging && !conflict && (
        <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          {onRemove && slotId && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(slotId); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-sm transition-colors cursor-pointer active:scale-90"
              title="移除此课程"
            >
              <X size={10} />
            </button>
          )}
          <div className="bg-white/50 rounded-full p-0.5">
            <GripVertical size={12} className="text-slate-600" />
          </div>
        </div>
      )}
    </div>
  );
};
