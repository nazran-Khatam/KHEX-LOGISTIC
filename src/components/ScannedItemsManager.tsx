import React, { useState } from 'react';
import { Plus, Trash2, LayoutGrid, RotateCcw, Minus, ArrowLeft } from 'lucide-react';

interface ScannedItemsManagerProps {
  serialNumbers: string; // Comma separated list of serials
  onChange: (newSerials: string) => void;
  onQuantityChange: (newQty: number) => void;
}

export default function ScannedItemsManager({
  serialNumbers,
  onChange,
  onQuantityChange
}: ScannedItemsManagerProps) {
  const [manualCode, setManualCode] = useState('');

  // Sift and parse current comma-separated serials
  const getSerialsArray = (str: string): string[] => {
    return str
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '');
  };

  const serialsArray = getSerialsArray(serialNumbers);

  // Group occurrences to calculate cumulative counts
  const countsMap: Record<string, number> = {};
  const orderOfAppearance: string[] = [];

  serialsArray.forEach(code => {
    if (!countsMap[code]) {
      countsMap[code] = 0;
      orderOfAppearance.push(code);
    }
    countsMap[code] += 1;
  });

  const handleAddCode = (codeToAdd: string) => {
    const trimmed = codeToAdd.trim();
    if (!trimmed) return;

    // Split by comma in case the user types/scans multiple codes or has automatic formatting
    const codes = trimmed
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '');

    if (codes.length === 0) return;

    // Append to existing list
    const updatedArray = [...serialsArray, ...codes];
    const joined = updatedArray.join(', ');
    
    onChange(joined);
    onQuantityChange(updatedArray.length);
    setManualCode('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAddCode(manualCode);
    }
  };

  const handleIncrement = (code: string) => {
    const updatedArray = [...serialsArray, code];
    onChange(updatedArray.join(', '));
    onQuantityChange(updatedArray.length);
  };

  const handleDecrement = (code: string) => {
    // Remove only the first occurrence of this code
    const index = serialsArray.indexOf(code);
    if (index > -1) {
      const updatedArray = [...serialsArray];
      updatedArray.splice(index, 1);
      onChange(updatedArray.join(', '));
      onQuantityChange(updatedArray.length);
    }
  };

  const handleRemoveAll = (code: string) => {
    const updatedArray = serialsArray.filter(c => c !== code);
    onChange(updatedArray.join(', '));
    onQuantityChange(updatedArray.length);
  };

  const handleClear = () => {
    onChange('');
    onQuantityChange(0);
  };

  return (
    <div className="bg-black/[0.02] border border-black/10 rounded-[24px] p-5 mt-4 space-y-4 shadow-sm relative select-none">
      
      {/* Header Info */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black tracking-widest text-[#FF9800] uppercase">
          BARCODE TERMINAL ACCESS / SCANNER
        </span>
        {serialsArray.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[9px] font-black uppercase tracking-wider text-black/45 hover:text-red-500 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" /> Reset terminal
          </button>
        )}
      </div>

      {/* Manual Code Input Control Area */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Manual code..."
          className="w-full sm:flex-1 bg-white border border-black/10 text-black rounded-xl py-3 px-4 outline-none focus:border-[#FF9800] focus:ring-1 focus:ring-[#FF9800] text-xs font-mono placeholder:text-black/25 transition-all font-semibold shadow-inner"
        />
        <button
          type="button"
          onClick={() => handleAddCode(manualCode)}
          className="w-full sm:w-auto bg-[#FF9800] hover:bg-[#FFA726] text-black text-xs font-black uppercase tracking-wider py-3 sm:py-0 px-5 rounded-xl transition-all shadow-lg shadow-[#FF9800]/10 active:scale-95 flex items-center justify-center sm:min-w-[70px]"
        >
          Add
        </button>
      </div>

      {/* Listing Block */}
      <div className="space-y-2.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black tracking-widest text-black/40 font-mono uppercase">
            SCANNED ITEMS ({serialsArray.length})
          </span>
          {serialsArray.length > 0 && (
            <span className="text-[9px] font-extrabold text-[#FF9800] font-mono">
              TOTAL UNITS: {serialsArray.length}
            </span>
          )}
        </div>

        {orderOfAppearance.length > 0 ? (
          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
            {orderOfAppearance.map((code) => {
              const count = countsMap[code];
              return (
                <div
                  key={code}
                  className="bg-white hover:bg-black/[0.01]/60 border border-black/10 rounded-xl p-3 flex justify-between items-center transition-all group/scan"
                >
                  {/* Left node representation */}
                  <div className="flex items-center gap-2.5">
                    {/* Visual 2x2 grid icon representation matching screenshot exactly */}
                    <div className="grid grid-cols-2 gap-[2.5px] w-[15px] h-[15px] p-[1.5px] bg-[#FF9800]/10 rounded border border-[#FF9800]/25">
                      <span className="bg-[#FF9800] rounded-[1px]"></span>
                      <span className="bg-[#FF9800] rounded-[1px]"></span>
                      <span className="bg-[#FF9800] rounded-[1px]"></span>
                      <span className="bg-[#FF9800] rounded-[1px]"></span>
                    </div>

                    <span className="text-sm font-mono font-black text-black tracking-wide">
                      {code}
                    </span>
                  </div>

                  {/* Actions / Count Badge on right side */}
                  <div className="flex items-center gap-2">
                    {/* Helper click actions visible on hover */}
                    <div className="opacity-0 group-hover/scan:opacity-100 flex items-center gap-1 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleDecrement(code)}
                        className="w-5 h-5 rounded-md bg-[#FF9800]/10 text-[#FF9800] hover:bg-[#FF9800]/20 flex items-center justify-center transition-colors"
                        title="Decrease count"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIncrement(code)}
                        className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 flex items-center justify-center transition-colors"
                        title="Increase count"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAll(code)}
                        className="w-5 h-5 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center transition-colors ml-1"
                        title="Remove entirely"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Quantity Badge matching layout */}
                    <span className="bg-[#FF9800] text-black text-[10px] font-black rounded-lg py-1 px-3 min-w-[28px] text-center shadow-md">
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-black/10 rounded-xl p-5 text-center text-black/40 font-mono text-[10px] bg-black/[0.005]">
            TERMINAL EMPTY: READY TO SCAN
          </div>
        )}
      </div>
    </div>
  );
}
